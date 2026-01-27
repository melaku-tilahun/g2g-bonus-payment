const pool = require("../../config/database");
const AuditService = require("../../services/auditService");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");

const paymentHistoryController = {
  recordPayment: catchAsync(async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        driver_id,
        // total_amount, // Ignored from body for security
        payment_date,
        payment_method,
        notes,
        bonus_period_start,
        bonus_period_end,
      } = req.body;

      if (!driver_id) {
        throw new AppError("Driver ID is required", 400);
      }

      // 1. Calculate the actual total from pending bonuses
      const [bonusRows] = await connection.query(
        "SELECT SUM(COALESCE(final_payout, calculated_net_payout)) as actual_total FROM bonuses WHERE driver_id = ? AND payment_id IS NULL",
        [driver_id],
      );

      const actualTotal = parseFloat(bonusRows[0].actual_total || 0);

      if (actualTotal === 0) {
        throw new AppError("No pending bonuses found for this driver", 400);
      }

      // 2. Record the payment using the CALCULATED total
      // Standard for manual recording
      const [result] = await connection.query(
        `INSERT INTO payments 
        (driver_id, total_amount, payout_type, payment_date, payment_method, notes, bonus_period_start, bonus_period_end, processed_by) 
        VALUES (?, ?, 'Standard', ?, ?, ?, ?, ?, ?)`,
        [
          driver_id,
          actualTotal,
          payment_date || new Date(),
          payment_method,
          notes,
          bonus_period_start,
          bonus_period_end,
          req.user.id,
        ],
      );

      // 3. Link bonuses to payment (Clear them)
      await connection.query(
        "UPDATE bonuses SET payment_id = ? WHERE driver_id = ? AND payment_id IS NULL",
        [result.insertId, driver_id],
      );

      await AuditService.log(
        req.user.id,
        "Record Payment",
        "payment",
        result.insertId,
        { driver_id, total_amount: actualTotal },
      );

      await connection.commit();
      res.status(201).json({
        id: result.insertId,
        message: "Payment recorded and bonuses cleared",
        total_paid: actualTotal,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }),

  getHistory: catchAsync(async (req, res, next) => {
    const {
      driver_id, // Specific driver filter
      q, // Search query (Name, ID, Phone)
      page = 1,
      limit = 25,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      method,
      filter, // Status OR Payout Type
      sortBy = "payment_date",
      sortOrder = "DESC",
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    let whereClause = "";
    const params = [];

    // Default status handling: If no status provided, show both paid and processing
    if (filter && filter !== "All") {
      if (['paid', 'processing'].includes(filter)) {
        whereClause = " WHERE p.status = ?";
        params.push(filter);
      } else {
        // Assume it's a payout_type filter
        whereClause = " WHERE p.payout_type = ?";
        params.push(filter);
      }
    } else {
      whereClause = " WHERE p.status IN ('paid', 'processing')";
    }

    // Driver Specific Filter
    if (driver_id) {
      whereClause += " AND p.driver_id = ?";
      params.push(driver_id);
    }

    // SEARCH (Name, ID, Phone)
    if (q) {
      whereClause += " AND (d.full_name LIKE ? OR p.driver_id LIKE ? OR d.phone_number LIKE ?)";
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (startDate) {
      whereClause += " AND p.payment_date >= ?";
      params.push(startDate);
    }

    if (endDate) {
      whereClause += " AND p.payment_date <= ?";
      params.push(`${endDate} 23:59:59`);
    }

    if (minAmount) {
      whereClause += " AND p.total_amount >= ?";
      params.push(parseFloat(minAmount));
    }

    if (maxAmount) {
      whereClause += " AND p.total_amount <= ?";
      params.push(parseFloat(maxAmount));
    }

    if (method && method !== "All") {
      whereClause += " AND p.payment_method = ?";
      params.push(method);
    }

    // SORTING
    const validColumns = [
      "payment_date",
      "total_amount",
      "driver_name",
      "driver_id",
    ];
    const sortColumn = validColumns.includes(sortBy) ? sortBy : "payment_date";
    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Get Total Count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM payments p
       LEFT JOIN drivers d ON p.driver_id = d.driver_id 
       ${whereClause}`,
      params,
    );

    // Get Paginated Data
    const query = `
      SELECT p.*, d.full_name as driver_name, u.full_name as processed_by_name 
      FROM payments p
      LEFT JOIN drivers d ON p.driver_id = d.driver_id
      LEFT JOIN users u ON p.processed_by = u.id
      ${whereClause}
      ORDER BY 
        ${
          sortColumn === "driver_name"
            ? "d.full_name"
            : sortColumn === "driver_id"
              ? "p.driver_id"
              : `p.${sortColumn}`
        } ${order}
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(query, [...params, limitNum, offset]);

    res.json({
      payments: rows,
      total: countRows[0].total,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total_pages: Math.ceil(countRows[0].total / limitNum),
      },
    });
  }),

  confirmPayment: catchAsync(async (req, res, next) => {
    const { paymentId } = req.params;
    const [result] = await pool.query(
      "UPDATE payments SET status = 'paid' WHERE id = ?",
      [paymentId],
    );

    if (result.affectedRows === 0) {
      throw new AppError("Payment not found", 404);
    }

    await AuditService.log(
      req.user.id,
      "Confirm Payment",
      "payment",
      paymentId,
      { status: "paid" },
    );
    res.json({ message: "Payment confirmed as Paid" });
  }),

  revertPayment: catchAsync(async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const { paymentId } = req.params;
      const { password } = req.body;

      if (!password) {
        throw new AppError("Password is required", 400);
      }

      // 1. Verify Password
      const [users] = await connection.query(
        "SELECT password_hash FROM users WHERE id = ?",
        [req.user.id],
      );

      const bcrypt = require("bcrypt");
      const isValid = await bcrypt.compare(password, users[0].password_hash);

      if (!isValid) {
        throw new AppError("Invalid password", 403);
      }

      // 2. Fetch Payment Details
      const [payments] = await connection.query(
        "SELECT * FROM payments WHERE id = ? AND status IN ('processing', 'paid')", // Allow paid too if needed, but mainly processing
        [paymentId],
      );

      if (payments.length === 0) {
        throw new AppError("Payment not found", 404);
      }

      const payment = payments[0];

      // 2. Full Revert Logic for Partial Payouts
      // Check if this payment involved 'is_unverified_payout' bonuses
      const [revertBonuses] = await connection.query(
        "SELECT id FROM bonuses WHERE payment_id = ? AND is_unverified_payout = TRUE",
        [paymentId],
      );

      if (revertBonuses.length > 0) {
        // NEW ARCHITECTURE: Revert based on penalty_tax column
        // 1. Restore amounts for bonuses with new penalty_tax record
        await connection.query(
          `UPDATE bonuses 
           SET 
             final_payout = final_payout + penalty_tax,
             calculated_withholding_tax = calculated_withholding_tax - penalty_tax,
             penalty_tax = 0,
             is_unverified_payout = FALSE 
           WHERE payment_id = ? AND is_unverified_payout = TRUE`,
          [paymentId]
        );
        
        // Legacy "fake debt" logic removed as per user request. 
        // Data migration ensures all records use penalty_tax column now.
        
        // NOTE: For regular debts in the NEW architecture, we do NOTHING. 
        // We do NOT delete their bonus_deductions.
        // We do NOT reset their debt status.
        // They remain paid.
      }

      // 3. Unlink Bonuses (Set payment_id = NULL)
      // Standard unlink for all bonuses (even if just modified above)
      await connection.query(
        "UPDATE bonuses SET payment_id = NULL WHERE payment_id = ?",
        [paymentId],
      );

      // 3. Delete Payment Record
      await connection.query("DELETE FROM payments WHERE id = ?", [paymentId]);

      // 4. Update Batch Totals (if part of a batch)
      if (payment.batch_internal_id) {
        // Check if this is the last payment for this driver in this batch
        const [remaining] = await connection.query(
          "SELECT id FROM payments WHERE batch_internal_id = ? AND driver_id = ? AND id != ? LIMIT 1",
          [payment.batch_internal_id, payment.driver_id, paymentId],
        );

        const driverCountChange = remaining.length === 0 ? 1 : 0;

        await connection.query(
          "UPDATE payment_batches SET total_amount = total_amount - ?, driver_count = driver_count - ? WHERE id = ?",
          [payment.total_amount, driverCountChange, payment.batch_internal_id],
        );
      }

      // 5. Audit Log
      await AuditService.log(
        req.user.id,
        "Revert Payment",
        "payment",
        paymentId,
        {
          driver_id: payment.driver_id,
          amount: payment.total_amount,
          batch_id: payment.batch_id,
        },
      );

      await connection.commit();
      res.json({ success: true, message: "Payment reverted successfully" });
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

    const qStr = q ? `%${q}%` : "%";

    // Part 1: Actual payment records
    let pQuery = `
        SELECT 
            CAST(p.id AS CHAR) COLLATE utf8mb4_general_ci as id, 
            p.driver_id as driver_ref_id, 
            d.full_name, 
            p.status, 
            p.total_amount, 
            p.payment_date
        FROM payments p
        JOIN drivers d ON p.driver_id = d.driver_id
        WHERE (p.id LIKE ? OR d.full_name LIKE ? OR d.driver_id LIKE ?)
        ${status && status !== "all" ? "AND p.status = ?" : ""}
      `;
    let pParams = [qStr, qStr, qStr];
    if (status && status !== "all") pParams.push(status);

    // Part 2: Accumulated bonuses (floating pending)
    let aQuery = `
        SELECT 
            CONCAT('PEND-', d.driver_id) COLLATE utf8mb4_general_ci as id, 
            d.driver_id as driver_ref_id, 
            d.full_name, 
            'pending' COLLATE utf8mb4_general_ci as status, 
            SUM(COALESCE(b.final_payout, b.calculated_net_payout)) as total_amount, 
            MAX(b.week_date) as payment_date
        FROM drivers d
        JOIN bonuses b ON d.driver_id = b.driver_id
        WHERE b.payment_id IS NULL
        AND (d.full_name LIKE ? OR d.driver_id LIKE ?)
        GROUP BY d.driver_id
        HAVING total_amount > 0
      `;
    let aParams = [qStr, qStr];

    let finalSubQuery = "";
    let finalParams = [];

    if (!status || status === "all" || status === "pending") {
      finalSubQuery = `(${pQuery}) UNION ALL (${aQuery})`;
      finalParams = [...pParams, ...aParams];
    } else {
      finalSubQuery = pQuery;
      finalParams = pParams;
    }

    // Wrap for total count and pagination
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM (${finalSubQuery}) as t`,
      finalParams,
    );
    const total = countRows[0] ? countRows[0].total : 0;

    const [rows] = await pool.query(
      `SELECT * FROM (${finalSubQuery}) as t 
         ORDER BY payment_date DESC 
         LIMIT ? OFFSET ?`,
      [...finalParams, limitNum, offset],
    );

    res.json({
      payments: rows,
      total: total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  }),
};

module.exports = paymentHistoryController;
