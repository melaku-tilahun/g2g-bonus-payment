const pool = require("../config/database");
const AuditService = require("../services/auditService");

const driverController = {
  search: async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.json([]);

      const [rows] = await pool.query(
        "SELECT * FROM drivers WHERE full_name LIKE ? OR driver_id LIKE ? LIMIT 20",
        [`%${q}%`, `%${q}%`]
      );
      res.json(rows);
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
      const { verified_date, password } = req.body;

      if (!password) {
        return res
          .status(400)
          .json({ message: "Password is required to confirm verification" });
      }

      // Verify password
      const [users] = await pool.query(
        "SELECT password_hash FROM users WHERE id = ?",
        [req.user.id]
      );
      const bcrypt = require("bcrypt");
      const isMatch = await bcrypt.compare(password, users[0].password_hash);

      if (!isMatch) {
        return res
          .status(401)
          .json({ message: "Invalid password. Verification cancelled." });
      }

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
