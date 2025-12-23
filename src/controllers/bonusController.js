const pool = require('../config/database');

const bonusController = {
  getByDriver: async (req, res) => {
    try {
      const { driverId } = req.params;
      const { sortBy = 'date', order = 'desc' } = req.query;

      const validSortColumns = {
        date: 'week_date',
        amount: 'net_payout'
      };
      const sortCol = validSortColumns[sortBy] || 'week_date';
      const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      const [rows] = await pool.query(
        `SELECT b.*, il.file_name 
         FROM bonuses b 
         LEFT JOIN import_logs il ON b.import_log_id = il.id 
         WHERE b.driver_id = ? AND b.payment_id IS NULL
         ORDER BY ${sortCol} ${sortOrder}`,
        [driverId]
      );
      res.json(rows);
    } catch (error) {
      console.error('Get bonuses error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  getTotalByDriver: async (req, res) => {
    try {
      const { driverId } = req.params;
      const [rows] = await pool.query(
        `SELECT 
          SUM(net_payout) as total_bonus,
          COUNT(id) as weeks_count,
          MIN(week_date) as first_week,
          MAX(week_date) as last_week
        FROM bonuses
        WHERE driver_id = ? AND payment_id IS NULL`,
        [driverId]
      );
      res.json(rows[0]);
    } catch (error) {
      console.error('Get total bonus error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  getPending: async (req, res) => {
    try {
      const { sortBy = 'amount', order = 'desc' } = req.query;
      
      const sortOptions = {
          amount: 'total_pending',
          driver: 'full_name',
          date: 'latest_bonus_date'
      };
      const sortCol = sortOptions[sortBy] || 'total_pending';
      const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      const [rows] = await pool.query(`
        SELECT 
          d.driver_id,
          d.full_name,
          d.phone_number,
          SUM(b.net_payout) as total_pending,
          COUNT(b.id) as weeks_pending,
          MAX(b.week_date) as latest_bonus_date
        FROM drivers d
        JOIN bonuses b ON d.driver_id = b.driver_id
        WHERE d.verified = FALSE AND b.payment_id IS NULL
        GROUP BY d.driver_id, d.full_name, d.phone_number
        ORDER BY total_bonus DESC
      `);

      const totalAmount = rows.reduce((sum, row) => sum + parseFloat(row.total_bonus), 0);

      res.json({
        success: true,
        pending_drivers: rows,
        total_pending_amount: totalAmount,
        total_drivers: rows.length
      });
    } catch (error) {
      console.error('Get pending bonuses error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};

module.exports = bonusController;
