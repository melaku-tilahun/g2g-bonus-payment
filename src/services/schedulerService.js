const cron = require("node-cron");
const pool = require("../config/database");
const fs = require("fs");
const ReportGenerator = require("./reportGenerator");
const EmailService = require("./emailService");

/**
 * Scheduler Service
 * Handles scheduled report execution
 */
class SchedulerService {
  /**
   * Initialize the scheduler with cron jobs
   */
  static init() {
    console.log("Initializing Scheduler Service...");

    // Check for scheduled reports every hour
    cron.schedule("0 * * * *", async () => {
      console.log("Checking for scheduled reports...");
      await this.checkScheduledReports();
    });

    console.log("Scheduler Service initialized");
  }

  /**
   * Check and execute due reports
   */
  static async checkScheduledReports() {
    try {
      const [schedules] = await pool.query(
        "SELECT * FROM report_schedules WHERE is_active = TRUE AND next_run <= NOW()"
      );

      console.log(`Found ${schedules.length} due reports`);

      for (const schedule of schedules) {
        await this.executeReport(schedule);
        await this.updateNextRun(schedule);
      }
    } catch (error) {
      console.error("Check scheduled reports error:", error);
    }
  }

  /**
   * Execute a scheduled report
   * @param {object} schedule - Schedule object
   */
  static async executeReport(schedule) {
    let filePath = null;
    try {
      console.log(`Executing report: ${schedule.name} (ID: ${schedule.id})`);

      const recipients = JSON.parse(schedule.recipients);
      const reportType = schedule.report_type;

      // Calculate date range based on frequency
      const endDate = new Date();
      let startDate = new Date();

      switch (schedule.frequency) {
        case "daily":
          startDate.setDate(endDate.getDate() - 1);
          break;
        case "weekly":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "monthly":
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      if (reportType === "withholding_tax") {
        // Fetch data
        const [taxData] = await pool.query(
          `SELECT 
              d.driver_id, d.full_name, d.tin, d.business_name,
              SUM(b.calculated_gross_payout) as total_gross,
              SUM(b.calculated_withholding_tax) as total_tax,
              SUM(b.calculated_net_payout) as total_net,
              COUNT(b.id) as payment_count,
              MIN(b.week_date) as first_payment_date,
              MAX(b.week_date) as last_payment_date
             FROM drivers d
             JOIN bonuses b ON d.driver_id = b.driver_id
             WHERE b.week_date BETWEEN ? AND ?
             GROUP BY d.driver_id, d.full_name, d.tin, d.business_name
             HAVING total_tax > 0
             ORDER BY total_tax DESC`,
          [startDate, endDate]
        );

        if (taxData.length > 0) {
          filePath = await ReportGenerator.generateWithholdingTaxExcel(taxData);
          await EmailService.sendReport(recipients, schedule.name, filePath);
        } else {
          console.log(`No data found for report: ${schedule.name}`);
        }
      } else if (reportType === "debt") {
        const [debtData] = await pool.query(
          `SELECT 
              d.driver_id, d.full_name,
              SUM(dd.amount) as total_debt,
              SUM(dd.amount - dd.remaining_amount) as amount_paid,
              SUM(dd.remaining_amount) as outstanding,
              dd.status,
              MAX(dd.created_at) as updated_at
             FROM drivers d
             JOIN driver_debts dd ON d.driver_id = dd.driver_id
             WHERE dd.created_at BETWEEN ? AND ?
             GROUP BY d.driver_id, d.full_name, dd.status
             HAVING outstanding > 0
             ORDER BY outstanding DESC`,
          [startDate, endDate]
        );

        if (debtData.length > 0) {
          filePath = await ReportGenerator.generateDebtExcel(debtData);
          await EmailService.sendReport(recipients, schedule.name, filePath);
        } else {
          console.log(`No data found for report: ${schedule.name}`);
        }
      } else if (reportType === "compliance") {
        // Build summary for compliance
        const [taxRows] = await pool.query(
          "SELECT SUM(calculated_withholding_tax) as total_tax FROM bonuses WHERE week_date BETWEEN ? AND ?",
          [startDate, endDate]
        );
        const [verificationRows] = await pool.query(
          `SELECT 
              COUNT(*) as total_drivers,
              SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified_drivers,
              SUM(CASE WHEN verified = 0 THEN 1 ELSE 0 END) as unverified_drivers
             FROM drivers`
        );
        const [pendingRows] = await pool.query(
          "SELECT COUNT(*) as pending FROM drivers WHERE verified = 0 AND tin IS NOT NULL AND tin != ''"
        );
        const [alertRows] = await pool.query(
          `SELECT COUNT(*) as recent_alerts 
             FROM audit_logs 
             WHERE (action LIKE '%FAIL%' OR action LIKE '%REJECT%') 
             AND created_at BETWEEN ? AND ?`,
          [startDate, endDate]
        );

        const summary = {
          total_tax_collected: parseFloat(taxRows[0].total_tax || 0).toFixed(2),
          verification_stats: verificationRows[0],
          pending_verifications: pendingRows[0].pending,
          recent_alerts: alertRows[0].recent_alerts,
        };

        filePath = await ReportGenerator.generateComplianceExcel(summary);
        await EmailService.sendReport(recipients, schedule.name, filePath);
      }

      // Update last_run timestamp
      await pool.query(
        "UPDATE report_schedules SET last_run = NOW() WHERE id = ?",
        [schedule.id]
      );

      console.log(`Report executed successfully: ${schedule.name}`);
    } catch (error) {
      console.error(`Execute report error (${schedule.name}):`, error);
    } finally {
      // Cleanup file if it exists
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          console.error("Failed to cleanup report file:", cleanupError);
        }
      }
    }
  }

  /**
   * Calculate and update next run time
   * @param {object} schedule - Schedule object
   */
  static async updateNextRun(schedule) {
    try {
      let nextRun;
      const now = new Date();

      switch (schedule.frequency) {
        case "daily":
          nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case "weekly":
          nextRun = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case "monthly":
          nextRun = new Date(now);
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
        default:
          nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      }

      await pool.query(
        "UPDATE report_schedules SET next_run = ? WHERE id = ?",
        [nextRun, schedule.id]
      );
    } catch (error) {
      console.error(`Update next run error (${schedule.name}):`, error);
    }
  }
}

module.exports = SchedulerService;
