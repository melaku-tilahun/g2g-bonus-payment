const cron = require("node-cron");
const pool = require("../config/database");

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
    try {
      console.log(`Executing report: ${schedule.name} (ID: ${schedule.id})`);

      // TODO: Implement report generation based on report_type
      // - Financial reports
      // - Compliance reports
      // - User activity reports
      // - Driver performance reports
      // - Debt reports

      // Update last_run timestamp
      await pool.query(
        "UPDATE report_schedules SET last_run = NOW() WHERE id = ?",
        [schedule.id]
      );

      console.log(`Report executed successfully: ${schedule.name}`);
    } catch (error) {
      console.error(`Execute report error (${schedule.name}):`, error);
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
