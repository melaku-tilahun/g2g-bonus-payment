const pool = require("../config/database");
const AuditService = require("../services/auditService");

const driverController = {
  search: async (req, res) => {
    try {
      const { q, status, page = 1, limit = 25 } = req.query;
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      // Build WHERE clause
      let whereConditions = [];
      let queryParams = [];

      if (q) {
        whereConditions.push("(d.full_name LIKE ? OR d.driver_id LIKE ? OR d.phone_number LIKE ?)");
        queryParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }

      if (status === 'verified') {
        whereConditions.push("d.verified = TRUE");
      } else if (status === 'unverified') {
        whereConditions.push("d.verified = FALSE");
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Get Total Count
      const [countRows] = await pool.query(
        `SELECT COUNT(*) as total FROM drivers d ${whereClause}`,
        queryParams
      );

      // Get Data with Pending Bonus Info
      // We LEFT JOIN bonuses on driver_id AND payment_id IS NULL to only sum pending bonuses
      const [rows] = await pool.query(
        `SELECT 
          d.*, 
          COALESCE(SUM(b.net_payout), 0) as total_pending,
          COUNT(b.id) as weeks_pending
         FROM drivers d
         LEFT JOIN bonuses b ON d.driver_id = b.driver_id AND b.payment_id IS NULL
         ${whereClause}
         GROUP BY d.id
         LIMIT ? OFFSET ?`,
        [...queryParams, limitNum, offset]
      );
      
      res.json({
          drivers: rows,
          total: countRows[0].total,
          pagination: {
              page: parseInt(page),
              limit: limitNum,
              total_pages: Math.ceil(countRows[0].total / limitNum)
          }
      });
    } catch (error) {
      console.error("Search drivers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await pool.query(
        "SELECT * FROM drivers WHERE driver_id = ?",
        [id]
      );
      if (rows.length === 0)
        return res.status(404).json({ message: "Driver not found" });
      res.json(rows[0]);
    } catch (error) {
      console.error("Get driver error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  verify: async (req, res) => {
    try {
      const { id } = req.params;
      const { verified_date } = req.body;

      // Password check removed as per user request (replaced with 'yes' confirmation on frontend)

      console.log(`Verifying driver ${id} by user ${req.user.id}`);

      await pool.query(
        "UPDATE drivers SET verified = TRUE, verified_date = ?, verified_by = ? WHERE driver_id = ?",
        [verified_date || new Date(), req.user.id, id]
      );

      await AuditService.log(req.user.id, "Verify Driver", "driver", id, {
        verified_date,
      });

      res.json({ message: "Driver verified successfully" });
    } catch (error) {
      console.error("Verify driver error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getAll: async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM drivers ORDER BY created_at DESC"
      );
      res.json(rows);
    } catch (error) {
      console.error("Get all drivers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = driverController;
