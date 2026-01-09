const pool = require("../config/database");

const debtController = {
  createDebt: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { driverId, amount, reason, notes } = req.body;

      if (!driverId || !amount || !reason) {
        throw new Error("Missing required fields: driverId, amount, reason");
      }

      // 0. Check if driver is verified
      const [driverResult] = await connection.query(
        "SELECT verified FROM drivers WHERE driver_id = ? FOR UPDATE",
        [driverId]
      );

      if (driverResult.length === 0) {
        throw new Error("Driver not found.");
      }

      if (!driverResult[0].verified) {
        throw new Error("Cannot create debt for an unverified driver.");
      }

      // 0.5. Check for processing payments (MUST be cleared or reverted first)
      const [processingPayments] = await connection.query(
        "SELECT id FROM payments WHERE driver_id = ? AND status = 'processing' LIMIT 1",
        [driverId]
      );

      if (processingPayments.length > 0) {
        throw new Error(
          "Driver has a processing payment. Please REVERT it (to apply debt) or CONFIRM(make payment) it first."
        );
      }

      // 1. Check for existing active debt
      const [existingDebts] = await connection.query(
        "SELECT id FROM driver_debts WHERE driver_id = ? AND status = 'active' LIMIT 1",
        [driverId]
      );

      if (existingDebts.length > 0) {
        throw new Error(
          "Driver already has an active debt. Please clear it first."
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
        // If final_payout is null, assume full net_payout is available
        // If final_payout is already set (partial previous deduction), use that
        let available =
          bonus.final_payout !== null
            ? parseFloat(bonus.final_payout)
            : parseFloat(bonus.net_payout);

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
      await connection.rollback();
      console.error("Create debt error:", error);
      res
        .status(500)
        .json({ message: error.message || "Internal server error" });
    } finally {
      connection.release();
    }
  },

  search: async (req, res) => {
    try {
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
    } catch (error) {
      console.error("Search debts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getDebtsByDriver: async (req, res) => {
    try {
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
    } catch (error) {
      console.error("Get debts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = debtController;
