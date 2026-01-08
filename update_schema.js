require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "g2g_bonus_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function updateSchema() {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to database.");

    // Check if column exists
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM drivers LIKE 'is_blocked'`
    );

    if (columns.length === 0) {
      console.log("Adding is_blocked column to drivers table...");
      await connection.query(
        `ALTER TABLE drivers ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE AFTER verified`
      );
      console.log("Column added successfully.");

      // Add Index
      await connection.query(
        `CREATE INDEX idx_is_blocked ON drivers(is_blocked)`
      );
      console.log("Index added successfully.");
    } else {
      console.log("Column is_blocked already exists.");
    }

    connection.release();
    process.exit(0);
  } catch (error) {
    console.error("Schema update failed:", error);
    process.exit(1);
  }
}

updateSchema();
