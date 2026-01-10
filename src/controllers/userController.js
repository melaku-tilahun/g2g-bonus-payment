const pool = require("../config/database");
const AuthService = require("../services/authService");
const AuditService = require("../services/auditService");

const userController = {
  getAll: async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT id, full_name, email, role, is_active, last_login, created_at FROM users"
      );
      res.json(rows);
    } catch (error) {
      console.error("GetAll users error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  create: async (req, res) => {
    try {
      const { full_name, email, password, role } = req.body;

      if (!full_name || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const password_hash = await AuthService.hashPassword(password);

      const [result] = await pool.query(
        "INSERT INTO users (full_name, email, password_hash, role, created_by) VALUES (?, ?, ?, ?, ?)",
        [full_name, email, password_hash, role || "staff", req.user.id]
      );

      await AuditService.log(
        req.user.id,
        "Create User",
        "user",
        result.insertId,
        { email, role }
      );

      res
        .status(201)
        .json({ id: result.insertId, message: "User created successfully" });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ message: "Email already exists" });
      }
      console.error("Create user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { full_name, email, role, is_active } = req.body;

      await pool.query(
        "UPDATE users SET full_name = ?, email = ?, role = ?, is_active = ? WHERE id = ?",
        [full_name, email, role, is_active, id]
      );

      await AuditService.log(req.user.id, "Update User", "user", id, {
        email,
        role,
        is_active,
      });

      res.json({ message: "User updated successfully" });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  deactivate: async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query("UPDATE users SET is_active = FALSE WHERE id = ?", [id]);

      await AuditService.log(req.user.id, "Deactivate User", "user", id, {});

      res.json({ message: "User deactivated successfully" });
    } catch (error) {
      console.error("Deactivate user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = userController;
