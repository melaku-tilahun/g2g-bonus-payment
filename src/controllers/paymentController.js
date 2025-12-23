const pool = require('../config/database');
const AuditService = require('../services/auditService');

const paymentController = {
  recordPayment: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { 
        driver_id, 
        total_amount, 
        payment_date, 
        payment_method, 
        notes,
        bonus_period_start,
        bonus_period_end
      } = req.body;

      if (!driver_id || !total_amount) {
        return res.status(400).json({ message: 'Driver ID and total amount are required' });
      }

      // 1. Record the payment
      const [result] = await connection.query(
        `INSERT INTO payments 
        (driver_id, total_amount, payment_date, payment_method, notes, bonus_period_start, bonus_period_end, processed_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [driver_id, total_amount, payment_date || new Date(), payment_method, notes, bonus_period_start, bonus_period_end, req.user.id]
      );

      // 2. Mark bonuses as "paid" or similar? 
      // The current schema doesn't have a 'paid' flag in bonuses table.
      // Usually, we would delete them or mark them. 
      // The documentation says "Record payments and clear accumulated bonuses".
      // Let's assume we delete them from bonuses table to "clear" them, 
      // but they are preserved in the payments history (audit trail).
      // Or we could add a 'payment_id' column to bonuses.
      // Let's add 'payment_id' to bonuses table to link them.
      
      // I'll update the bonuses table first.
      
      await connection.query(
          'UPDATE bonuses SET payment_id = ? WHERE driver_id = ? AND payment_id IS NULL',
          [result.insertId, driver_id]
      );

      await AuditService.log(req.user.id, 'Record Payment', 'payment', result.insertId, { driver_id, total_amount });

      await connection.commit();
      res.status(201).json({ id: result.insertId, message: 'Payment recorded and bonuses cleared' });
    } catch (error) {
      await connection.rollback();
      console.error('Record payment error:', error);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      connection.release();
    }
  },

  getHistory: async (req, res) => {
    try {
      const { driver_id } = req.query;
      let query = `
        SELECT p.*, d.full_name as driver_name, u.full_name as processed_by_name 
        FROM payments p
        JOIN drivers d ON p.driver_id = d.driver_id
        JOIN users u ON p.processed_by = u.id
      `;
      const params = [];

      if (driver_id) {
        query += ' WHERE p.driver_id = ?';
        params.push(driver_id);
      }

      query += ' ORDER BY p.payment_date DESC';

      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (error) {
      console.error('Get payment history error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};

module.exports = paymentController;
