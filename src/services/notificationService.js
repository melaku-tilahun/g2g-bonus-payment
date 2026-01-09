const pool = require("../config/database");

/**
 * Notification Service
 * Handles creating and managing notifications across the system
 */
class NotificationService {
  /**
   * Create a notification for a specific user
   * @param {number} userId - User ID
   * @param {string} type - Notification type
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {object} data - Additional data
   */
  static async create(userId, type, title, message, data = null) {
    try {
      await pool.query(
        "INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)",
        [userId, type, title, message, data ? JSON.stringify(data) : null]
      );
    } catch (error) {
      console.error("Create notification error:", error);
      throw error;
    }
  }

  /**
   * Notify all admins
   * @param {string} type - Notification type
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {object} data - Additional data
   */
  static async notifyAdmins(type, title, message, data = null) {
    try {
      const [admins] = await pool.query(
        'SELECT id FROM users WHERE role = "admin" AND is_active = TRUE'
      );

      for (const admin of admins) {
        await this.create(admin.id, type, title, message, data);
      }
    } catch (error) {
      console.error("Notify admins error:", error);
      throw error;
    }
  }

  /**
   * Notify on large payment
   * @param {string} driverId - Driver ID
   * @param {number} amount - Payment amount
   * @param {number} userId - User initiating payment
   */
  static async notifyLargePayment(driverId, amount, userId) {
    try {
      if (amount > 50000) {
        await this.notifyAdmins(
          "payment",
          "Large Payment Alert",
          `Payment of ${amount.toLocaleString()} ETB for driver ${driverId} requires review`,
          { driver_id: driverId, amount, initiated_by: userId }
        );
      }
    } catch (error) {
      console.error("Notify large payment error:", error);
      // Don't throw - notification failure shouldn't block payment
    }
  }

  /**
   * Notify on verification pending
   * @param {string} driverId - Driver ID
   * @param {number} daysPending - Days since first bonus
   */
  static async notifyVerificationPending(driverId, daysPending) {
    try {
      if (daysPending > 30) {
        await this.notifyAdmins(
          "verification",
          "Verification Overdue",
          `Driver ${driverId} has been pending verification for ${daysPending} days`,
          { driver_id: driverId, days_pending: daysPending }
        );
      }
    } catch (error) {
      console.error("Notify verification pending error:", error);
    }
  }

  /**
   * Notify on reconciliation required
   * @param {string} batchId - Batch ID
   * @param {number} driverCount - Number of drivers
   */
  static async notifyReconciliationRequired(batchId, driverCount) {
    try {
      await this.notifyAdmins(
        "reconciliation",
        "Reconciliation Required",
        `Batch ${batchId} with ${driverCount} drivers awaits reconciliation`,
        { batch_id: batchId, driver_count: driverCount }
      );
    } catch (error) {
      console.error("Notify reconciliation required error:", error);
    }
  }
}

module.exports = NotificationService;
