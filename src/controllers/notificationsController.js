const pool = require("../config/database");

/**
 * Notifications Controller
 * Handles user notifications and alerts
 */
const notificationsController = {
  /**
   * Get All Notifications
   * @route GET /api/notifications
   */
  getAll: async (req, res) => {
    try {
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
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get Unread Count
   * @route GET /api/notifications/unread-count
   */
  getUnreadCount: async (req, res) => {
    try {
      const [result] = await pool.query(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE",
        [req.user.id]
      );

      res.json({
        success: true,
        unread_count: result[0].count,
      });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Mark As Read
   * @route PUT /api/notifications/:id/read
   */
  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;

      await pool.query(
        "UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?",
        [id, req.user.id]
      );

      res.json({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error) {
      console.error("Mark as read error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Mark All As Read
   * @route PUT /api/notifications/read-all
   */
  markAllAsRead: async (req, res) => {
    try {
      await pool.query(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE",
        [req.user.id]
      );

      res.json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      console.error("Mark all as read error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = notificationsController;
