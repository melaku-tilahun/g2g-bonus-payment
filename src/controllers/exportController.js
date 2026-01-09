const pool = require("../config/database");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs").promises;

/**
 * Export Controller
 * Handles data exports and backup operations
 */
const exportController = {
  /**
   * Export Drivers
   * @route POST /api/export/drivers
   */
  exportDrivers: async (req, res) => {
    try {
      const { filters = {} } = req.body;

      // Build query based on filters
      let whereConditions = [];
      const params = [];

      if (filters.verified !== undefined) {
        whereConditions.push("d.verified = ?");
        params.push(filters.verified);
      }

      if (filters.is_blocked !== undefined) {
        whereConditions.push("d.is_blocked = ?");
        params.push(filters.is_blocked);
      }

      const whereClause =
        whereConditions.length > 0
          ? "WHERE " + whereConditions.join(" AND ")
          : "";

      // Get drivers with bonus totals
      const [drivers] = await pool.query(
        `SELECT 
          d.*,
          COUNT(b.id) as total_bonuses,
          SUM(COALESCE(b.final_payout, b.net_payout)) as total_earnings,
          SUM(CASE WHEN b.payment_id IS NULL THEN COALESCE(b.final_payout, b.net_payout) ELSE 0 END) as pending_amount
         FROM drivers d
         LEFT JOIN bonuses b ON d.driver_id = b.driver_id
         ${whereClause}
         GROUP BY d.id
         ORDER BY d.created_at DESC`,
        params
      );

      // Create Excel file
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Drivers");

      // Define columns
      sheet.columns = [
        { header: "Driver ID", key: "driver_id", width: 35 },
        { header: "Full Name", key: "full_name", width: 30 },
        { header: "Phone", key: "phone_number", width: 15 },
        { header: "TIN", key: "tin", width: 20 },
        { header: "Business Name", key: "business_name", width: 30 },
        { header: "Verified", key: "verified", width: 10 },
        { header: "Blocked", key: "is_blocked", width: 10 },
        { header: "Total Bonuses", key: "total_bonuses", width: 15 },
        { header: "Total Earnings", key: "total_earnings", width: 15 },
        { header: "Pending Amount", key: "pending_amount", width: 15 },
        { header: "Created At", key: "created_at", width: 20 },
      ];

      // Style header
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      // Add data
      drivers.forEach((driver) => {
        sheet.addRow({
          driver_id: driver.driver_id,
          full_name: driver.full_name,
          phone_number: driver.phone_number || "",
          tin: driver.tin || "",
          business_name: driver.business_name || "",
          verified: driver.verified ? "Yes" : "No",
          is_blocked: driver.is_blocked ? "Yes" : "No",
          total_bonuses: driver.total_bonuses || 0,
          total_earnings: parseFloat(driver.total_earnings || 0).toFixed(2),
          pending_amount: parseFloat(driver.pending_amount || 0).toFixed(2),
          created_at: driver.created_at,
        });
      });

      // Set response headers
      const filename = `drivers_export_${Date.now()}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Export drivers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Export Payments
   * @route POST /api/export/payments
   */
  exportPayments: async (req, res) => {
    try {
      const { filters = {} } = req.body;

      // Build query based on filters
      let whereConditions = [];
      const params = [];

      if (filters.status) {
        whereConditions.push("p.status = ?");
        params.push(filters.status);
      }

      if (filters.start_date && filters.end_date) {
        whereConditions.push("p.payment_date BETWEEN ? AND ?");
        params.push(filters.start_date, filters.end_date);
      }

      const whereClause =
        whereConditions.length > 0
          ? "WHERE " + whereConditions.join(" AND ")
          : "";

      // Get payments
      const [payments] = await pool.query(
        `SELECT 
          p.*,
          d.full_name as driver_name,
          d.phone_number,
          d.tin,
          u.full_name as processed_by_name
         FROM payments p
         LEFT JOIN drivers d ON p.driver_id = d.driver_id
         LEFT JOIN users u ON p.processed_by = u.id
         ${whereClause}
         ORDER BY p.payment_date DESC`,
        params
      );

      // Create Excel file
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Payments");

      // Define columns
      sheet.columns = [
        { header: "Payment ID", key: "id", width: 10 },
        { header: "Driver ID", key: "driver_id", width: 35 },
        { header: "Driver Name", key: "driver_name", width: 30 },
        { header: "Phone", key: "phone_number", width: 15 },
        { header: "TIN", key: "tin", width: 20 },
        { header: "Amount", key: "total_amount", width: 15 },
        { header: "Payment Method", key: "payment_method", width: 20 },
        { header: "Status", key: "status", width: 15 },
        { header: "Batch ID", key: "batch_id", width: 20 },
        { header: "Payment Date", key: "payment_date", width: 20 },
        { header: "Processed By", key: "processed_by_name", width: 25 },
        { header: "Notes", key: "notes", width: 30 },
      ];

      // Style header
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      // Add data
      payments.forEach((payment) => {
        sheet.addRow({
          id: payment.id,
          driver_id: payment.driver_id,
          driver_name: payment.driver_name || "",
          phone_number: payment.phone_number || "",
          tin: payment.tin || "",
          total_amount: parseFloat(payment.total_amount).toFixed(2),
          payment_method: payment.payment_method || "",
          status: payment.status,
          batch_id: payment.batch_id || "",
          payment_date: payment.payment_date,
          processed_by_name: payment.processed_by_name || "",
          notes: payment.notes || "",
        });
      });

      // Set response headers
      const filename = `payments_export_${Date.now()}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Export payments error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Export Audit Logs
   * @route POST /api/export/audit-logs
   */
  exportAuditLogs: async (req, res) => {
    try {
      const { filters = {} } = req.body;

      // Build query based on filters
      let whereConditions = [];
      const params = [];

      if (filters.user_id) {
        whereConditions.push("al.user_id = ?");
        params.push(filters.user_id);
      }

      if (filters.start_date && filters.end_date) {
        whereConditions.push("al.created_at BETWEEN ? AND ?");
        params.push(filters.start_date, filters.end_date);
      }

      const whereClause =
        whereConditions.length > 0
          ? "WHERE " + whereConditions.join(" AND ")
          : "";

      // Get audit logs
      const [logs] = await pool.query(
        `SELECT 
          al.*,
          u.full_name as user_name,
          u.email as user_email
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ${whereClause}
         ORDER BY al.created_at DESC
         LIMIT 10000`,
        params
      );

      // Create Excel file
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Audit Logs");

      // Define columns
      sheet.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "User", key: "user_name", width: 25 },
        { header: "Email", key: "user_email", width: 30 },
        { header: "Action", key: "action", width: 30 },
        { header: "Entity Type", key: "entity_type", width: 20 },
        { header: "Entity ID", key: "entity_id", width: 35 },
        { header: "IP Address", key: "ip_address", width: 15 },
        { header: "Timestamp", key: "created_at", width: 20 },
      ];

      // Style header
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      // Add data
      logs.forEach((log) => {
        sheet.addRow({
          id: log.id,
          user_name: log.user_name || "System",
          user_email: log.user_email || "",
          action: log.action,
          entity_type: log.entity_type || "",
          entity_id: log.entity_id || "",
          ip_address: log.ip_address || "",
          created_at: log.created_at,
        });
      });

      // Set response headers
      const filename = `audit_logs_export_${Date.now()}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Export audit logs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Create Database Backup
   * @route POST /api/export/backup
   */
  createBackup: async (req, res) => {
    try {
      // This is a placeholder - actual backup should use mysqldump or similar
      // For now, we'll export key tables to Excel as a backup

      const workbook = new ExcelJS.Workbook();

      // Export drivers
      const [drivers] = await pool.query(
        "SELECT * FROM drivers ORDER BY created_at DESC LIMIT 5000"
      );
      const driversSheet = workbook.addWorksheet("Drivers");
      if (drivers.length > 0) {
        driversSheet.columns = Object.keys(drivers[0]).map((key) => ({
          header: key,
          key: key,
          width: 20,
        }));
        driversSheet.addRows(drivers);
      }

      // Export bonuses
      const [bonuses] = await pool.query(
        "SELECT * FROM bonuses ORDER BY week_date DESC LIMIT 5000"
      );
      const bonusesSheet = workbook.addWorksheet("Bonuses");
      if (bonuses.length > 0) {
        bonusesSheet.columns = Object.keys(bonuses[0]).map((key) => ({
          header: key,
          key: key,
          width: 20,
        }));
        bonusesSheet.addRows(bonuses);
      }

      // Export payments
      const [payments] = await pool.query(
        "SELECT * FROM payments ORDER BY payment_date DESC LIMIT 5000"
      );
      const paymentsSheet = workbook.addWorksheet("Payments");
      if (payments.length > 0) {
        paymentsSheet.columns = Object.keys(payments[0]).map((key) => ({
          header: key,
          key: key,
          width: 20,
        }));
        paymentsSheet.addRows(payments);
      }

      // Set response headers
      const filename = `database_backup_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Create backup error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = exportController;
