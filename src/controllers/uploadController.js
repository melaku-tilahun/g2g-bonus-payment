const pool = require("../config/database");
const excelParser = require("../services/excelParser");
const AuditService = require("../services/auditService");
const path = require("path");
const fs = require("fs");

const uploadController = {
  validateExcel: async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;
    try {
      const validationResults = await excelParser.validate(filePath);
      res.json({
        success: true,
        ...validationResults,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    } finally {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  },

  importExcel: async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;
    const connection = await pool.getConnection();

    try {
      // 1. Parse file FIRST
      const parsedData = await excelParser.parse(filePath);

      if (parsedData.length === 0) {
        throw new Error("Excel file contains no data rows.");
      }

      // 2. Extract week_date
      const fileDate = parsedData[0].week_date;
      if (!fileDate) {
        throw new Error(
          "Could not determine Week Date from the Excel file. Please ensure the Date column is filled."
        );
      }
      const week_date = new Date(fileDate).toISOString().split("T")[0];

      await connection.beginTransaction();

      // Check duplicate import (File level)
      const [existingLogs] = await connection.query(
        "SELECT id FROM import_logs WHERE week_date = ? AND status IN ('success', 'partial') LIMIT 1",
        [week_date]
      );
      if (existingLogs.length > 0) {
        throw new Error(
          `Bonuses for date ${week_date} have already been imported.`
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
        ]
      );
      const importLogId = importLogResult.insertId;

      // 3. Pre-fetch Driver State (Strict Validation)
      const driverIds = parsedData.map((r) => r.driver_id).filter((id) => id);
      const driverStateMap = new Map();

      if (driverIds.length > 0) {
        // Fetch: Verified Status, Last Bonus Date, Pending Payment Count, Processing Payment Count
        const [states] = await connection.query(
          `
          SELECT 
            d.driver_id, 
            d.verified, 
            MAX(b.week_date) as last_bonus_date,
            (SELECT COUNT(*) FROM bonuses b2 WHERE b2.driver_id = d.driver_id AND b2.payment_id IS NULL) as pending_bonuses,
            (SELECT COUNT(*) FROM payments p WHERE p.driver_id = d.driver_id AND p.status = 'processing') as processing_payments
          FROM drivers d
          LEFT JOIN bonuses b ON d.driver_id = b.driver_id
          WHERE d.driver_id IN (?)
          GROUP BY d.driver_id
        `,
          [driverIds]
        );

        states.forEach((s) => driverStateMap.set(s.driver_id, s));
      }

      const errors = [];
      const newDriversToInsert = [];
      const bonusesToInsert = [];
      let newDriversCount = 0;

      for (const row of parsedData) {
        const rowErrorContext = `Row ${row.rowNumber} (Driver: ${row.driver_id})`;

        // Basic Parse Errors
        if (row.errors.length > 0) {
          errors.push({ row: row.rowNumber, message: row.errors.join(", ") });
          continue;
        }

        const driverState = driverStateMap.get(row.driver_id);

        if (!driverState) {
          // New Driver Case
          // Check for duplicates within the current file to prevent double insert errors
          if (!newDriversToInsert.find((d) => d[0] === row.driver_id)) {
            newDriversToInsert.push([
              row.driver_id,
              row.full_name,
              row.phone_number,
              0,
            ]);
            newDriversCount++;
          }
        } else {
          // Existing Driver Validation

          // A. Chronological Check
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

          // B. Verified Driver Blocking Logic
          if (driverState.verified) {
            if (
              driverState.pending_bonuses > 0 ||
              driverState.processing_payments > 0
            ) {
              errors.push({
                row: row.rowNumber,
                message: `BLOCKING: Verified driver has unpaid pending bonuses or processing payments. Previous cycle must be cleared first.`,
              });
            }
          }
        }

        // Add to bonus insert list (assuming it passes, if errors exist transaction will rollback anyway)
        const effectiveDate = new Date(week_date);
        bonusesToInsert.push([
          row.driver_id,
          effectiveDate,
          row.net_payout,
          row.work_terms,
          row.status,
          row.balance,
          row.payout,
          row.bank_fee,
          row.gross_payout,
          row.withholding_tax,
          importLogId,
        ]);
      }

      // 4. Final Verdict
      if (errors.length > 0) {
        await connection.rollback();
        // Update Log to Failed
        await connection.query(
          "UPDATE import_logs SET status = 'failed', error_count = ?, success_count = 0 WHERE id = ?",
          [errors.length, importLogId]
        );

        // Clean up file
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

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

      // 5. Execution (No Errors)

      // Insert New Drivers
      if (newDriversToInsert.length > 0) {
        await connection.query(
          "INSERT IGNORE INTO drivers (driver_id, full_name, phone_number, verified) VALUES ?",
          [newDriversToInsert]
        );
      }

      // Insert Bonuses
      if (bonusesToInsert.length > 0) {
        await connection.query(
          "INSERT INTO bonuses (driver_id, week_date, net_payout, work_terms, status, balance, payout, bank_fee, gross_payout, withholding_tax, import_log_id) VALUES ?",
          [bonusesToInsert]
        );
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
        ]
      );

      await AuditService.log(
        req.user.id,
        "Import Excel",
        "import_log",
        importLogId,
        { file: req.file.originalname, count: parsedData.length }
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Import success!",
        import_log_id: importLogId,
        week_date: week_date,
        summary: {
          total_records: parsedData.length,
          new_drivers_created: newDriversCount,
          success_count: parsedData.length,
        },
      });
    } catch (error) {
      if (connection) await connection.rollback();
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      console.error("Import Critical Error:", error);
      res.status(500).json({ success: false, message: error.message });
    } finally {
      if (connection) connection.release();
    }
  },

  getHistory: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT il.*, u.full_name as imported_by_name 
        FROM import_logs il 
        JOIN users u ON il.imported_by = u.id 
        ORDER BY il.imported_at DESC
      `);
      res.json(rows);
    } catch (error) {
      console.error("Get import history error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = uploadController;
