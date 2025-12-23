const pool = require('../config/database');
const excelParser = require('../services/excelParser');
const AuditService = require('../services/auditService');
const path = require('path');
const fs = require('fs');

const uploadController = {
  validateExcel: async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    try {
      const validationResults = await excelParser.validate(filePath);
      res.json({
        success: true,
        ...validationResults
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    } finally {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  },

  importExcel: async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { week_date } = req.body;
    if (!week_date) {
        return res.status(400).json({ message: 'Week date is required for import' });
    }

    const filePath = req.file.path;
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const parsedData = await excelParser.parse(filePath);
      
      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let newDriversCount = 0;
      let existingDriversCount = 0;
      const skippedDetails = [];
      const errors = [];

      // Create import log entry first to get ID
      const [importLogResult] = await connection.query(
        'INSERT INTO import_logs (file_name, week_date, total_records, success_count, imported_by) VALUES (?, ?, ?, ?, ?)',
        [req.file.originalname, week_date, parsedData.length, 0, req.user.id]
      );
      const importLogId = importLogResult.insertId;

      // Batch processing Setup
      const driverIds = parsedData.map(r => r.driver_id);
      const [existingDrivers] = await connection.query('SELECT driver_id, verified FROM drivers WHERE driver_id IN (?)', [driverIds]);
      const driverMap = new Map(existingDrivers.map(d => [d.driver_id, d]));

      const bonusesToInsert = [];
      const newDriversToInsert = [];

      for (const row of parsedData) {
        if (row.errors.length > 0) {
          errorCount++;
          errors.push({ row: row.rowNumber, message: row.errors.join(', ') });
          continue;
        }

        const driver = driverMap.get(row.driver_id);
        
        if (!driver) {
          // New driver
          newDriversToInsert.push([row.driver_id, row.full_name, row.phone_number]);
          newDriversCount++;
          // Add to map so next rows for same driver see it as existing (but unverified)
          driverMap.set(row.driver_id, { driver_id: row.driver_id, verified: false });
        } else if (driver.verified) {
          skippedCount++;
          skippedDetails.push({ driver_id: row.driver_id, name: row.full_name, reason: 'Driver is verified' });
          continue;
        } else {
            existingDriversCount++;
        }

        bonusesToInsert.push([row.driver_id, new Date(row.week_date || week_date), row.net_payout, importLogId]);
      }

      // Batch Insert Drivers
      if (newDriversToInsert.length > 0) {
          await connection.query(
              'INSERT IGNORE INTO drivers (driver_id, full_name, phone_number) VALUES ?',
              [newDriversToInsert]
          );
      }

      // Batch Insert Bonuses
      if (bonusesToInsert.length > 0) {
          try {
              await connection.query(
                  'INSERT IGNORE INTO bonuses (driver_id, week_date, net_payout, import_log_id) VALUES ?',
                  [bonusesToInsert]
              );
              successCount = bonusesToInsert.length;
          } catch (err) {
              console.error('Batch bonus insert error:', err);
              throw err;
          }
      }

      // Update import log with stats
      await connection.query(
        `UPDATE import_logs SET 
            success_count = ?, 
            skipped_count = ?, 
            error_count = ?, 
            new_drivers_count = ?, 
            existing_drivers_count = ?,
            rejected_verified_count = ?,
            skipped_details = ?, 
            status = ? 
         WHERE id = ?`,
        [
          successCount, 
          skippedCount, 
          errorCount, 
          newDriversCount,
          existingDriversCount,
          skippedCount,
          JSON.stringify(skippedDetails), 
          errorCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failed'),
          importLogId
        ]
      );

      await AuditService.log(req.user.id, 'Import Excel', 'import_log', importLogId, { 
          file_name: req.file.originalname, 
          success: successCount, 
          skipped: skippedCount, 
          errors: errorCount,
          new_drivers: newDriversCount
      });

      await connection.commit();

      res.json({
        import_log_id: importLogId,
        file_name: req.file.originalname,
        week_date: week_date,
        total_records: parsedData.length,
        success_count: successCount,
        skipped_count: skippedCount,
        error_count: errorCount,
        skipped_details: skippedDetails,
        errors: errors,
        summary: {
            new_drivers_created: newDriversCount,
            existing_drivers_updated: existingDriversCount,
            verified_drivers_skipped: skippedCount,
            import_errors: errorCount
        }
      });

    } catch (error) {
      await connection.rollback();
      console.error('Import error:', error);
      res.status(500).json({ message: error.message || 'Internal server error' });
    } finally {
      connection.release();
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
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
      console.error('Get import history error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};

module.exports = uploadController;
