const fs = require("fs");
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "127.0.0.1",
  user: "root",
  password: "root@123",
  database: "g2g_bonus_db",
});

async function checkTables() {
  const tables = [
    "users",
    "drivers",
    "import_logs",
    "audit_logs",
    "payments",
    "payment_batches",
    "bonuses",
    "driver_debts",
    "bonus_deductions",
    "notifications",
    "report_schedules",
    "system_metrics",
    "user_activity_summary",
    "saved_searches",
  ];
  let output = "--- START SCHEMA CHECK ---\n";

  for (const table of tables) {
    try {
      const [rows] = await pool.query(`SHOW CREATE TABLE ${table}`);
      output += `\n### TABLE: ${table} ###\n`;
      output += rows[0]["Create Table"] + "\n";
    } catch (error) {
      output += `Error fetching schema for ${table}: ${error.message}\n`;
    }
  }

  output += "\n--- END SCHEMA CHECK ---\n";
  fs.writeFileSync("scripts/schema_output.txt", output, "utf8");
  process.exit(0);
}

checkTables();
