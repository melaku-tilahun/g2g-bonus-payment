const pool = require("../config/database");
const excelParser = require("../services/excelParser");
const AuditService = require("../services/auditService");
const path = require("path");
const fs = require("fs");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const importController = {
  validateExcel: catchAsync(async (req, res, next) => {
    if (!req.file) {
      throw new AppError("No file imported", 400);
    }

    const filePath = req.file.path;
    try {
      const validationResults = await excelParser.validate(filePath);
      res.json({
        success: true,
        ...validationResults,
      });
    } catch (error) {
      // Re-throw to be caught by catchAsync but mapped to AppError if it's not already
      if (!(error instanceof AppError)) {
        throw new AppError(error.message, 400);
      }
      throw error;
    } finally {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }),

  importExcel: catchAsync(async (req, res, next) => {
    if (!req.file) {
      throw new AppError("No file imported", 400);
    }

    const filePath = req.file.path;
    const connection = await pool.getConnection();
    let transactionStarted = false;

    try {
      // 1. Parse file FIRST
      const parsedData = await excelParser.parse(filePath);

      if (parsedData.length === 0) {
        throw new AppError("Excel file contains no data rows.", 400);
      }

      // 2. Extract week_date
      const fileDate = parsedData[0].week_date;
      if (!fileDate) {
        throw new AppError(
          "Could determine Week Date from the Excel file. Please ensure the Date column is filled.",
          400,
        );
      }
      const week_date = new Date(fileDate).toISOString().split("T")[0];

      await connection.beginTransaction();
      transactionStarted = true;

      // Check duplicate import (File level) & Processing Lock
      const [existingLogs] = await connection.query(
        "SELECT id, status FROM import_logs WHERE week_date = ? AND status IN ('success', 'partial', 'processing') LIMIT 1",
        [week_date],
      );
      if (existingLogs.length > 0) {
        const log = existingLogs[0];
        if (log.status === "processing") {
          throw new AppError(
            `Import for date ${week_date} is currently in progress. Please wait a few minutes and try again.`,
            409, // Conflict
          );
        }
        throw new AppError(
          `Bonuses for date ${week_date} have already been imported.`,
          400,
        );
      }

      // Create import log
      const [importLogResult] = await connection.query(
        "INSERT INTO import_logs (file_name, file_path, week_date, total_records, success_count, status, imported_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          req.file.originalname,
          req.file.filename,
          week_date,
          parsedData.length,
          0,
          "processing",
          req.user.id,
        ],
      );
      const importLogId = importLogResult.insertId;

      // 3. Pre-fetch Driver State (Strict Validation)
      const driverIds = parsedData.map((r) => r.driver_id).filter((id) => id);
      const driverStateMap = new Map();

      if (driverIds.length > 0) {
        // Fetch: Verified Status, Last Bonus Date, Pending Payment Count, Processing Payment Count, Phone Number
        const [states] = await connection.query(
          `
          SELECT 
            d.driver_id, 
            d.verified,
            d.phone_number,
            MAX(b.week_date) as last_bonus_date,
            (SELECT COUNT(*) FROM bonuses b2 WHERE b2.driver_id = d.driver_id AND b2.payment_id IS NULL) as pending_bonuses,
            (SELECT COUNT(*) FROM payments p WHERE p.driver_id = d.driver_id AND p.status = 'processing') as processing_payments
          FROM drivers d
          LEFT JOIN bonuses b ON d.driver_id = b.driver_id
          WHERE d.driver_id IN (?)
          GROUP BY d.driver_id
        `,
          [driverIds],
        );

        states.forEach((s) => driverStateMap.set(s.driver_id, s));
      }

      const errors = [];
      const warnings = [];
      const newDriversToInsert = [];
      const newDriverPhonesToInsert = []; // Batch new driver phones
      const bonusesToInsert = [];
      let newDriversCount = 0;

      // 0. Pre-check for Internal Duplicates (Duplicate Driver IDs in the same file)
      const seenDrivers = new Map(); // id -> rowNumber
      parsedData.forEach((row) => {
        if (!row.driver_id) return;
        if (seenDrivers.has(row.driver_id)) {
          const originalRow = seenDrivers.get(row.driver_id);
          errors.push({
            row: row.rowNumber,
            message: `Duplicate Driver ID: Matches Driver '${row.driver_id}' at Row ${originalRow}`,
          });
        } else {
          seenDrivers.set(row.driver_id, row.rowNumber);
        }
      });

      for (const row of parsedData) {
        const rowErrorContext = `Row ${row.rowNumber} (Driver: ${row.driver_id})`;

        // Basic Parse Errors
        if (row.errors.length > 0) {
          errors.push({ row: row.rowNumber, message: row.errors.join(", ") });
          continue;
        }

        const driverState = driverStateMap.get(row.driver_id);

        // Phone normalization helper
        const normalizePhone = (phone) => {
          if (!phone) return null;
          const digits = phone.toString().replace(/\D/g, "");
          return digits.length >= 9 ? digits.slice(-9) : digits;
        };

        const excelPhone = normalizePhone(row.phone_number);

        // 1. Duplicate Phone Check (Strict Block)
        if (excelPhone) {
          const [existingPhone] = await connection.query(
            "SELECT dp.driver_id FROM driver_phones dp WHERE dp.phone_number = ? AND dp.status = 'active' AND dp.driver_id != ?",
            [row.phone_number, row.driver_id],
          );
          if (existingPhone.length > 0) {
            errors.push({
              row: row.rowNumber,
              message: `Phone Duplicate: Phone '${row.phone_number}' is already active for driver ${existingPhone[0].driver_id}.`,
            });
            continue;
          }
        }

        if (!driverState) {
          // NEW DRIVER: Insert with unverified status
          if (!newDriversToInsert.find((d) => d[0] === row.driver_id)) {
            newDriversToInsert.push([
              row.driver_id,
              row.full_name,
              row.phone_number,
              0, // is_telebirr_verified = FALSE by default
            ]);
            newDriversCount++;

            // Queue phone as pending for new driver
            newDriverPhonesToInsert.push([
              row.driver_id,
              row.phone_number,
              "pending",
              importLogId,
            ]);
          }
        } else {
          // EXISTING DRIVER: Check for phone mismatch
          const dbPhone = normalizePhone(driverState.phone_number);

          if (dbPhone && excelPhone && dbPhone !== excelPhone) {
            // Phone mismatch detected: Add as pending
            const [existingPending] = await connection.query(
              "SELECT id FROM driver_phones WHERE driver_id = ? AND phone_number = ? AND status IN ('pending', 'active')",
              [row.driver_id, row.phone_number],
            );

            if (existingPending.length === 0) {
              // New pending number, insert it
              await connection.query(
                "INSERT INTO driver_phones (driver_id, phone_number, status, added_by_import_id) VALUES (?, ?, 'pending', ?)",
                [row.driver_id, row.phone_number, importLogId],
              );
            }

            // Flag driver as unverified
            await connection.query(
              "UPDATE drivers SET is_telebirr_verified = FALSE WHERE driver_id = ?",
              [row.driver_id],
            );
          }

          // B. Chronological Check
          if (driverState.last_bonus_date) {
            const lastDate = new Date(driverState.last_bonus_date);
            const newDate = new Date(week_date);
            if (newDate <= lastDate) {
              errors.push({
                row: row.rowNumber,
                message: `Date Error: Import date (${week_date}) is not after last recorded bonus (${
                  driverState.last_bonus_date.toISOString().split("T")[0]
                }).`,
              });
            }
          }
        }

        // Add to bonus insert list (assuming it passes, if errors exist transaction will rollback anyway)
        const effectiveDate = new Date(week_date);
        bonusesToInsert.push([
          row.driver_id,
          effectiveDate,
          row.calculated_net_payout,        // Index 2: Base payment (our 3% calculated net)
          row.work_terms,
          row.status,
          row.balance,
          row.fleet_gross_payout,           // Fleet gross (renamed from payout)
          row.fleet_withholding_tax,        // Fleet tax (renamed from bank_fee)
          row.calculated_gross_payout,      // Our gross (renamed from gross_payout)
          row.calculated_withholding_tax,   // Our tax (renamed from withholding_tax)
          importLogId,
          null,                             // Index 11: final_payout = NULL (no adjustments yet)
          row.fleet_net_payout,             // Index 12: Audit trail
        ]);
      }

      // 4. Final Verdict
      if (errors.length > 0) {
        await connection.rollback();
        // Update Log to Failed
        await connection.query(
          "UPDATE import_logs SET status = 'failed', error_count = ?, success_count = 0 WHERE id = ?",
          [errors.length, importLogId],
        );

        // Clean up file handled in finally

        return res.json({
          success: false,
          message: "Validation failed. No data imported.",
          errors: errors,
          summary: {
            total_records: parsedData.length,
            import_errors: errors.length,
          },
        });
      }

      // 4b. Warnings are non-blocking now (phone mismatches are handled automatically)
      // Remove the old confirmation flow

      // 5. Execution (No Errors)

      // Insert New Drivers
      if (newDriversToInsert.length > 0) {
        await connection.query(
          "INSERT IGNORE INTO drivers (driver_id, full_name, phone_number, verified) VALUES ?",
          [newDriversToInsert],
        );

        // Insert New Driver Phones (now that drivers exist)
        if (newDriverPhonesToInsert.length > 0) {
          await connection.query(
            "INSERT INTO driver_phones (driver_id, phone_number, status, added_by_import_id) VALUES ?",
            [newDriverPhonesToInsert],
          );
        }
      }

      // Insert Bonuses (with Debt Deduction)
      if (bonusesToInsert.length > 0) {
        // 1. Fetch Active Debts
        const driverIds = [...new Set(bonusesToInsert.map((b) => b[0]))];
        const [activeDebts] = await connection.query(
          "SELECT * FROM driver_debts WHERE driver_id IN (?) AND status = 'active' ORDER BY created_at ASC",
          [driverIds],
        );

        // Group debts
        const debtsMap = {};
        activeDebts.forEach((d) => {
          if (!debtsMap[d.driver_id]) debtsMap[d.driver_id] = [];
          debtsMap[d.driver_id].push({
            ...d,
            remaining_amount: parseFloat(d.remaining_amount),
          });
        });

        const deductionLogs = [];
        const debtUpdates = {};

        // 2. Apply Deductions
        for (const bonusRow of bonusesToInsert) {
          const dId = bonusRow[0];
          const calculatedNet = parseFloat(bonusRow[2]); // Use calculated_net from index 2

          if (debtsMap[dId]) {
            let available = calculatedNet;
            for (const debt of debtsMap[dId]) {
              if (available <= 0) break;
              if (debt.remaining_amount <= 0) continue;

              const deduct = Math.min(debt.remaining_amount, available);
              available -= deduct;
              debt.remaining_amount -= deduct;

              deductionLogs.push({
                driver_id: dId,
                debt_id: debt.id,
                amount: deduct,
              });

              debtUpdates[debt.id] = debt.remaining_amount;
            }
            bonusRow[11] = available; // Update final_payout
          }
        }

        // 3. Bulk Insert
        await connection.query(
          "INSERT INTO bonuses (driver_id, week_date, calculated_net_payout, work_terms, status, balance, fleet_gross_payout, fleet_withholding_tax, calculated_gross_payout, calculated_withholding_tax, import_log_id, final_payout, fleet_net_payout) VALUES ?",
          [bonusesToInsert],
        );

        // 4. Log Transactions & Update Debts
        if (deductionLogs.length > 0) {
          const [insertedBonuses] = await connection.query(
            "SELECT id, driver_id FROM bonuses WHERE import_log_id = ?",
            [importLogId],
          );

          const bonusIdMap = {};
          insertedBonuses.forEach((ib) => (bonusIdMap[ib.driver_id] = ib.id));

          const deductionValues = [];
          for (const log of deductionLogs) {
            const bonusId = bonusIdMap[log.driver_id];
            if (bonusId) {
              deductionValues.push([bonusId, log.debt_id, log.amount]);
            }
          }

          if (deductionValues.length > 0) {
            await connection.query(
              "INSERT INTO bonus_deductions (bonus_id, debt_id, amount_deducted) VALUES ?",
              [deductionValues],
            );
          }

          for (const [debtId, newAmount] of Object.entries(debtUpdates)) {
            const status = newAmount <= 0 ? "paid" : "active";
            await connection.query(
              "UPDATE driver_debts SET remaining_amount = ?, status = ? WHERE id = ?",
              [newAmount, status, debtId],
            );
          }
        }
      }

      // Success Log
      await connection.query(
        `UPDATE import_logs SET 
        success_count = ?, 
        status = 'success', 
        new_drivers_count = ?, 
        existing_drivers_count = ? 
        WHERE id = ?`,
        [
          parsedData.length,
          newDriversCount,
          parsedData.length - newDriversCount,
          importLogId,
        ],
      );

      await AuditService.log(
        req.user.id,
        "Import Excel",
        "import_log",
        importLogId,
        { file: req.file.originalname, count: parsedData.length },
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Import success!",
        import_log_id: importLogId,
        week_date: week_date,
        success_count: parsedData.length,
        skipped_count: 0,
        error_count: 0,
        summary: {
          total_records: parsedData.length,
          new_drivers_created: newDriversCount,
          success_count: parsedData.length,
        },
      });
    } catch (error) {
      if (connection && transactionStarted) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
      // File is now kept for history downloads
    }
  }),

  getHistory: catchAsync(async (req, res, next) => {
    const [rows] = await pool.query(`
        SELECT il.*, u.full_name as imported_by_name 
        FROM import_logs il 
        JOIN users u ON il.imported_by = u.id 
        ORDER BY il.imported_at DESC
      `);
    res.json(rows);
  }),
};

module.exports = importController;
