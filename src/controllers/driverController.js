const pool = require("../config/database");
const AuditService = require("../services/auditService");
const TINVerificationService = require("../services/tinVerificationService");
const fs = require("fs");
const path = require("path");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const driverController = {
  search: catchAsync(async (req, res, next) => {
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
  }),

  getById: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT d.*, u.full_name as verified_by_name 
         FROM drivers d 
         LEFT JOIN users u ON d.verified_by = u.id 
         WHERE d.driver_id = ?`,
      [id]
    );
    if (rows.length === 0) {
      throw new AppError("Driver not found", 404);
    }
    res.json(rows[0]);
  }),

  verify: catchAsync(async (req, res, next) => {
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
      throw new AppError(
        "TIN is required for verification. Admins can use override if needed.",
        400
      );
    }

    // Process photo if it's base64 (support both data URI and raw Base64)
    let photoPath = manager_photo || null;
    const isBase64 =
      manager_photo &&
      (manager_photo.startsWith("data:image") ||
        /^[A-Za-z0-9+/=]{100,}$/.test(manager_photo.substring(0, 200))); // Basic check for raw base64

    if (isBase64) {
      try {
        // Remove prefix if exists, or treat as raw
        const base64Data = manager_photo.includes("base64,")
          ? manager_photo.split("base64,")[1]
          : manager_photo;

        const buffer = Buffer.from(base64Data, "base64");
        const fileName = `driver_${id}_${Date.now()}.jpg`;
        const relativePath = `/imports/driver_photos/${fileName}`;
        const absolutePath = path.join(__dirname, "../../public", relativePath);

        // Ensure directory exists
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(absolutePath, buffer);
        photoPath = relativePath;
        console.log(`📸 Photo saved to: ${photoPath}`);
      } catch (photoError) {
        console.error("Error saving photo:", photoError);
        // Fallback to null or keep original if it's short enough,
        // but for 76kb raw strings, it's safer to null it if saving fails
        // to avoid DB ER_DATA_TOO_LONG error.
        photoPath = manager_photo.length > 500 ? null : manager_photo;
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
  }),

  lookupTIN: catchAsync(async (req, res, next) => {
    const { tin } = req.params;

    // Validate TIN format
    if (!TINVerificationService.validateTINFormat(tin)) {
      throw new AppError("Invalid TIN format. TIN should be 8-12 digits.", 400);
    }

    // Fetch business data from Ministry of Revenue API
    const businessData = await TINVerificationService.lookupTIN(tin);

    res.json({
      success: true,
      data: businessData,
    });
  }),

  getAll: catchAsync(async (req, res, next) => {
    const [rows] = await pool.query(
      "SELECT * FROM drivers ORDER BY created_at DESC"
    );
    res.json(rows);
  }),

  toggleBlockStatus: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { is_blocked, reason } = req.body;

    if (typeof is_blocked !== "boolean") {
      throw new AppError("is_blocked (boolean) is required", 400);
    }

    await pool.query("UPDATE drivers SET is_blocked = ? WHERE driver_id = ?", [
      is_blocked,
      id,
    ]);

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
  }),

  releaseUnverifiedPayout: catchAsync(async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
      const { id } = req.params;
      const { password } = req.body;

      // 1. Validate Admin Password (Security Check)
      // For this MVP, we will check against the current user's password.
      // In production, this should be more robust.
      if (!password) {
        throw new AppError("Password is required", 400);
      }

      // Check user password
      const [users] = await connection.query(
        "SELECT password_hash FROM users WHERE id = ?",
        [req.user.id]
      );
      const bcrypt = require("bcrypt");
      const isValid = await bcrypt.compare(password, users[0].password_hash);

      if (!isValid) {
        throw new AppError("Invalid password", 403);
      }

      await connection.beginTransaction();

      // 2. Fetch Pending Bonuses (exclude already force-paid bonuses)
      const [bonuses] = await connection.query(
        "SELECT * FROM bonuses WHERE driver_id = ? AND payment_id IS NULL AND (force_pay IS NULL OR force_pay = FALSE) FOR UPDATE",
        [id]
      );

      if (bonuses.length === 0) {
        throw new AppError(
          "No eligible bonuses to release. Bonuses may have already been processed for partial payout.",
          400
        );
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
        // Calculate proper tax values
        const gross = parseFloat(bonus.gross_payout || 0);
        const currentTax = parseFloat(bonus.withholding_tax || 0);

        // Target: Total 30% tax on Gross
        const totalTaxTarget = Math.round(gross * 0.3 * 100) / 100;
        const additionalTaxNeeded = Math.max(0, totalTaxTarget - currentTax);

        // Available for debts is 70% of Gross
        let available = Math.round((gross - totalTaxTarget) * 100) / 100;

        // A. Deduction for Regular Debts (from the 70% available)
        if (currentRemainingDebts.length > 0 && available > 0) {
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

        // B. Log the Additional Withholding Tax (27%)
        if (additionalTaxNeeded > 0) {
          // Create a record for the additional tax
          // We use the driver_debts table to track this deduction for clarity in history
          const [taxRecordResult] = await connection.query(
            "INSERT INTO driver_debts (driver_id, amount, remaining_amount, reason, notes, created_by, status) VALUES (?, ?, 0, 'Additional Withholding Tax', 'Increased from 3% to 30% for unverified payout', ?, 'paid')",
            [id, additionalTaxNeeded, req.user.id]
          );
          const taxRecordId = taxRecordResult.insertId;

          // Log Deduction
          await connection.query(
            "INSERT INTO bonus_deductions (bonus_id, debt_id, amount_deducted) VALUES (?, ?, ?)",
            [bonus.id, taxRecordId, additionalTaxNeeded]
          );
        }

        // C. Update Bonus with final numbers
        // We update withholding_tax to the total 30% for proper reporting
        await connection.query(
          "UPDATE bonuses SET withholding_tax = ?, final_payout = ?, force_pay = TRUE WHERE id = ?",
          [totalTaxTarget, available, bonus.id]
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
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }),
};

module.exports = driverController;
