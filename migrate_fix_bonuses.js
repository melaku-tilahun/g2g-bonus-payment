const pool = require("./src/config/database");

async function migrate() {
  try {
    console.log("Adding payment_status column to bonuses...");
    await pool.query(
      "ALTER TABLE bonuses ADD COLUMN payment_status VARCHAR(50) DEFAULT 'Pending' AFTER status"
    );
    console.log("Migration successful.");
    process.exit(0);
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("Column already exists.");
    } else {
      console.error("Migration failed:", error);
    }
    process.exit(1);
  }
}

migrate();
