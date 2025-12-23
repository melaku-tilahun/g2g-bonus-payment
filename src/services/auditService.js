const pool = require('../config/database');

const AuditService = {
  log: async (userId, action, entityType = null, entityId = null, details = null) => {
    try {
      await pool.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [userId, action, entityType, entityId, details ? JSON.stringify(details) : null]
      );
    } catch (error) {
      console.error('Audit log failed:', error);
    }
  },

  getAll: async () => {
    const [rows] = await pool.query(`
      SELECT al.*, u.full_name as user_name, u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 500
    `);
    return rows;
  }
};

module.exports = AuditService;
