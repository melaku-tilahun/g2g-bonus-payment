const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'g2g_bonus_db'
    });

    try {
        console.log('Adding tin_ownership column to drivers table...');
        await connection.query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS tin_ownership ENUM('Personal', 'Other') DEFAULT 'Personal' AFTER tin_verified_at;");
        console.log('Migration successful!');
    } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column already exists, skipping.');
        } else {
            console.error('Migration failed:', err);
        }
    } finally {
        await connection.end();
    }
}

migrate();
