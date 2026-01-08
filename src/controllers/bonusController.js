const pool = require("../config/database");

const bonusController = {
  getByDriver: async (req, res) => {
    try {
      const { driverId } = req.params;
      const { sortBy = "date", order = "desc" } = req.query;

      const validSortColumns = {
        date: "week_date",
        amount: "net_payout",
      };
      const sortCol = validSortColumns[sortBy] || "week_date";
      const sortOrder = order.toLowerCase() === "asc" ? "ASC" : "DESC";

      const [rows] = await pool.query(
        `SELECT b.*, il.file_name, p.status as payment_status
         FROM bonuses b 
         LEFT JOIN import_logs il ON b.import_log_id = il.id 
         LEFT JOIN payments p ON b.payment_id = p.id
         WHERE b.driver_id = ? AND (b.payment_id IS NULL OR p.status = 'processing')
         ORDER BY ${sortCol} ${sortOrder}`,
        [driverId]
      );
      res.json(rows);
    } catch (error) {
      console.error("Get bonuses error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getTotalByDriver: async (req, res) => {
    try {
      const { driverId } = req.params;
      const [rows] = await pool.query(
        `SELECT 
          SUM(COALESCE(b.final_payout, b.net_payout)) as total_bonus,
          COUNT(b.id) as weeks_count,
          MIN(b.week_date) as first_week,
          MAX(b.week_date) as last_week
        FROM bonuses b
        LEFT JOIN payments p ON b.payment_id = p.id
        WHERE b.driver_id = ? AND (b.payment_id IS NULL OR p.status = 'processing')`,
        [driverId]
      );
      res.json(rows[0]);
    } catch (error) {
      console.error("Get total bonus error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getPending: async (req, res) => {
    try {
      const {
        sortBy = "amount",
        order = "desc",
        page = 1,
        limit = 25,
        q,
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      const sortOptions = {
        amount: "total_pending",
        driver: "full_name",
        date: "latest_bonus_date",
      };
      const sortCol = sortOptions[sortBy] || "total_pending";
      const sortOrder = order.toLowerCase() === "asc" ? "ASC" : "DESC";

      // Base WHERE clause
      let whereClause = "b.payment_id IS NULL";
      const queryParams = [];

      if (req.query.status === "verified") {
        whereClause += " AND d.verified = TRUE";
      } else if (req.query.status === "unverified") {
        whereClause += " AND d.verified = FALSE";
      }
      // If no status or 'all', no verified filter applied (All drivers)

      if (q) {
        whereClause +=
          " AND (d.full_name LIKE ? OR d.driver_id LIKE ? OR d.phone_number LIKE ?)";
        queryParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }

      // 1. Get Totals
      // Re-use params for count query
      const [totalRows] = await pool.query(
        `
        SELECT 
          COUNT(DISTINCT d.driver_id) as total_drivers,
          SUM(COALESCE(b.final_payout, b.net_payout)) as total_amount
        FROM drivers d
        JOIN bonuses b ON d.driver_id = b.driver_id
        WHERE ${whereClause}
      `,
        queryParams
      );

      const totalDrivers = totalRows[0].total_drivers || 0;
      const totalPendingAmount = totalRows[0].total_amount || 0;

      // 2. Get Paginated Data
      // Copy params for main query and add limit/offset
      const mainQueryParams = [...queryParams, limitNum, offset];

      const [rows] = await pool.query(
        `
        SELECT 
          d.driver_id,
          d.full_name,
          d.phone_number,
          SUM(COALESCE(b.final_payout, b.net_payout)) as total_pending,
          COUNT(b.id) as weeks_pending,
          MAX(b.week_date) as latest_bonus_date
        FROM drivers d
        JOIN bonuses b ON d.driver_id = b.driver_id
        WHERE ${whereClause}
        GROUP BY d.driver_id, d.full_name, d.phone_number
        ORDER BY ${sortCol} ${sortOrder}
        LIMIT ? OFFSET ?
      `,
        mainQueryParams
      );

      res.json({
        success: true,
        pending_drivers: rows,
        total_pending_amount: totalPendingAmount,
        total_drivers: totalDrivers,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total_pages: Math.ceil(totalDrivers / limitNum),
        },
      });
    } catch (error) {
      console.error("Get pending bonuses error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = bonusController;
