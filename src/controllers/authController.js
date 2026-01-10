const User = require("../models/User");
const AuthService = require("../services/authService");
const pool = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const AuditService = require("../services/auditService");

const authController = {
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      const [rows] = await pool.query(
        "SELECT * FROM users WHERE email = ? AND is_active = TRUE",
        [email]
      );

      if (rows.length === 0) {
        await AuditService.log(null, "Login Failed", "auth", null, {
          email,
          reason: "User not found",
          ip: req.ip,
        });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const user = rows[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        await AuditService.log(user.id, "Login Failed", "auth", user.id, {
          email,
          reason: "Invalid password",
          ip: req.ip,
        });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      await pool.query("UPDATE users SET last_login = NOW() WHERE id = ?", [
        user.id,
      ]);

      await AuditService.log(user.id, "User Login", "user", user.id, {
        ip: req.ip,
      });

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getMe: async (req, res) => {
    try {
      res.json(req.user);
    } catch (error) {
      console.error("GetMe error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  changePassword: async (req, res) => {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) {
        return res
          .status(400)
          .json({ message: "Current and new passwords are required" });
      }

      const [users] = await pool.query(
        "SELECT password_hash FROM users WHERE id = ?",
        [req.user.id]
      );
      const isMatch = await bcrypt.compare(
        current_password,
        users[0].password_hash
      );

      if (!isMatch) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(new_password, salt);

      await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [
        password_hash,
        req.user.id,
      ]);

      await AuditService.log(
        req.user.id,
        "Change Password",
        "user",
        req.user.id
      );

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = authController;
