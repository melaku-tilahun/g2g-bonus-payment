const pool = require("../config/database");
const bcrypt = require("bcrypt");
const AuditService = require("../services/auditService");

/**
 * Batch Controller
 * Manages payment batches (imports/exports)
 */
const batchController = {
  /**
   * Get all payment batches
   * @route GET /api/batches
   */
  getBatches: async (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = `
        SELECT pb.*, u.full_name as exported_by_name
        FROM payment_batches pb
        LEFT JOIN users u ON pb.exported_by = u.id
      `;
      const params = [];

      if (status) {
        query += " WHERE pb.status = ?";
        params.push(status);
      }

      query += " ORDER BY pb.exported_at DESC LIMIT ? OFFSET ?";
      params.push(parseInt(limit), offset);

      const [rows] = await pool.query(query, params);
      const [countResult] = await pool.query(
        "SELECT COUNT(*) as total FROM payment_batches"
      );

      res.json({
        success: true,
        batches: rows,
        total: countResult[0].total,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total_pages: Math.ceil(countResult[0].total / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error("Get batches error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get batch details (payments in batch)
   * @route GET /api/batches/:id
   */
  getBatchDetails: async (req, res) => {
    try {
      const { id } = req.params;

      const [batch] = await pool.query(
        `
        SELECT pb.*, u.full_name as exported_by_name
        FROM payment_batches pb
        LEFT JOIN users u ON pb.exported_by = u.id
        WHERE pb.id = ?
      `,
        [id]
      );

      if (batch.length === 0) {
        return res.status(404).json({ message: "Batch not found" });
      }

      const [payments] = await pool.query(
        `
        SELECT p.*, d.full_name as driver_name
        FROM payments p
        LEFT JOIN drivers d ON p.driver_id = d.driver_id
        WHERE p.batch_internal_id = ?
      `,
        [id]
      );

      res.json({
        success: true,
        batch: batch[0],
        payments,
      });
    } catch (error) {
      console.error("Get batch details error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Update batch status (confirm all payments)
   * @route PUT /api/batches/:id/confirm
   */
  confirmBatch: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const { password } = req.body;
      if (!password) {
        connection.release();
        return res.status(400).json({ message: "Password is required" });
      }

      // Verify Password
      const [userRows] = await connection.query(
        "SELECT password_hash FROM users WHERE id = ?",
        [req.user.id]
      );
      if (userRows.length === 0) {
        connection.release();
        return res.status(404).json({ message: "User not found" });
      }

      const isMatch = await bcrypt.compare(password, userRows[0].password_hash);
      if (!isMatch) {
        connection.release();
        return res.status(401).json({ message: "Incorrect password" });
      }

      await connection.beginTransaction();
      const { id } = req.params;

      // 1. Update batch status
      const [batchResult] = await connection.query(
        "UPDATE payment_batches SET status = 'completed', completed_at = NOW() WHERE id = ?",
        [id]
      );

      if (batchResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Batch not found" });
      }

      // Fetch Admin Name for the note
      const [adminRows] = await connection.query(
        "SELECT full_name FROM users WHERE id = ?",
        [req.user.id]
      );
      const adminName = adminRows.length > 0 ? adminRows[0].full_name : "Admin";

      // 2. Update all payments in batch
      // Set status to 'paid', method to 'Manual' (if generic), and add note with user name
      await connection.query(
        `UPDATE payments 
         SET status = 'paid', 
             notes = CONCAT(COALESCE(notes, ''), '\nManually marked as paid by ', ?),
             payment_method = COALESCE(payment_method, 'Manual')
         WHERE batch_internal_id = ?`,
        [adminName, id]
      );

      // 3. Update all bonuses linked to these payments
      await connection.query(
        `
        UPDATE bonuses b
        JOIN payments p ON b.payment_id = p.id
        SET b.payment_status = 'Completed'
        WHERE p.batch_internal_id = ?
      `,
        [id]
      );

      await AuditService.log(req.user.id, "Confirm Batch", "batch", id, {
        confirmed_by: adminName,
        payment_method: "Manual",
      });

      await connection.commit();
      res.json({
        success: true,
        message: "Batch confirmed, payments marked as paid (Manual)",
      });
    } catch (error) {
      await connection.rollback();
      console.error("Confirm batch error:", error);
      res.status(500).json({ message: "Internal server error" });
    } finally {
      connection.release();
    }
  },
};

module.exports = batchController;
