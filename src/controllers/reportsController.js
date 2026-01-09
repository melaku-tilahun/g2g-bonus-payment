const pool = require("../config/database");
const ReportGenerator = require("../services/reportGenerator");

/**
 * Reports Controller
 * Handles compliance reports, scheduled reports, and report generation
 */
const reportsController = {
  /**
   * Get Withholding Tax Report
   * @route GET /api/reports/withholding-tax
   */
  getWithholdingTaxReport: async (req, res) => {
    try {
      const { start_date, end_date, format = "json" } = req.query;

      // Build date filter
      let dateFilter = "";
      const params = [];
      if (start_date && end_date) {
        dateFilter = "WHERE b.week_date BETWEEN ? AND ?";
        params.push(start_date, end_date);
      }

      // Get tax data
      const [taxData] = await pool.query(
        `SELECT 
          d.driver_id,
          d.full_name,
          d.tin,
          d.business_name,
          SUM(b.gross_payout) as total_gross,
          SUM(b.withholding_tax) as total_tax,
          SUM(b.net_payout) as total_net,
          COUNT(b.id) as payment_count,
          MIN(b.week_date) as first_payment_date,
          MAX(b.week_date) as last_payment_date
         FROM drivers d
         JOIN bonuses b ON d.driver_id = b.driver_id
         ${dateFilter}
         GROUP BY d.driver_id, d.full_name, d.tin, d.business_name
         HAVING total_tax > 0
         ORDER BY total_tax DESC`,
        params
      );

      if (format === "excel") {
        // Generate Excel file
        const filename = await ReportGenerator.generateWithholdingTaxExcel(
          taxData
        );
        res.download(filename);
      } else {
        res.json({
          success: true,
          report_type: "withholding_tax",
          start_date,
          end_date,
          total_records: taxData.length,
          total_tax_collected: taxData.reduce(
            (sum, row) => sum + parseFloat(row.total_tax),
            0
          ),
          data: taxData,
        });
      }
    } catch (error) {
      console.error("Get withholding tax report error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get Compliance Summary (KPIs)
   * @route GET /api/reports/compliance-summary
   */
  getComplianceSummary: async (req, res) => {
    try {
      // 1. Total Tax Withheld (All time)
      const [taxRows] = await pool.query(
        "SELECT SUM(withholding_tax) as total_tax FROM bonuses"
      );

      // 2. Driver Verification Stats
      const [verificationRows] = await pool.query(
        `SELECT 
          COUNT(*) as total_drivers,
          SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified_drivers,
          SUM(CASE WHEN verified = 0 THEN 1 ELSE 0 END) as unverified_drivers
         FROM drivers`
      );

      // 3. Pending TIN Verifications (Unverified drivers with a TIN)
      const [pendingRows] = await pool.query(
        "SELECT COUNT(*) as pending FROM drivers WHERE verified = 0 AND tin IS NOT NULL AND tin != ''"
      );

      // 4. Recent Compliance Alerts (e.g., failed verifications in last 7 days)
      const [alertRows] = await pool.query(
        `SELECT COUNT(*) as recent_alerts 
         FROM audit_logs 
         WHERE (action LIKE '%FAIL%' OR action LIKE '%REJECT%') 
         AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
      );

      res.json({
        success: true,
        summary: {
          total_tax_collected: parseFloat(taxRows[0].total_tax || 0).toFixed(2),
          verification_stats: verificationRows[0],
          pending_verifications: pendingRows[0].pending,
          recent_alerts: alertRows[0].recent_alerts,
        },
      });
    } catch (error) {
      console.error("Get compliance summary error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getTINVerificationLog: async (req, res) => {
    try {
      const { start_date, end_date, format = "json" } = req.query;

      // Get TIN verification logs from audit_logs
      let dateFilter = "";
      const params = [];
      if (start_date && end_date) {
        dateFilter = "AND al.created_at BETWEEN ? AND ?";
        params.push(start_date, end_date);
      }

      const [logs] = await pool.query(
        `SELECT 
          al.*,
          d.driver_id,
          d.full_name,
          d.tin,
          d.verified,
          u.full_name as verified_by_name
         FROM audit_logs al
         LEFT JOIN drivers d ON al.entity_id = d.driver_id
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.action LIKE '%TIN%' OR al.action LIKE '%VERIF%'
         ${dateFilter}
         ORDER BY al.created_at DESC`,
        params
      );

      if (format === "excel") {
        const filename = await ReportGenerator.generateTINVerificationExcel(
          logs
        );
        res.download(filename);
      } else {
        res.json({
          success: true,
          report_type: "tin_verification",
          start_date,
          end_date,
          total_verifications: logs.length,
          data: logs,
        });
      }
    } catch (error) {
      console.error("Get TIN verification log error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Generate Driver Statement (PDF)
   * @route GET /api/reports/driver-statement/:driverId
   */
  generateDriverStatement: async (req, res) => {
    try {
      const { driverId } = req.params;
      const { start_date, end_date } = req.query;

      // Get driver info
      const [drivers] = await pool.query(
        "SELECT * FROM drivers WHERE driver_id = ?",
        [driverId]
      );

      if (drivers.length === 0) {
        return res.status(404).json({ message: "Driver not found" });
      }

      const driver = drivers[0];

      // Get bonuses
      let dateFilter = "";
      const params = [driverId];
      if (start_date && end_date) {
        dateFilter = "AND b.week_date BETWEEN ? AND ?";
        params.push(start_date, end_date);
      }

      const [bonuses] = await pool.query(
        `SELECT 
          b.*,
          p.payment_date,
          p.payment_method,
          p.status as payment_status
         FROM bonuses b
         LEFT JOIN payments p ON b.payment_id = p.id
         WHERE b.driver_id = ? ${dateFilter}
         ORDER BY b.week_date DESC`,
        params
      );

      // Get debt summary
      const [debts] = await pool.query(
        `SELECT 
          SUM(dd.amount) as total_debt,
          SUM(dd.amount - dd.remaining_amount) as total_paid,
          SUM(dd.remaining_amount) as outstanding
         FROM driver_debts dd
         WHERE dd.driver_id = ? AND dd.status = 'active'`,
        [driverId]
      );

      // Generate PDF
      const filename = await ReportGenerator.generateDriverStatementPDF(
        driver,
        bonuses,
        debts[0]
      );

      res.download(filename, `statement_${driverId}_${Date.now()}.pdf`);
    } catch (error) {
      console.error("Generate driver statement error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get Report Schedules
   * @route GET /api/reports/schedules
   */
  getSchedules: async (req, res) => {
    try {
      const [schedules] = await pool.query(
        `SELECT rs.*, u.full_name as created_by_name
         FROM report_schedules rs
         LEFT JOIN users u ON rs.created_by = u.id
         ORDER BY rs.created_at DESC`
      );

      res.json({
        success: true,
        schedules,
      });
    } catch (error) {
      console.error("Get schedules error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Create Report Schedule
   * @route POST /api/reports/schedules
   */
  createSchedule: async (req, res) => {
    try {
      const { name, report_type, frequency, recipients, parameters } = req.body;

      // Validate
      if (!name || !report_type || !frequency || !recipients) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Calculate next run time
      const nextRun = calculateNextRun(frequency);

      const [result] = await pool.query(
        `INSERT INTO report_schedules 
         (name, report_type, frequency, recipients, parameters, next_run, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          report_type,
          frequency,
          JSON.stringify(recipients),
          parameters ? JSON.stringify(parameters) : null,
          nextRun,
          req.user.id,
        ]
      );

      res.json({
        success: true,
        message: "Schedule created successfully",
        schedule_id: result.insertId,
        next_run: nextRun,
      });
    } catch (error) {
      console.error("Create schedule error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Update Report Schedule
   * @route PUT /api/reports/schedules/:id
   */
  updateSchedule: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, frequency, recipients, parameters, is_active } = req.body;

      const updates = [];
      const params = [];

      if (name) {
        updates.push("name = ?");
        params.push(name);
      }
      if (frequency) {
        updates.push("frequency = ?");
        params.push(frequency);

        // Recalculate next run if frequency changed
        const nextRun = calculateNextRun(frequency);
        updates.push("next_run = ?");
        params.push(nextRun);
      }
      if (recipients) {
        updates.push("recipients = ?");
        params.push(JSON.stringify(recipients));
      }
      if (parameters !== undefined) {
        updates.push("parameters = ?");
        params.push(parameters ? JSON.stringify(parameters) : null);
      }
      if (is_active !== undefined) {
        updates.push("is_active = ?");
        params.push(is_active);
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      params.push(id);

      await pool.query(
        `UPDATE report_schedules SET ${updates.join(", ")} WHERE id = ?`,
        params
      );

      res.json({
        success: true,
        message: "Schedule updated successfully",
      });
    } catch (error) {
      console.error("Update schedule error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Delete Report Schedule
   * @route DELETE /api/reports/schedules/:id
   */
  deleteSchedule: async (req, res) => {
    try {
      const { id } = req.params;

      await pool.query("DELETE FROM report_schedules WHERE id = ?", [id]);

      res.json({
        success: true,
        message: "Schedule deleted successfully",
      });
    } catch (error) {
      console.error("Delete schedule error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

/**
 * Helper: Calculate next run time based on frequency
 */
function calculateNextRun(frequency) {
  const now = new Date();
  let nextRun = new Date(now);

  switch (frequency) {
    case "daily":
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(0, 0, 0, 0); // Midnight
      break;
    case "weekly":
      nextRun.setDate(nextRun.getDate() + 7);
      nextRun.setHours(0, 0, 0, 0); // Midnight Monday
      break;
    case "monthly":
      nextRun.setMonth(nextRun.getMonth() + 1);
      nextRun.setDate(1); // First day of month
      nextRun.setHours(0, 0, 0, 0); // Midnight
      break;
    default:
      nextRun.setDate(nextRun.getDate() + 1);
  }

  return nextRun;
}

module.exports = reportsController;
