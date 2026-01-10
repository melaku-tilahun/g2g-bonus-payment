const mysql = require("mysql2/promise");
const fs = require("fs");
require("dotenv").config();

async function dumpSchema() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "g2g_bonus_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  let output = "";
  const log = (msg) => {
    output += msg + "\n";
  };

  try {
    const tables = [
      "users",
      "drivers",
      "payments",
      "payment_batches",
      "bonuses",
      "driver_debts",
      "bonus_deductions",
      "import_logs",
      "audit_logs",
      "notifications",
      "report_schedules",
      "system_metrics",
      "user_activity_summary",
      "saved_searches",
    ];

    log("--- START SCHEMA DUMP ---");
    for (const table of tables) {
      try {
        const [rows] = await pool.query(`SHOW CREATE TABLE ${table}`);
        log(`\n-- Table: ${table}`);
        log(rows[0]["Create Table"] + ";");
      } catch (err) {
        log(`-- Table ${table} NOT FOUND or ERROR: ${err.message}`);
      }
    }
    log("\n--- END SCHEMA DUMP ---");

    fs.writeFileSync("current_schema_dump.txt", output);
    console.log("Schema dumped to current_schema_dump.txt");
  } catch (error) {
    console.error("Schema dump failed:", error);
  } finally {
    pool.end();
  }
}

dumpSchema();
