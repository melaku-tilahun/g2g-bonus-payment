const pool = require("../config/database");
const AuditService = require("../services/auditService");
const TINVerificationService = require("../services/tinVerificationService");
const fs = require("fs");
const path = require("path");
// const PDFDocument = require("pdfkit"); // No longer needed here

const driverController = {
  search: async (req, res) => {
    try {
      const { q, status, page = 1, limit = 25 } = req.query;

      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 25;
      const offset = (pageNum - 1) * limitNum;

      // Build WHERE clause
      let whereConditions = [];
      let queryParams = [];

      if (q) {
        whereConditions.push(
          "(d.full_name LIKE ? OR d.driver_id LIKE ? OR d.phone_number LIKE ?)"
        );
        queryParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }

      if (status === "verified") {
        whereConditions.push("d.verified = TRUE");
      } else if (status === "unverified") {
        whereConditions.push("d.verified = FALSE");
      } else if (status === "blocked") {
        whereConditions.push("d.is_blocked = TRUE");
      }

      const whereClause =
        whereConditions.length > 0
          ? "WHERE " + whereConditions.join(" AND ")
          : "";

      // Get Total Count
      const [countRows] = await pool.query(
        `SELECT COUNT(*) as total FROM drivers d ${whereClause}`,
        queryParams
      );

      const total = countRows[0] ? countRows[0].total : 0;

      // Get Data with Pending Bonus Info
      const [rows] = await pool.query(
        `SELECT 
          d.*, 
          COALESCE(SUM(COALESCE(b.final_payout, b.net_payout)), 0) as total_pending,
          COUNT(b.id) as weeks_pending
         FROM drivers d
         LEFT JOIN bonuses b ON d.driver_id = b.driver_id AND b.payment_id IS NULL
         ${whereClause}
         GROUP BY d.id
         ORDER BY d.created_at DESC
         LIMIT ? OFFSET ?`,
        [...queryParams, limitNum, offset]
      );

      res.json({
        drivers: rows,
        total: total,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total_pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error("Search drivers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await pool.query(
        `SELECT d.*, u.full_name as verified_by_name 
         FROM drivers d 
         LEFT JOIN users u ON d.verified_by = u.id 
         WHERE d.driver_id = ?`,
        [id]
      );
      if (rows.length === 0)
        return res.status(404).json({ message: "Driver not found" });
      res.json(rows[0]);
    } catch (error) {
      console.error("Get driver error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  verify: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        verified_date,
        tin,
        business_name,
        licence_number,
        manager_name,
        manager_photo,
        admin_override,
      } = req.body;

      console.log(`Verifying driver ${id} by user ${req.user.id}`);

      // Admin override allows verification without TIN (for edge cases)
      if (!admin_override && !tin) {
        return res.status(400).json({
          message:
            "TIN is required for verification. Admins can use override if needed.",
        });
      }

      // Process photo if it's base64
      let photoPath = manager_photo || null;
      if (manager_photo && manager_photo.startsWith("data:image")) {
        try {
          const base64Data = manager_photo.replace(
            /^data:image\/\w+;base64,/,
            ""
          );
          const buffer = Buffer.from(base64Data, "base64");
          const fileName = `driver_${id}_${Date.now()}.jpg`;
          const relativePath = `/uploads/driver_photos/${fileName}`;
          const absolutePath = path.join(
            __dirname,
            "../../public",
            relativePath
          );

          fs.writeFileSync(absolutePath, buffer);
          photoPath = relativePath;
          console.log(`📸 Photo saved to: ${photoPath}`);
        } catch (photoError) {
          console.error("Error saving photo:", photoError);
          // Fallback to null or keep base64 if it fails, but ideally we want a path
        }
      }

      // Prepare update query
      const updateFields = {
        verified: true,
        verified_date: verified_date || new Date(),
        verified_by: req.user.id,
        tin: tin || null,
        business_name: business_name || null,
        licence_number: licence_number || null,
        manager_name: manager_name || null,
        manager_photo: photoPath,
        tin_verified_at: tin ? new Date() : null,
      };

      await pool.query(
        `UPDATE drivers SET 
          verified = ?, 
          verified_date = ?, 
          verified_by = ?,
          tin = ?,
          business_name = ?,
          licence_number = ?,
          manager_name = ?,
          manager_photo = ?,
          tin_verified_at = ?
        WHERE driver_id = ?`,
        [
          updateFields.verified,
          updateFields.verified_date,
          updateFields.verified_by,
          updateFields.tin,
          updateFields.business_name,
          updateFields.licence_number,
          updateFields.manager_name,
          updateFields.manager_photo,
          updateFields.tin_verified_at,
          id,
        ]
      );

      await AuditService.log(req.user.id, "Verify Driver", "driver", id, {
        verified_date: updateFields.verified_date,
        tin: updateFields.tin,
        business_name: updateFields.business_name,
        admin_override: admin_override || false,
      });

      res.json({ message: "Driver verified successfully" });
    } catch (error) {
      console.error("Verify driver error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  lookupTIN: async (req, res) => {
    try {
      const { tin } = req.params;

      // Validate TIN format
      if (!TINVerificationService.validateTINFormat(tin)) {
        return res.status(400).json({
          message: "Invalid TIN format. TIN should be 8-12 digits.",
        });
      }

      // Fetch business data from Ministry of Revenue API
      const businessData = await TINVerificationService.lookupTIN(tin);

      res.json({
        success: true,
        data: businessData,
      });
    } catch (error) {
      console.error("TIN lookup error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to lookup TIN",
      });
    }
  },

  getAll: async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM drivers ORDER BY created_at DESC"
      );
      res.json(rows);
    } catch (error) {
      console.error("Get all drivers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  toggleBlockStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { is_blocked, reason } = req.body;

      if (typeof is_blocked !== "boolean") {
        return res
          .status(400)
          .json({ message: "is_blocked (boolean) is required" });
      }

      await pool.query(
        "UPDATE drivers SET is_blocked = ? WHERE driver_id = ?",
        [is_blocked, id]
      );

      await AuditService.log(
        req.user.id,
        is_blocked ? "Block Driver" : "Unblock Driver",
        "driver",
        id,
        { reason }
      );

      res.json({
        success: true,
        message: `Driver ${is_blocked ? "blocked" : "unblocked"} successfully`,
      });
    } catch (error) {
      console.error("Toggle block status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  releaseUnverifiedPayout: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const { id } = req.params;
      const { password } = req.body;

      // 1. Validate Admin Password (Security Check)
      // For this MVP, we will check against the current user's password.
      // In production, this should be more robust.
      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }

      // Check user password
      const [users] = await connection.query(
        "SELECT password_hash FROM users WHERE id = ?",
        [req.user.id]
      );
      const bcrypt = require("bcrypt");
      const isValid = await bcrypt.compare(password, users[0].password_hash);

      if (!isValid) {
        return res.status(403).json({ message: "Invalid password" });
      }

      await connection.beginTransaction();

      // 2. Fetch Pending Bonuses (exclude already force-paid bonuses)
      const [bonuses] = await connection.query(
        "SELECT * FROM bonuses WHERE driver_id = ? AND payment_id IS NULL AND (force_pay IS NULL OR force_pay = FALSE) FOR UPDATE",
        [id]
      );

      if (bonuses.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          message:
            "No eligible bonuses to release. Bonuses may have already been processed for partial payout.",
        });
      }

      // 3. Debt Sweep (Same logic as payment generation)
      // Check for active debts
      const [activeDebts] = await connection.query(
        "SELECT * FROM driver_debts WHERE driver_id = ? AND status = 'active' ORDER BY created_at ASC",
        [id]
      );

      let totalDeductedForDebts = 0;
      let currentRemainingDebts = JSON.parse(JSON.stringify(activeDebts)); // Deep copy tracking

      // We need to process bonuses one by one to record deductions accurately
      for (const bonus of bonuses) {
        let available = parseFloat(bonus.net_payout);

        // A. Deduction for Regular Debts
        if (currentRemainingDebts.length > 0) {
          for (const debt of currentRemainingDebts) {
            if (available <= 0) break;
            if (debt.remaining_amount <= 0) continue;

            const deduct = Math.min(
              parseFloat(debt.remaining_amount),
              available
            );
            available -= deduct;
            debt.remaining_amount -= deduct;
            totalDeductedForDebts += deduct;

            // Log Deduction
            await connection.query(
              "INSERT INTO bonus_deductions (bonus_id, debt_id, amount_deducted) VALUES (?, ?, ?)",
              [bonus.id, debt.id, deduct]
            );

            // Update Debt Record
            const status = debt.remaining_amount <= 0 ? "paid" : "active";
            await connection.query(
              "UPDATE driver_debts SET remaining_amount = ?, status = ? WHERE id = ?",
              [debt.remaining_amount, status, debt.id]
            );
          }
        }

        // B. Apply 30% Verification Penalty on REMAINING amount
        // If available is 0, no penalty (already consumed by debt)
        let penaltyAmount = 0;
        let finalPayout = available;

        if (available > 0) {
          penaltyAmount = available * 0.3; // 30% Penalty
          finalPayout = available - penaltyAmount;

          // Create Penalty Debt Record (Instant Payment)
          // We create a debt record purely for logging/history purposes
          const [penaltyDebtResult] = await connection.query(
            "INSERT INTO driver_debts (driver_id, amount, remaining_amount, reason, notes, created_by, status) VALUES (?, ?, 0, 'Verification Penalty', '30% deduction for unverified payout', ?, 'paid')",
            [id, penaltyAmount, req.user.id]
          );
          const penaltyDebtId = penaltyDebtResult.insertId;

          // Log Deduction
          await connection.query(
            "INSERT INTO bonus_deductions (bonus_id, debt_id, amount_deducted) VALUES (?, ?, ?)",
            [bonus.id, penaltyDebtId, penaltyAmount]
          );
        }

        // C. Update Bonus
        await connection.query(
          "UPDATE bonuses SET final_payout = ?, force_pay = TRUE WHERE id = ?",
          [finalPayout, bonus.id]
        );
      }

      await AuditService.log(
        req.user.id,
        "Partial Payout Release",
        "driver",
        id,
        {
          bonuses_count: bonuses.length,
          debt_deducted: totalDeductedForDebts,
        }
      );

      await connection.commit();
      res.json({
        success: true,
        message: "Partial payout released successfully.",
      });
    } catch (error) {
      await connection.rollback();
      console.error("Release payout error:", error);
      res.status(500).json({ message: "Internal server error" });
    } finally {
      connection.release();
    }
  },
};

module.exports = driverController;
