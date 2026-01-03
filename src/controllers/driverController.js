const pool = require("../config/database");
const AuditService = require("../services/auditService");
const TINVerificationService = require("../services/tinVerificationService");

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
        whereConditions.push(
          "(d.full_name LIKE ? OR d.driver_id LIKE ? OR d.phone_number LIKE ?)"
        );
        queryParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }

      if (status === "verified") {
        whereConditions.push("d.verified = TRUE");
      } else if (status === "unverified") {
        whereConditions.push("d.verified = FALSE");
      }

      const whereClause =
        whereConditions.length > 0
          ? "WHERE " + whereConditions.join(" AND ")
          : "";

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
          total_pages: Math.ceil(countRows[0].total / limitNum),
        },
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
        `SELECT d.*, u.full_name as verified_by_name 
         FROM drivers d 
         LEFT JOIN users u ON d.verified_by = u.id 
         WHERE d.driver_id = ?`,
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
      const {
        verified_date,
        tin,
        business_name,
        licence_number,
        manager_name,
        manager_photo,
        admin_override,
      } = req.body;

      console.log(`Verifying driver ${id} by user ${req.user.id}`);

      // Admin override allows verification without TIN (for edge cases)
      if (!admin_override && !tin) {
        return res.status(400).json({
          message:
            "TIN is required for verification. Admins can use override if needed.",
        });
      }

      // Prepare update query
      const updateFields = {
        verified: true,
        verified_date: verified_date || new Date(),
        verified_by: req.user.id,
        tin: tin || null,
        business_name: business_name || null,
        licence_number: licence_number || null,
        manager_name: manager_name || null,
        manager_photo: manager_photo || null,
        tin_verified_at: tin ? new Date() : null,
      };

      await pool.query(
        `UPDATE drivers SET 
          verified = ?, 
          verified_date = ?, 
          verified_by = ?,
          tin = ?,
          business_name = ?,
          licence_number = ?,
          manager_name = ?,
          manager_photo = ?,
          tin_verified_at = ?
        WHERE driver_id = ?`,
        [
          updateFields.verified,
          updateFields.verified_date,
          updateFields.verified_by,
          updateFields.tin,
          updateFields.business_name,
          updateFields.licence_number,
          updateFields.manager_name,
          updateFields.manager_photo,
          updateFields.tin_verified_at,
          id,
        ]
      );

      await AuditService.log(req.user.id, "Verify Driver", "driver", id, {
        verified_date: updateFields.verified_date,
        tin: updateFields.tin,
        business_name: updateFields.business_name,
        admin_override: admin_override || false,
      });

      res.json({ message: "Driver verified successfully" });
    } catch (error) {
      console.error("Verify driver error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  lookupTIN: async (req, res) => {
    try {
      const { tin } = req.params;

      // Validate TIN format
      if (!TINVerificationService.validateTINFormat(tin)) {
        return res.status(400).json({
          message: "Invalid TIN format. TIN should be 8-12 digits.",
        });
      }

      // Fetch business data from Ministry of Revenue API
      const businessData = await TINVerificationService.lookupTIN(tin);

      res.json({
        success: true,
        data: businessData,
      });
    } catch (error) {
      console.error("TIN lookup error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to lookup TIN",
      });
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
  revertVerification: async (req, res) => {
    try {
      const { id } = req.params;
      const { password, reason } = req.body;
      const userId = req.user.id;

      if (!password)
        return res.status(400).json({ message: "Admin password required" });

      // Verify Admin Password
      const [users] = await pool.query(
        "SELECT password FROM users WHERE id = ?",
        [userId]
      );
      if (users.length === 0)
        return res.status(404).json({ message: "User not found" });

      const bcrypt = require("bcrypt");
      const validPassword = await bcrypt.compare(password, users[0].password);
      if (!validPassword) {
        return res
          .status(403)
          .json({ message: "Invalid password. Access denied." });
      }

      // Revert Driver
      await pool.query(
        "UPDATE drivers SET verified = 0, verified_date = NULL, verified_by = NULL, tin = NULL, business_name = NULL, licence_number = NULL, manager_name = NULL, manager_photo = NULL, tin_verified_at = NULL WHERE driver_id = ?",
        [id]
      );

      await AuditService.log(userId, "Revert Verification", "driver", id, {
        reason,
      });

      res.json({
        message: "Driver verification reverted. State set to Unverified.",
      });
    } catch (error) {
      console.error("Revert verification error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = driverController;
