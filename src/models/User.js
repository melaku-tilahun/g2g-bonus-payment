const pool = require('../config/database');

const User = {
  findByEmail: async (email) => {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  },

  findById: async (id) => {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0];
  },

  create: async (userData) => {
    const { full_name, email, password_hash, role } = userData;
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [full_name, email, password_hash, role || 'staff']
    );
    return result.insertId;
  },
  
  updateLastLogin: async (id) => {
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  }
};

module.exports = User;
