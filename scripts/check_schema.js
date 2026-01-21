const pool = require("../src/config/database");

async function check() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      "SHOW COLUMNS FROM import_logs LIKE 'status'",
    );
    console.log("Status column definition:", rows[0].Type);
  } catch (err) {
    console.error(err);
  } finally {
    connection.release();
    process.exit();
  }
}

check();
