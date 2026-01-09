const pool = require("../config/database");

/**
 * Audit Controller
 * Handles user activity reports and audit trail analytics
 */
const auditController = {
  /**
   * Get Activity Report
   * @route GET /api/audit/activity-report
   */
  getActivityReport: async (req, res) => {
    try {
      const {
        user_id,
        start_date,
        end_date,
        action,
        page = 1,
        limit = 50,
      } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build filters
      let whereConditions = [];
      const params = [];

      if (user_id) {
        whereConditions.push("al.user_id = ?");
        params.push(user_id);
      }

      if (start_date && end_date) {
        whereConditions.push("al.created_at BETWEEN ? AND ?");
        params.push(start_date, end_date);
      }

      if (action) {
        whereConditions.push("al.action LIKE ?");
        params.push(`%${action}%`);
      }

      const whereClause =
        whereConditions.length > 0
          ? "WHERE " + whereConditions.join(" AND ")
          : "";

      // Get activity logs
      const [logs] = await pool.query(
        `SELECT 
          al.*,
          u.full_name as user_name,
          u.email as user_email
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ${whereClause}
         ORDER BY al.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      );

      // Get total count
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
        params
      );

      res.json({
        success: true,
        logs,
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (error) {
      console.error("Get activity report error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get User Activity Summary
   * @route GET /api/audit/user-summary
   */
  getUserActivitySummary: async (req, res) => {
    try {
      const { user_id, period = "week" } = req.query;

      let dateFilter =
        "DATE(al.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
      if (period === "month") {
        dateFilter =
          "DATE(al.created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
      } else if (period === "year") {
        dateFilter =
          "DATE(al.created_at) >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)";
      }

      // User-specific or all users
      const userFilter = user_id ? "AND al.user_id = ?" : "";
      const params = user_id ? [user_id] : [];

      // Activity breakdown by action type
      const [activityBreakdown] = await pool.query(
        `SELECT 
          u.id as user_id,
          u.full_name,
          u.email,
          COUNT(*) as total_actions,
          SUM(CASE WHEN al.action LIKE '%VERIFY%' THEN 1 ELSE 0 END) as verifications,
          SUM(CASE WHEN al.action LIKE '%IMPORT%' THEN 1 ELSE 0 END) as imports,
          SUM(CASE WHEN al.action LIKE '%EXPORT%' THEN 1 ELSE 0 END) as exports,
          SUM(CASE WHEN al.action LIKE '%RECONCILE%' THEN 1 ELSE 0 END) as reconciliations,
          SUM(CASE WHEN al.action LIKE '%CREATE%' THEN 1 ELSE 0 END) as creates,
          SUM(CASE WHEN al.action LIKE '%UPDATE%' THEN 1 ELSE 0 END) as updates,
          SUM(CASE WHEN al.action LIKE '%DELETE%' THEN 1 ELSE 0 END) as deletes
         FROM users u
         LEFT JOIN audit_logs al ON u.id = al.user_id AND ${dateFilter}
         WHERE u.is_active = TRUE ${userFilter}
         GROUP BY u.id, u.full_name, u.email
         ORDER BY total_actions DESC`,
        params
      );

      res.json({
        success: true,
        period,
        summary: activityBreakdown,
      });
    } catch (error) {
      console.error("Get user summary error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get Activity Heatmap
   * @route GET /api/audit/activity-heatmap
   */
  getActivityHeatmap: async (req, res) => {
    try {
      const { user_id, period = "month" } = req.query;

      const daysBack = period === "week" ? 7 : period === "month" ? 30 : 365;
      const userFilter = user_id ? "AND user_id = ?" : "";
      const params = user_id ? [daysBack, user_id] : [daysBack];

      // Activity by day and hour
      const [heatmap] = await pool.query(
        `SELECT 
          DATE(created_at) as date,
          HOUR(created_at) as hour,
          COUNT(*) as activity_count
         FROM audit_logs
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ${userFilter}
         GROUP BY DATE(created_at), HOUR(created_at)
         ORDER BY date ASC, hour ASC`,
        params
      );

      // Activity by day of week
      const [weekdayPattern] = await pool.query(
        `SELECT 
          DAYNAME(created_at) as day_of_week,
          DAYOFWEEK(created_at) as day_num,
          COUNT(*) as activity_count,
          AVG(COUNT(*)) OVER() as avg_activity
         FROM audit_logs
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ${userFilter}
         GROUP BY DAYOFWEEK(created_at), DAYNAME(created_at)
         ORDER BY day_num`,
        params
      );

      res.json({
        success: true,
        heatmap,
        weekday_pattern: weekdayPattern,
      });
    } catch (error) {
      console.error("Get activity heatmap error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get Security Events
   * @route GET /api/audit/security-events
   */
  getSecurityEvents: async (req, res) => {
    try {
      const { start_date, end_date, page = 1, limit = 50 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build date filter
      let dateFilter = "";
      const params = [];
      if (start_date && end_date) {
        dateFilter = "WHERE al.created_at BETWEEN ? AND ?";
        params.push(start_date, end_date);
      }

      // Security-related events
      const securityActions = [
        "LOGIN_FAILED",
        "UNAUTHORIZED_ACCESS",
        "PASSWORD_CHANGE",
        "USER_DEACTIVATE",
        "PERMISSION_DENIED",
      ];
      const actionFilter = dateFilter ? "AND" : "WHERE";
      const actionCondition = `${actionFilter} (${securityActions
        .map(() => "al.action LIKE ?")
        .join(" OR ")})`;
      params.push(...securityActions.map((a) => `%${a}%`));

      // Get security events
      const [events] = await pool.query(
        `SELECT 
          al.*,
          u.full_name as user_name,
          u.email as user_email
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ${dateFilter} ${actionCondition}
         ORDER BY al.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      );

      // Get event summary
      const [summary] = await pool.query(
        `SELECT 
          al.action,
          COUNT(*) as count
         FROM audit_logs al
         ${dateFilter} ${actionCondition}
         GROUP BY al.action
         ORDER BY count DESC`,
        params
      );

      res.json({
        success: true,
        events,
        summary,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (error) {
      console.error("Get security events error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = auditController;
