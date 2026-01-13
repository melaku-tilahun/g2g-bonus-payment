const pool = require("../config/database");
const catchAsync = require("../utils/catchAsync");

/**
 * Notifications Controller
 * Handles user notifications and alerts
 */
const notificationsController = {
  /**
   * Get All Notifications
   * @route GET /api/notifications
   */
  getAll: catchAsync(async (req, res, next) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [notifications] = await pool.query(
      `SELECT * FROM notifications 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
      [req.user.id, parseInt(limit), offset]
    );

    const [countResult] = await pool.query(
      "SELECT COUNT(*) as total FROM notifications WHERE user_id = ?",
      [req.user.id]
    );

    res.json({
      success: true,
      notifications,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  }),

  /**
   * Get Unread Count
   * @route GET /api/notifications/unread-count
   */
  getUnreadCount: catchAsync(async (req, res, next) => {
    const [result] = await pool.query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE",
      [req.user.id]
    );

    res.json({
      success: true,
      unread_count: result[0].count,
    });
  }),

  /**
   * Mark As Read
   * @route PUT /api/notifications/:id/read
   */
  markAsRead: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  }),

  /**
   * Mark All As Read
   * @route PUT /api/notifications/read-all
   */
  markAllAsRead: catchAsync(async (req, res, next) => {
    await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE",
      [req.user.id]
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  }),
};

module.exports = notificationsController;
