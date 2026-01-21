const pool = require("../config/database");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const debtController = {
  createDebt: catchAsync(async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { driverId, amount, reason, notes } = req.body;

      if (!driverId || !amount || !reason) {
        throw new AppError(
          "Missing required fields: driverId, amount, reason",
          400
        );
      }

      // 0. Check if driver is verified
      const [driverResult] = await connection.query(
        "SELECT verified FROM drivers WHERE driver_id = ? FOR UPDATE",
        [driverId]
      );

      if (driverResult.length === 0) {
        throw new AppError("Driver not found.", 404);
      }

      // 0.5. Check for processing payments (MUST be cleared or reverted first)
      const [processingPayments] = await connection.query(
        "SELECT id FROM payments WHERE driver_id = ? AND status = 'processing' LIMIT 1",
        [driverId]
      );

      if (processingPayments.length > 0) {
        throw new AppError(
          "Driver has a processing payment. Please REVERT it (to apply debt) or CONFIRM(make payment) it first.",
          400
        );
      }

      // 1. Check for existing active debt
      const [existingDebts] = await connection.query(
        "SELECT id FROM driver_debts WHERE driver_id = ? AND status = 'active' LIMIT 1",
        [driverId]
      );

      if (existingDebts.length > 0) {
        throw new AppError(
          "Driver already has an active debt. Please clear it first.",
          400
        );
      }

      // 2. Create the Debt Record
      const [result] = await connection.query(
        "INSERT INTO driver_debts (driver_id, amount, remaining_amount, reason, notes, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [driverId, amount, amount, reason, notes, req.user.id, "active"]
      );
      const debtId = result.insertId;

      // 2. Sweep & Deduct: Apply to existing PENDING bonuses immediately
      // Only target bonuses that are NOT in a processing/paid batch (payment_id IS NULL)
      const [pendingBonuses] = await connection.query(
        "SELECT * FROM bonuses WHERE driver_id = ? AND payment_id IS NULL ORDER BY week_date ASC",
        [driverId]
      );

      let currentRemaining = parseFloat(amount);
      const deductions = [];

      for (const bonus of pendingBonuses) {
        if (currentRemaining <= 0) break;

        // Calculate available amount in this bonus
        // If final_payout is set, use it (already has previous deductions)
        // Otherwise calculate from gross - withholding (proper net)
        let available;
        if (bonus.final_payout !== null) {
          available = parseFloat(bonus.final_payout);
        } else {
          // Calculate net from gross - withholding (for old records without final_payout)
          const gross = parseFloat(bonus.gross_payout || 0);
          const withholding = parseFloat(bonus.withholding_tax || 0);
          available = gross - withholding;
        }

        if (available > 0) {
          // Determine how much to take
          const deductionAmount = Math.min(currentRemaining, available);
          const newFinalPayout = available - deductionAmount;

          // Update Bonus
          await connection.query(
            "UPDATE bonuses SET final_payout = ? WHERE id = ?",
            [newFinalPayout, bonus.id]
          );

          // Log Deduction
          await connection.query(
            "INSERT INTO bonus_deductions (bonus_id, debt_id, amount_deducted) VALUES (?, ?, ?)",
            [bonus.id, debtId, deductionAmount]
          );

          currentRemaining -= deductionAmount;
        }
      }

      // 3. Update Debt Status
      const newStatus = currentRemaining <= 0 ? "paid" : "active";
      await connection.query(
        "UPDATE driver_debts SET remaining_amount = ?, status = ? WHERE id = ?",
        [currentRemaining, newStatus, debtId]
      );

      await connection.commit();

      res.status(201).json({
        success: true,
        message: "Debt created successfully.",
        debtId: debtId,
        remaining: currentRemaining,
        deducted_retroactively: amount - currentRemaining,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }),

  search: catchAsync(async (req, res, next) => {
    const { q, status, page = 1, limit = 25 } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 25;
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = [];
    let queryParams = [];

    if (q) {
      whereConditions.push(
        "(dd.notes LIKE ? OR dd.reason LIKE ? OR d.full_name LIKE ? OR d.driver_id LIKE ?)"
      );
      queryParams.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (status && status !== "all") {
      whereConditions.push("dd.status = ?");
      queryParams.push(status);
    }

    const whereClause =
      whereConditions.length > 0
        ? "WHERE " + whereConditions.join(" AND ")
        : "";

    // Count Query
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM driver_debts dd
       JOIN drivers d ON dd.driver_id = d.driver_id
       ${whereClause}`,
      queryParams
    );

    const total = countRows[0] ? countRows[0].total : 0;

    // Data Query
    const [rows] = await pool.query(
      `SELECT dd.*, d.full_name, d.driver_id as driver_ref_id
       FROM driver_debts dd
       JOIN drivers d ON dd.driver_id = d.driver_id
       ${whereClause}
       ORDER BY dd.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    res.json({
      debts: rows,
      total: total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  }),

  getDebtsByDriver: catchAsync(async (req, res, next) => {
    const { driverId } = req.params;

    // Get Debts
    const [debts] = await pool.query(
      `SELECT d.*, u.full_name as created_by_name 
       FROM driver_debts d 
       LEFT JOIN users u ON d.created_by = u.id 
       WHERE d.driver_id = ? 
       ORDER BY d.created_at DESC`,
      [driverId]
    );

    // Get Deduction History
    const [deductions] = await pool.query(
      `SELECT bd.*, b.week_date, dd.reason 
       FROM bonus_deductions bd 
       JOIN bonuses b ON bd.bonus_id = b.id 
       JOIN driver_debts dd ON bd.debt_id = dd.id 
       WHERE b.driver_id = ? 
       ORDER BY bd.created_at DESC`,
      [driverId]
    );

    res.json({ debts, deductions });
  }),

  getDebtOverview: catchAsync(async (req, res, next) => {
    const [overview] = await pool.query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_debt_issued,
          COALESCE(SUM(remaining_amount), 0) as total_outstanding,
          COUNT(DISTINCT driver_id) as active_debtors,
          COALESCE(SUM(amount - remaining_amount), 0) as total_recovered
        FROM driver_debts
        WHERE status != 'void'
      `);

    const [breakdown] = await pool.query(`
        SELECT reason, SUM(remaining_amount) as total_amount
        FROM driver_debts
        WHERE status = 'active'
        GROUP BY reason
      `);

    const [topDebtors] = await pool.query(`
        SELECT d.full_name, d.driver_id, dd.amount as total_amount, dd.remaining_amount,
               (SELECT MAX(created_at) FROM bonus_deductions WHERE debt_id = dd.id) as last_repayment_date
        FROM driver_debts dd
        JOIN drivers d ON dd.driver_id = d.driver_id
        WHERE dd.status = 'active'
        ORDER BY dd.remaining_amount DESC
        LIMIT 10
      `);

    res.json({
      success: true,
      stats: {
        ...overview[0],
        breakdown_by_reason: breakdown,
        top_debtors: topDebtors,
      },
    });
  }),

  getAgingReport: catchAsync(async (req, res, next) => {
    const [rows] = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN DATEDIFF(NOW(), created_at) <= 30 THEN remaining_amount ELSE 0 END), 0) as period_0_30,
          COALESCE(SUM(CASE WHEN DATEDIFF(NOW(), created_at) > 30 AND DATEDIFF(NOW(), created_at) <= 60 THEN remaining_amount ELSE 0 END), 0) as period_31_60,
          COALESCE(SUM(CASE WHEN DATEDIFF(NOW(), created_at) > 60 AND DATEDIFF(NOW(), created_at) <= 90 THEN remaining_amount ELSE 0 END), 0) as period_61_90,
          COALESCE(SUM(CASE WHEN DATEDIFF(NOW(), created_at) > 90 THEN remaining_amount ELSE 0 END), 0) as period_90_plus
        FROM driver_debts
        WHERE status = 'active'
      `);

    res.json({ success: true, aging: rows[0] });
  }),

  getRepaymentTrends: catchAsync(async (req, res, next) => {
    const { months = 6 } = req.query;
    const [trends] = await pool.query(
      `
        SELECT 
          m.month,
          COALESCE(d.debt_created, 0) as debt_created,
          COALESCE(r.repayments, 0) as repayments
        FROM (
          SELECT DATE_FORMAT(DATE_SUB(NOW(), INTERVAL n.n MONTH), '%Y-%m') as month
          FROM (SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) n
        ) m
        LEFT JOIN (
          SELECT DATE_FORMAT(created_at, '%Y-%m') as month, SUM(amount) as debt_created
          FROM driver_debts
          WHERE status != 'void'
          GROUP BY month
        ) d ON m.month = d.month
        LEFT JOIN (
          SELECT DATE_FORMAT(created_at, '%Y-%m') as month, SUM(amount_deducted) as repayments
          FROM bonus_deductions
          GROUP BY month
        ) r ON m.month = r.month
        ORDER BY m.month ASC
      `,
      []
    );

    res.json({ success: true, trends });
  }),
};

module.exports = debtController;
