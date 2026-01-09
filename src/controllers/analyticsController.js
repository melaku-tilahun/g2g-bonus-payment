const pool = require("../config/database");

/**
 * Analytics Controller
 * Handles financial analytics, revenue trends, and driver performance metrics
 */
const analyticsController = {
  /**
   * Get Financial Overview
   * @route GET /api/analytics/financial-overview
   */
  getFinancialOverview: async (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      // Build date filter
      let dateFilter = "";
      let prevDateFilter = "";
      const params = [];
      const prevParams = [];

      if (start_date && end_date) {
        dateFilter = "WHERE b.week_date BETWEEN ? AND ?";
        params.push(start_date, end_date);

        // Calculate previous period of same length
        const start = new Date(start_date);
        const end = new Date(end_date);
        const diff = end.getTime() - start.getTime();
        const prevEnd = new Date(start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - diff);

        prevDateFilter = "WHERE b.week_date BETWEEN ? AND ?";
        prevParams.push(
          prevStart.toISOString().split("T")[0],
          prevEnd.toISOString().split("T")[0]
        );
      } else {
        // Default to last 30 days vs previous 30 days
        dateFilter =
          "WHERE b.week_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
        prevDateFilter =
          "WHERE b.week_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
      }

      // Helper for overview metrics
      const getMetrics = async (filter, p) => {
        const [rows] = await pool.query(
          `SELECT 
            SUM(COALESCE(b.final_payout, b.net_payout)) as total_revenue,
            SUM(b.withholding_tax) as total_tax,
            COUNT(DISTINCT b.driver_id) as active_drivers,
            COUNT(b.id) as total_bonuses
           FROM bonuses b ${filter}`,
          p
        );
        return rows[0];
      };

      const current = await getMetrics(dateFilter, params);
      const previous = await getMetrics(prevDateFilter, prevParams);

      // Average Payout Time (current period)
      const [payoutTimeRows] = await pool.query(
        `SELECT AVG(DATEDIFF(p.payment_date, b.imported_at)) as avg_days
         FROM bonuses b
         JOIN payments p ON b.payment_id = p.id
         WHERE p.status = 'paid' ${
           dateFilter ? "AND b.week_date BETWEEN ? AND ?" : ""
         }`,
        params
      );

      const calculateGrowth = (curr, prev) => {
        if (!prev || prev == 0) return curr > 0 ? 100 : 0;
        return (((curr - prev) / prev) * 100).toFixed(1);
      };

      res.json({
        success: true,
        overview: {
          total_revenue: parseFloat(current.total_revenue || 0).toFixed(2),
          total_tax: parseFloat(current.total_tax || 0).toFixed(2),
          active_drivers: current.active_drivers || 0,
          total_bonuses: current.total_bonuses || 0,
          avg_payout_time_days: parseFloat(
            payoutTimeRows[0].avg_days || 0
          ).toFixed(1),
          growth: {
            revenue: calculateGrowth(
              current.total_revenue,
              previous.total_revenue
            ),
            tax: calculateGrowth(current.total_tax, previous.total_tax),
            drivers: calculateGrowth(
              current.active_drivers,
              previous.active_drivers
            ),
            bonuses: calculateGrowth(
              current.total_bonuses,
              previous.total_bonuses
            ),
          },
        },
      });
    } catch (error) {
      console.error("Get financial overview error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get Revenue Trends
   * @route GET /api/analytics/revenue-trends
   */
  getRevenueTrends: async (req, res) => {
    try {
      const { period = "monthly", months = 6 } = req.query;

      let groupBy, dateFormat;
      if (period === "daily") {
        groupBy = "DATE(b.week_date)";
        dateFormat = "%Y-%m-%d";
      } else if (period === "weekly") {
        groupBy = "YEARWEEK(b.week_date, 1)";
        dateFormat = "%Y-W%v";
      } else {
        groupBy = 'DATE_FORMAT(b.week_date, "%Y-%m")';
        dateFormat = "%Y-%m";
      }

      const [trends] = await pool.query(
        `SELECT 
          DATE_FORMAT(b.week_date, ?) as period,
          SUM(COALESCE(b.final_payout, b.net_payout)) as revenue,
          SUM(b.withholding_tax) as tax,
          COUNT(DISTINCT b.driver_id) as drivers,
          COUNT(b.id) as bonuses
         FROM bonuses b
         WHERE b.week_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
         GROUP BY ${groupBy}
         ORDER BY b.week_date ASC`,
        [dateFormat, parseInt(months)]
      );

      res.json({
        success: true,
        period,
        trends,
      });
    } catch (error) {
      console.error("Get revenue trends error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get Tax Analytics
   * @route GET /api/analytics/tax-analytics
   */
  getTaxAnalytics: async (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      let dateFilter = "";
      const params = [];
      if (start_date && end_date) {
        dateFilter = "WHERE b.week_date BETWEEN ? AND ?";
        params.push(start_date, end_date);
      }

      // Tax breakdown
      const [taxBreakdown] = await pool.query(
        `SELECT 
          SUM(CASE WHEN b.withholding_tax > 0 THEN b.withholding_tax ELSE 0 END) as total_tax,
          SUM(CASE WHEN b.withholding_tax > 0 THEN 1 ELSE 0 END) as taxable_bonuses,
          SUM(CASE WHEN b.withholding_tax = 0 THEN 1 ELSE 0 END) as tax_exempt_bonuses,
          SUM(CASE WHEN b.withholding_tax > 0 THEN b.gross_payout ELSE 0 END) as taxable_gross,
          SUM(CASE WHEN b.withholding_tax = 0 THEN b.net_payout ELSE 0 END) as exempt_gross
         FROM bonuses b ${dateFilter}`,
        params
      );

      // Monthly tax collection
      const [monthlyTax] = await pool.query(
        `SELECT 
          DATE_FORMAT(b.week_date, '%Y-%m') as month,
          SUM(b.withholding_tax) as tax_collected
         FROM bonuses b ${dateFilter}
         GROUP BY DATE_FORMAT(b.week_date, '%Y-%m')
         ORDER BY month ASC`,
        params
      );

      res.json({
        success: true,
        tax_breakdown: taxBreakdown[0],
        monthly_tax: monthlyTax,
      });
    } catch (error) {
      console.error("Get tax analytics error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get Payout Velocity
   * @route GET /api/analytics/payout-velocity
   */
  getPayoutVelocity: async (req, res) => {
    try {
      // Average time from bonus import to payment
      const [velocity] = await pool.query(
        `SELECT 
          AVG(DATEDIFF(p.payment_date, b.imported_at)) as avg_days_to_payment,
          MIN(DATEDIFF(p.payment_date, b.imported_at)) as min_days,
          MAX(DATEDIFF(p.payment_date, b.imported_at)) as max_days,
          COUNT(DISTINCT b.driver_id) as drivers_paid
         FROM bonuses b
         JOIN payments p ON b.payment_id = p.id
         WHERE p.status = 'paid' AND b.payment_id IS NOT NULL`
      );

      // Velocity by month
      const [monthlyVelocity] = await pool.query(
        `SELECT 
          DATE_FORMAT(p.payment_date, '%Y-%m') as month,
          AVG(DATEDIFF(p.payment_date, b.imported_at)) as avg_days
         FROM bonuses b
         JOIN payments p ON b.payment_id = p.id
         WHERE p.status = 'paid'
         GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m')
         ORDER BY month DESC
         LIMIT 12`
      );

      res.json({
        success: true,
        velocity: velocity[0],
        monthly_velocity: monthlyVelocity,
      });
    } catch (error) {
      console.error("Get payout velocity error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get Driver Performance Analytics
   * @route GET /api/analytics/driver-performance
   */
  getDriverPerformance: async (req, res) => {
    try {
      const { period = "monthly", limit = 10 } = req.query;

      // Top performers
      const [topPerformers] = await pool.query(
        `SELECT 
          d.driver_id,
          d.full_name,
          d.verified,
          SUM(COALESCE(b.final_payout, b.net_payout)) as total_earnings,
          COUNT(b.id) as bonus_count,
          AVG(COALESCE(b.final_payout, b.net_payout)) as avg_bonus
         FROM drivers d
         JOIN bonuses b ON d.driver_id = b.driver_id
         WHERE b.week_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
         GROUP BY d.driver_id, d.full_name, d.verified
         ORDER BY total_earnings DESC
         LIMIT ?`,
        [parseInt(limit)]
      );

      // Consistency (drivers with bonuses every week)
      const [consistency] = await pool.query(
        `SELECT 
          d.driver_id,
          d.full_name,
          COUNT(DISTINCT YEARWEEK(b.week_date, 1)) as weeks_active,
          SUM(COALESCE(b.final_payout, b.net_payout)) as total_earnings
         FROM drivers d
         JOIN bonuses b ON d.driver_id = b.driver_id
         WHERE b.week_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
         GROUP BY d.driver_id, d.full_name
         HAVING weeks_active >= 4
         ORDER BY weeks_active DESC, total_earnings DESC
         LIMIT ?`,
        [parseInt(limit)]
      );

      res.json({
        success: true,
        top_performers: topPerformers,
        consistent_drivers: consistency,
      });
    } catch (error) {
      console.error("Get driver performance error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get Driver Segmentation
   * @route GET /api/analytics/driver-segmentation
   */
  getDriverSegmentation: async (req, res) => {
    try {
      // Segment drivers by average earnings
      const [segments] = await pool.query(
        `SELECT 
          CASE 
            WHEN avg_earnings >= 10000 THEN 'High'
            WHEN avg_earnings >= 5000 THEN 'Medium'
            ELSE 'Low'
          END as segment,
          COUNT(*) as driver_count,
          AVG(avg_earnings) as avg_segment_earnings,
          SUM(total_earnings) as total_segment_earnings
         FROM (
           SELECT 
             d.driver_id,
             AVG(COALESCE(b.final_payout, b.net_payout)) as avg_earnings,
             SUM(COALESCE(b.final_payout, b.net_payout)) as total_earnings
           FROM drivers d
           JOIN bonuses b ON d.driver_id = b.driver_id
           WHERE b.week_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
           GROUP BY d.driver_id
         ) as driver_stats
         GROUP BY segment`
      );

      res.json({
        success: true,
        segments,
      });
    } catch (error) {
      console.error("Get driver segmentation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
  /**
   * Get Earnings Distribution
   * @route GET /api/analytics/earnings-distribution
   */
  getEarningsDistribution: async (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      let dateFilter = "";
      const params = [];
      if (start_date && end_date) {
        dateFilter = "WHERE b.week_date BETWEEN ? AND ?";
        params.push(start_date, end_date);
      } else {
        dateFilter =
          "WHERE b.week_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)";
      }

      const [distribution] = await pool.query(
        `SELECT 
          CASE 
            WHEN total_earnings < 1000 THEN '0 - 1k'
            WHEN total_earnings < 5000 THEN '1k - 5k'
            WHEN total_earnings < 10000 THEN '5k - 10k'
            WHEN total_earnings < 20000 THEN '10k - 20k'
            WHEN total_earnings < 50000 THEN '20k - 50k'
            ELSE '50k+'
          END as bucket,
          COUNT(*) as driver_count
         FROM (
           SELECT driver_id, SUM(COALESCE(final_payout, net_payout)) as total_earnings
           FROM bonuses b
           ${dateFilter}
           GROUP BY driver_id
         ) as earnings_summary
         GROUP BY bucket
         ORDER BY 
           CASE bucket
             WHEN '0 - 1k' THEN 1
             WHEN '1k - 5k' THEN 2
             WHEN '5k - 10k' THEN 3
             WHEN '10k - 20k' THEN 4
             WHEN '20k - 50k' THEN 5
             ELSE 6
           END`,
        params
      );

      res.json({
        success: true,
        distribution,
      });
    } catch (error) {
      console.error("Get earnings distribution error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = analyticsController;
