const pool = require("../config/database");
const AuthService = require("../services/authService");
const AuditService = require("../services/auditService");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const userController = {
  getAll: catchAsync(async (req, res, next) => {
    const [rows] = await pool.query(
      "SELECT id, full_name, email, role, is_active, last_login, created_at FROM users"
    );
    res.json(rows);
  }),

  create: catchAsync(async (req, res, next) => {
    const { full_name, email, password, role } = req.body;

    if (!full_name || !email || !password) {
      throw new AppError("All fields are required", 400);
    }

    const password_hash = await AuthService.hashPassword(password);

    try {
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
        throw new AppError("Email already exists", 400);
      }
      throw error;
    }
  }),

  update: catchAsync(async (req, res, next) => {
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
  }),

  deactivate: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    await pool.query("UPDATE users SET is_active = FALSE WHERE id = ?", [id]);

    await AuditService.log(req.user.id, "Deactivate User", "user", id, {});

    res.json({ message: "User deactivated successfully" });
  }),
};

module.exports = userController;
