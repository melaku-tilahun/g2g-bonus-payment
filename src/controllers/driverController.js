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
        "(d.full_name LIKE ? OR d.driver_id LIKE ? OR d.phone_number LIKE ?)",
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
      queryParams,
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
      [...queryParams, limitNum, offset],
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
      [id],
    );
    if (rows.length === 0) {
      throw new AppError("Driver not found", 404);
    }

    // Fetch phone history
    const [phoneHistory] = await pool.query(
      `SELECT 
        dp.id,
        dp.phone_number,
        dp.status,
        dp.is_primary,
        dp.added_at,
        dp.valid_from,
        dp.valid_to,
        dp.rejection_reason,
        dp.reason,
        u.full_name as approved_by_name
       FROM driver_phones dp
       LEFT JOIN users u ON dp.approved_by = u.id
       WHERE dp.driver_id = ?
       ORDER BY dp.added_at DESC`,
      [id],
    );

    // Parse notes JSON (handle NULL gracefully)
    let notes = [];
    try {
      if (rows[0].notes) {
        notes =
          typeof rows[0].notes === "string"
            ? JSON.parse(rows[0].notes)
            : rows[0].notes;
      }
    } catch (e) {
      console.error("Error parsing driver notes:", e);
    }

    res.json({
      ...rows[0],
      phone_history: phoneHistory,
      notes: notes,
    });
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
      tin_ownership, // New field
    } = req.body;

    console.log(`Verifying driver ${id} by user ${req.user.id}`);

    // TIN is now MANDATORY for verification. Admin override removed as per requirements.
    if (!tin) {
      throw new AppError(
        "TIN is required for verification.",
        400,
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
      tin_verified_at: new Date(),
      tin_ownership: tin_ownership || 'Personal',
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
          tin_verified_at = ?,
          tin_ownership = ?
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
        updateFields.tin_ownership,
        id,
      ],
    );

    await AuditService.log(req.user.id, "Verify Driver", "driver", id, {
      verified_date: updateFields.verified_date,
      tin: updateFields.tin,
      business_name: updateFields.business_name,
      tin_ownership: updateFields.tin_ownership,
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
      "SELECT * FROM drivers ORDER BY created_at DESC",
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
      { reason },
    );

    res.json({
      success: true,
      message: `Driver ${is_blocked ? "blocked" : "unblocked"} successfully`,
    });
  }),

  createDriver: catchAsync(async (req, res, next) => {
    const { driver_id, full_name, phone_number, business_name, tin } = req.body;

    if (!driver_id || !full_name || !phone_number) {
      throw new AppError(
        "Driver ID, Full Name, and Phone Number are required",
        400,
      );
    }

    // Check if driver exists
    const [existing] = await pool.query(
      "SELECT id FROM drivers WHERE driver_id = ?",
      [driver_id],
    );

    if (existing.length > 0) {
      throw new AppError("Driver ID already exists", 400);
    }

    await pool.query(
      "INSERT INTO drivers (driver_id, full_name, phone_number, business_name, tin, verified) VALUES (?, ?, ?, ?, ?, FALSE)",
      [driver_id, full_name, phone_number, business_name || null, tin || null],
    );

    await AuditService.log(req.user.id, "Create Driver", "driver", driver_id, {
      full_name,
      phone_number,
    });

    res.status(201).json({
      success: true,
      message: "Driver created successfully",
    });
  }),

  updateDriver: catchAsync(async (req, res, next) => {
    const { id } = req.params; // This is the driver_id (string)
    const { full_name, phone_number, business_name, tin } = req.body;

    // We only allow updating basic info here.
    // Sensitive fields like verification status should handle by verify endpoint.

    await pool.query(
      "UPDATE drivers SET full_name = ?, phone_number = ?, business_name = ?, tin = ? WHERE driver_id = ?",
      [full_name, phone_number, business_name || null, tin || null, id],
    );

    await AuditService.log(req.user.id, "Update Driver", "driver", id, {
      full_name,
      phone_number,
    });

    res.json({
      success: true,
      message: "Driver updated successfully",
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
        [req.user.id],
      );
      const bcrypt = require("bcrypt");
      const isValid = await bcrypt.compare(password, users[0].password_hash);

      if (!isValid) {
        throw new AppError("Invalid password", 403);
      }

      await connection.beginTransaction();

      // 1.5. Check Telebirr Verification Status
      // Even if we bypass doc verification, we MUST have a verified payment method
      const [driverStatus] = await connection.query(
        "SELECT is_telebirr_verified FROM drivers WHERE driver_id = ?",
        [id],
      );

      if (driverStatus.length === 0) {
        throw new AppError("Driver not found", 404);
      }

      if (!driverStatus[0].is_telebirr_verified) {
        throw new AppError(
          "Driver must have a verified Telebirr account to process this payout.",
          400,
        );
      }

      // 2. Fetch Pending Bonuses (exclude already force-paid bonuses)
      const [bonuses] = await connection.query(
        "SELECT * FROM bonuses WHERE driver_id = ? AND payment_id IS NULL AND (is_unverified_payout IS NULL OR is_unverified_payout = FALSE) FOR UPDATE",
        [id],
      );

      if (bonuses.length === 0) {
        throw new AppError(
          "No eligible bonuses to release. Bonuses may have already been processed for partial payout.",
          400,
        );
      }

      // 3. Debt Sweep (Same logic as payment generation)
      // Check for active debts
      const [activeDebts] = await connection.query(
        "SELECT * FROM driver_debts WHERE driver_id = ? AND status = 'active' ORDER BY created_at ASC",
        [id],
      );

      let totalDeductedForDebts = 0;
      let currentRemainingDebts = JSON.parse(JSON.stringify(activeDebts)); // Deep copy tracking

      // We need to process bonuses one by one to record deductions accurately
      for (const bonus of bonuses) {
        // Calculate proper tax values
        const gross = parseFloat(bonus.gross_payout || 0);
        const currentTax = parseFloat(bonus.withholding_tax || 0);

        // Target: Total 30% tax on Gross (Only if > 10,000 ETB, same as standard)
        const totalTaxTarget =
          gross > 10000 ? Math.round(gross * 0.3 * 100) / 100 : 0;
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
              available,
            );
            available -= deduct;
            debt.remaining_amount -= deduct;
            totalDeductedForDebts += deduct;

            // Log Deduction
            await connection.query(
              "INSERT INTO bonus_deductions (bonus_id, debt_id, amount_deducted) VALUES (?, ?, ?)",
              [bonus.id, debt.id, deduct],
            );

            // Update Debt Record
            const status = debt.remaining_amount <= 0 ? "paid" : "active";
            await connection.query(
              "UPDATE driver_debts SET remaining_amount = ?, status = ? WHERE id = ?",
              [debt.remaining_amount, status, debt.id],
            );
          }
        }

        // B. Apply Additional Withholding Tax (27% or 0% if below threshold)
        // New Logic: Write to penalty_tax column directly. NO fake debt creation.
        
        // Log logic for debug/audit but do NOT create debt record
        if (additionalTaxNeeded > 0) {
             console.log(`Applying penalty tax of ${additionalTaxNeeded} to bonus ${bonus.id}`);
        }

        // C. Update Bonus with final numbers
        // We update withholding_tax to the total 30%
        // We set penalty_tax to the specific penalty amount
        await connection.query(
          "UPDATE bonuses SET withholding_tax = ?, penalty_tax = ?, final_payout = ?, is_unverified_payout = TRUE WHERE id = ?",
          [totalTaxTarget, additionalTaxNeeded, available, bonus.id],
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
        },
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

  verifyDriverPhone: catchAsync(async (req, res, next) => {
    const { id } = req.params; // driver_id
    const { phone_record_id, action, reason } = req.body;

    if (!phone_record_id || !action || !reason) {
      throw new AppError(
        "phone_record_id, action, and reason are required",
        400,
      );
    }

    if (!["approve", "reject"].includes(action)) {
      throw new AppError("action must be 'approve' or 'reject'", 400);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Get the phone record
      const [phoneRecords] = await connection.query(
        "SELECT * FROM driver_phones WHERE id = ? AND driver_id = ?",
        [phone_record_id, id],
      );

      if (phoneRecords.length === 0) {
        throw new AppError("Phone record not found for this driver", 404);
      }

      const phoneRecord = phoneRecords[0];

      if (action === "approve") {
        // Check uniqueness: Ensure no other driver has this phone as 'active'
        const [duplicates] = await connection.query(
          "SELECT driver_id FROM driver_phones WHERE phone_number = ? AND status = 'active' AND driver_id != ?",
          [phoneRecord.phone_number, id],
        );

        if (duplicates.length > 0) {
          throw new AppError(
            `Phone ${phoneRecord.phone_number} is already active for driver ${duplicates[0].driver_id}`,
            400,
          );
        }

        // 2. Deactivate current active phone
        await connection.query(
          "UPDATE driver_phones SET status = 'inactive', valid_to = NOW() WHERE driver_id = ? AND status = 'active'",
          [id],
        );

        // 3. Activate the selected phone
        await connection.query(
          "UPDATE driver_phones SET status = 'active', is_primary = TRUE, valid_from = NOW(), valid_to = NULL, approved_by = ?, reason = ? WHERE id = ?",
          [req.user.id, reason, phone_record_id],
        );

        // 4. Update driver table
        await connection.query(
          "UPDATE drivers SET phone_number = ?, is_telebirr_verified = TRUE WHERE driver_id = ?",
          [phoneRecord.phone_number, id],
        );

        // 5. Audit log
        await AuditService.log(req.user.id, "Approve Phone", "driver", id, {
          phone: phoneRecord.phone_number,
          reason: reason,
        });

        await connection.commit();
        res.json({
          success: true,
          message: "Phone number approved and driver verified",
        });
      } else if (action === "reject") {
        // Reject the phone
        await connection.query(
          "UPDATE driver_phones SET status = 'rejected', rejection_reason = ?, reason = ?, approved_by = ? WHERE id = ?",
          [reason, reason, req.user.id, phone_record_id],
        );

        // Check if driver has any active phone, if not, ensure they remain unverified
        const [activePhones] = await connection.query(
          "SELECT id FROM driver_phones WHERE driver_id = ? AND status = 'active'",
          [id],
        );

        if (activePhones.length === 0) {
          await connection.query(
            "UPDATE drivers SET is_telebirr_verified = FALSE WHERE driver_id = ?",
            [id],
          );
        }

        // Audit log
        await AuditService.log(req.user.id, "Reject Phone", "driver", id, {
          phone: phoneRecord.phone_number,
          reason: reason,
        });

        await connection.commit();
        res.json({
          success: true,
          message: "Phone number rejected",
        });
      }
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }),

  addNote: catchAsync(async (req, res, next) => {
    const { id } = req.params; // driver_id
    const { note } = req.body;

    // Validation
    if (!note || typeof note !== "string" || note.trim().length === 0) {
      throw new AppError("Note text is required", 400);
    }

    if (note.length > 1000) {
      throw new AppError("Note text must be 1000 characters or less", 400);
    }

    // Fetch current driver data
    const [rows] = await pool.query(
      "SELECT driver_id, notes FROM drivers WHERE driver_id = ?",
      [id],
    );

    if (rows.length === 0) {
      throw new AppError("Driver not found", 404);
    }

    // Parse existing notes
    let existingNotes = [];
    try {
      if (rows[0].notes) {
        existingNotes =
          typeof rows[0].notes === "string"
            ? JSON.parse(rows[0].notes)
            : rows[0].notes;
      }
    } catch (e) {
      console.error("Error parsing existing notes:", e);
      existingNotes = [];
    }

    // Fetch current user's full name
    const [userRows] = await pool.query(
      "SELECT full_name FROM users WHERE id = ?",
      [req.user.id],
    );
    const userFullName =
      userRows.length > 0 ? userRows[0].full_name : "Unknown";

    // Create new note object
    const newNote = {
      text: note.trim(),
      created_at: new Date().toISOString(),
      created_by: req.user.id,
      created_by_name: userFullName,
    };

    // Append to array
    existingNotes.push(newNote);

    // Update database
    await pool.query("UPDATE drivers SET notes = ? WHERE driver_id = ?", [
      JSON.stringify(existingNotes),
      id,
    ]);

    // Audit log
    await AuditService.log(req.user.id, "Add Driver Note", "driver", id, {
      note: note.trim().substring(0, 100), // Log first 100 chars
    });

    res.json({
      success: true,
      message: "Note added successfully",
      notes: existingNotes,
    });
  }),
};

module.exports = driverController;
