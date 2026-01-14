const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "127.0.0.1",
  user: "root",
  password: "root@123",
  database: "g2g_bonus_db",
});

async function fixDatabase() {
  try {
    console.log('Attempting to drop duplicate FK "1" from audit_logs...');
    await pool.query("ALTER TABLE audit_logs DROP FOREIGN KEY `1`");
    console.log("Success: Duplicate FK dropped.");
  } catch (error) {
    console.error("Error dropping FK:", error.message);
  }

  try {
    console.log("Attempting to add UNIQUE constraint to drivers(driver_id)...");
    // First check if it exists or if we need to modify column
    // But usually ADD UNIQUE works.
    await pool.query("ALTER TABLE drivers ADD UNIQUE (driver_id)");
    console.log("Success: UNIQUE constraint added to drivers(driver_id).");
  } catch (error) {
    console.error("Error adding UNIQUE constraint:", error.message);
  }

  process.exit(0);
}

fixDatabase();
