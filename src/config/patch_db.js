const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function patchDatabase() {
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
    console.log('Connected! Applying patches...');

    const columnsToAdd = [
      "ADD COLUMN new_drivers_count INT DEFAULT 0",
      "ADD COLUMN existing_drivers_count INT DEFAULT 0",
      "ADD COLUMN rejected_verified_count INT DEFAULT 0",
      "ADD COLUMN skipped_details JSON",
      "ADD COLUMN status ENUM('success', 'partial', 'failed') DEFAULT 'success'",
      "ADD COLUMN error_message TEXT"
    ];

    for (const col of columnsToAdd) {
      try {
        await connection.query(`ALTER TABLE import_logs ${col}`);
        console.log(`Applied: ${col}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`Skipping: ${col} (Already exists)`);
        } else {
          console.error(`Error applying ${col}:`, err.message);
        }
      }
    }

    console.log('Database patch complete.');
    connection.release();
  } catch (error) {
    console.error('Patch failed:', error);
  } finally {
    pool.end();
  }
}

patchDatabase();
