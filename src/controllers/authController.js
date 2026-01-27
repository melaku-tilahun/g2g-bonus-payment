const User = require("../models/User");
const AuthService = require("../services/authService");
const pool = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const AuditService = require("../services/auditService");
const EmailService = require("../services/emailService");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const authController = {
  login: catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }

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
      throw new AppError("Invalid email or password", 401);
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      await AuditService.log(user.id, "Login Failed", "auth", user.id, {
        email,
        reason: "Invalid password",
        ip: req.ip,
      });
      throw new AppError("Invalid email or password", 401);
    }

    // Step 2: Generate OTP instead of JWT
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

    await pool.query(
      "UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?",
      [otp, expiresAt, user.id]
    );

    const emailSent = await EmailService.sendOTP(user.email, otp);

    if (!emailSent) {
      // If email fails, check for bypass in development
      if (process.env.DEV_OTP_BYPASS) {
        console.warn(`[DEV] Email failed for ${user.email}, but DEV_OTP_BYPASS is active. Use bypass code to login.`);
      } else {
        throw new AppError(
          "Failed to send verification email. Please try again.",
          500
        );
      }
    }

    await AuditService.log(user.id, "OTP Sent", "auth", user.id, {
      email: user.email,
    });

    res.json({
      success: true,
      otpRequired: true,
      message: "An OTP has been sent to your email.",
    });
  }),

  verifyOTP: catchAsync(async (req, res, next) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
      throw new AppError("Email and OTP are required", 400);
    }

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? AND is_active = TRUE",
      [email]
    );

    if (rows.length === 0) {
      throw new AppError("User not found", 404);
    }

    const user = rows[0];
    const bypassCode = process.env.DEV_OTP_BYPASS;

    // Allow bypass code if configured
    const isValidOTP = user.otp_code === otp || (bypassCode && otp === bypassCode);

    if (!isValidOTP) {
      throw new AppError("Invalid OTP code", 403);
    }

    if (new Date() > new Date(user.otp_expires_at)) {
      throw new AppError("OTP has expired", 403);
    }

    // Clear OTP after successful verification
    await pool.query(
      "UPDATE users SET otp_code = NULL, otp_expires_at = NULL, last_login = NOW() WHERE id = ?",
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    await AuditService.log(user.id, "User Login (2FA)", "user", user.id, {
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
  }),

  getMe: catchAsync(async (req, res, next) => {
    res.json(req.user);
  }),

  changePassword: catchAsync(async (req, res, next) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      throw new AppError("Current and new passwords are required", 400);
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
      throw new AppError("Current password is incorrect", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);

    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [
      password_hash,
      req.user.id,
    ]);

    await AuditService.log(req.user.id, "Change Password", "user", req.user.id);

    res.json({ message: "Password changed successfully" });
  }),
};

module.exports = authController;
