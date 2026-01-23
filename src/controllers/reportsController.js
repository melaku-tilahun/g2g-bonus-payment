const pool = require("../config/database");
const ReportGenerator = require("../services/reportGenerator");
const AuditService = require("../services/auditService");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

/**
 * Reports Controller
 * Handles compliance reports, scheduled reports, and report generation
 */
const reportsController = {
  /**
   * Get Withholding Tax Report
   * @route GET /api/reports/withholding-tax
   */
  getWithholdingTaxReport: catchAsync(async (req, res, next) => {
    const { start_date, end_date, format = "json" } = req.query;

    // Build date filter
    let dateFilter = "";
    const params = [];
    if (start_date && end_date) {
      dateFilter = "WHERE b.week_date BETWEEN ? AND ?";
      params.push(start_date, end_date);
    }

    // Get tax data
    // Detailed Report: List individual transactions
    const [taxData] = await pool.query(
      `SELECT 
          d.driver_id,
          d.full_name,
          d.tin,
          d.business_name,
          b.week_date,
          b.gross_payout,
          b.withholding_tax,
          b.net_payout
         FROM drivers d
         JOIN bonuses b ON d.driver_id = b.driver_id
         JOIN payments p ON b.payment_id = p.id
         ${dateFilter}
         ${dateFilter ? "AND" : "WHERE"} p.status = 'paid'
         ORDER BY b.week_date DESC, d.full_name ASC`,
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
          (sum, row) => sum + parseFloat(row.withholding_tax),
          0
        ),
        data: taxData,
      });
    }

    await AuditService.log(req.user.id, "Generate Report", "report", null, {
      type: "Withholding Tax",
      format,
      start_date,
      end_date,
    });
  }),

  /**
   * Get Compliance Summary (KPIs)
   * @route GET /api/reports/compliance-summary
   */
  getComplianceSummary: catchAsync(async (req, res, next) => {
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

    // 3. Compliance Exception Stats (70% payouts)
    const [exceptionRows] = await pool.query(
      `SELECT 
          COUNT(*) as exception_count,
          SUM(final_payout) as exception_total_amount
         FROM bonuses 
         WHERE is_unverified_payout = TRUE AND payment_id IS NOT NULL`
    );

    res.json({
      success: true,
      summary: {
        total_tax_collected: parseFloat(taxRows[0].total_tax || 0).toFixed(2),
        verification_stats: verificationRows[0],
        exception_stats: {
          count: exceptionRows[0].exception_count || 0,
          total_amount: parseFloat(exceptionRows[0].exception_total_amount || 0).toFixed(2)
        }
      },
    });
  }),

  getTINVerificationLog: catchAsync(async (req, res, next) => {
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
      const filename = await ReportGenerator.generateTINVerificationExcel(logs);
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

    await AuditService.log(req.user.id, "Generate Report", "report", null, {
      type: "TIN Verifications",
      format,
      start_date,
      end_date,
    });
  }),

  /**
   * Generate Driver Statement (PDF)
   * @route GET /api/reports/driver-statement/:driverId
   */
  generateDriverStatement: catchAsync(async (req, res, next) => {
    const { driverId } = req.params;
    const { start_date, end_date } = req.query;

    // Get driver info
    const [drivers] = await pool.query(
      "SELECT * FROM drivers WHERE driver_id = ?",
      [driverId]
    );

    if (drivers.length === 0) {
      throw new AppError("Driver not found", 404);
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

    await AuditService.log(req.user.id, "Generate Report", "report", null, {
      type: "Driver Statement",
      driver_id: driverId,
      format: "pdf",
    });
  }),

  /**
   * Get Report Schedules
   * @route GET /api/reports/schedules
   */
  getSchedules: catchAsync(async (req, res, next) => {
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
  }),

  /**
   * Create Report Schedule
   * @route POST /api/reports/schedules
   */
  createSchedule: catchAsync(async (req, res, next) => {
    const { name, report_type, frequency, recipients, parameters } = req.body;

    // Validate
    if (!name || !report_type || !frequency || !recipients) {
      throw new AppError("Missing required fields", 400);
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
  }),

  /**
   * Update Report Schedule
   * @route PUT /api/reports/schedules/:id
   */
  updateSchedule: catchAsync(async (req, res, next) => {
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
      throw new AppError("No updates provided", 400);
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
  }),

  /**
   * Delete Report Schedule
   * @route DELETE /api/reports/schedules/:id
   */
  deleteSchedule: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    await pool.query("DELETE FROM report_schedules WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "Schedule deleted successfully",
    });
  }),
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
