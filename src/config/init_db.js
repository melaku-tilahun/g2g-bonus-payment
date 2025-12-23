const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const bcrypt = require('bcrypt');

async function initDb() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    
    console.log('Running schema setup...');
    // Execute the schema script
    await connection.query(schemaSql);
    console.log('Database and tables created successfully.');

    // Switch to the database explicitly for the seed query (though schema.sql likely handles it with USE)
    await connection.query(`USE ${process.env.DB_NAME}`);

    // Seed initial admin user
    const [rows] = await connection.query('SELECT * FROM users WHERE email = ?', ['admin@yango.com']);
    if (rows.length === 0) {
        console.log('Seeding admin user...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await connection.query(`
            INSERT INTO users (full_name, email, password_hash, role)
            VALUES (?, ?, ?, ?)
        `, ['System Admin', 'admin@yango.com', hashedPassword, 'admin']);
        console.log('Admin user created: admin@yango.com / admin123');
    } else {
        console.log('Admin user already exists.');
    }

  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await connection.end();
  }
}

initDb();
