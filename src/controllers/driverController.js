const pool = require("../config/database");
const AuditService = require("../services/auditService");

const driverController = {
  search: async (req, res) => {
    try {
      const { q, page = 1, limit = 25 } = req.query;
      if (!q) return res.json({ drivers: [], total: 0 });

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      // Get Total Count
      const [countRows] = await pool.query(
        "SELECT COUNT(*) as total FROM drivers WHERE full_name LIKE ? OR driver_id LIKE ? OR phone_number LIKE ?",
        [`%${q}%`, `%${q}%`, `%${q}%`]
      );

      // Get Data
      const [rows] = await pool.query(
        "SELECT * FROM drivers WHERE full_name LIKE ? OR driver_id LIKE ? OR phone_number LIKE ? LIMIT ? OFFSET ?",
        [`%${q}%`, `%${q}%`, `%${q}%`, limitNum, offset]
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
