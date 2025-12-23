const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function patchFileStorage() {
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
    console.log('Checking import_logs table columns...');

    const [columns] = await connection.query('SHOW COLUMNS FROM import_logs LIKE "file_path"');
    
    if (columns.length === 0) {
        console.log('Adding missing column: file_path');
        await connection.query('ALTER TABLE import_logs ADD COLUMN file_path VARCHAR(255) NULL');
        console.log('Column added successfully.');
    } else {
        console.log('Column file_path already exists.');
    }

    connection.release();
  } catch (error) {
    console.error('Patch failed:', error);
  } finally {
    pool.end();
  }
}

patchFileStorage();
