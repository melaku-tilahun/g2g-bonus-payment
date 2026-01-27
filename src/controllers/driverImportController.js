const pool = require("../config/database");
const driverExcelParser = require("../services/driverExcelParser");
const AuditService = require("../services/auditService");
const fs = require("fs");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const driverImportController = {
  importDrivers: catchAsync(async (req, res, next) => {
    if (!req.file) {
      throw new AppError("No file uploaded", 400);
    }

    const filePath = req.file.path;
    const connection = await pool.getConnection();
    let transactionStarted = false;

    try {
      const parsedData = await driverExcelParser.parse(filePath);

      if (parsedData.length === 0) {
        throw new AppError("Excel file contains no data rows.", 400);
      }

      await connection.beginTransaction();
      transactionStarted = true;

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const driverData of parsedData) {
        try {
          // Normalize phone
          const normalizePhone = (phone) => {
            if (!phone) return null;
            const digits = phone.toString().replace(/\D/g, "");
            return digits.length >= 9 ? digits.slice(-9) : digits;
          };

          const shortPhone = normalizePhone(driverData.phone_number);

          // 1. Insert or Ignore into drivers
          const [result] = await connection.query(
            `INSERT INTO drivers (
              driver_id, full_name, phone_number, tin, licence_number, 
              verified, is_telebirr_verified, verified_date, notes
            ) VALUES (?, ?, ?, ?, ?, 1, 1, NOW(), ?) 
            ON DUPLICATE KEY UPDATE 
              full_name = VALUES(full_name),
              phone_number = VALUES(phone_number),
              tin = VALUES(tin),
              licence_number = VALUES(licence_number),
              verified = 1,
              is_telebirr_verified = 1,
              notes = VALUES(notes)`,
            [
              driverData.driver_id,
              driverData.full_name,
              driverData.phone_number,
              driverData.tin,
              driverData.licence_number,
              driverData.notes ? JSON.stringify(driverData.notes) : null
            ]
          );

          // 2. Handle phone number in driver_phones
          if (shortPhone) {
             // Deactivate other numbers for this driver if we are setting a new "main" one?
             // For now, just ensure this one is active.
             await connection.query(
                `INSERT INTO driver_phones (driver_id, phone_number, status) 
                 VALUES (?, ?, 'active') 
                 ON DUPLICATE KEY UPDATE status = 'active'`,
                [driverData.driver_id, driverData.phone_number]
             );
          }

          successCount++;
        } catch (err) {
          errorCount++;
          errors.push({
            driver_id: driverData.driver_id,
            message: err.message
          });
        }
      }

      await AuditService.log(
        req.user.id,
        "initial import from old system",
        "driver_import",
        null,
        { 
          file: req.file.originalname, 
          success_count: successCount, 
          error_count: errorCount,
          errors: errors.slice(0, 10) // Log first 10 errors
        }
      );

      await connection.commit();

      res.json({
        success: true,
        message: `Import completed: ${successCount} successful, ${errorCount} failed.`,
        summary: {
          total: parsedData.length,
          success: successCount,
          failed: errorCount
        },
        errors: errors
      });

    } catch (error) {
      if (connection && transactionStarted) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  })
};

module.exports = driverImportController;
