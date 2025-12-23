const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function verifyDatabase() {
  console.log('Connecting to database...');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'g2g_bonus_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    const connection = await pool.getConnection();
    console.log('Connected!');

    const [rows] = await connection.query("SHOW COLUMNS FROM import_logs");
    console.log('Columns in import_logs:');
    const columns = rows.map(r => r.Field);
    console.log(columns.join(', '));

    if (!columns.includes('new_drivers_count')) {
        console.log('MISSING: new_drivers_count. Attempting to force add...');
        await connection.query("ALTER TABLE import_logs ADD COLUMN new_drivers_count INT DEFAULT 0");
        console.log('Added new_drivers_count.');
    } else {
        console.log('OK: new_drivers_count exists.');
    }

    connection.release();
  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    pool.end();
  }
}

verifyDatabase();
