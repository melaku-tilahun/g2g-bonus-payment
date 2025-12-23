const pool = require('../config/database');
const AuditService = require('../services/auditService');

const paymentController = {
  recordPayment: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { 
        driver_id, 
        // total_amount, // Ignored from body for security
        payment_date, 
        payment_method, 
        notes,
        bonus_period_start,
        bonus_period_end
      } = req.body;

      if (!driver_id) {
        return res.status(400).json({ message: 'Driver ID is required' });
      }

      // 1. Calculate the actual total from pending bonuses
      const [bonusRows] = await connection.query(
        'SELECT SUM(net_payout) as actual_total FROM bonuses WHERE driver_id = ? AND payment_id IS NULL',
        [driver_id]
      );
      
      const actualTotal = parseFloat(bonusRows[0].actual_total || 0);

      if (actualTotal === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'No pending bonuses found for this driver' });
      }

      // 2. Record the payment using the CALCULATED total
      const [result] = await connection.query(
        `INSERT INTO payments 
        (driver_id, total_amount, payment_date, payment_method, notes, bonus_period_start, bonus_period_end, processed_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [driver_id, actualTotal, payment_date || new Date(), payment_method, notes, bonus_period_start, bonus_period_end, req.user.id]
      );

      // 3. Link bonuses to payment (Clear them)
      await connection.query(
          'UPDATE bonuses SET payment_id = ? WHERE driver_id = ? AND payment_id IS NULL',
          [result.insertId, driver_id]
      );

      await AuditService.log(req.user.id, 'Record Payment', 'payment', result.insertId, { driver_id, total_amount: actualTotal });

      await connection.commit();
      res.status(201).json({ 
          id: result.insertId, 
          message: 'Payment recorded and bonuses cleared',
          total_paid: actualTotal 
      });
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
