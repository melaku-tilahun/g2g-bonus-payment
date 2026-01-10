const pool = require("./src/config/database");

async function migrate() {
  try {
    console.log("Adding completed_at column to payment_batches...");
    await pool.query(
      "ALTER TABLE payment_batches ADD COLUMN completed_at TIMESTAMP NULL AFTER exported_at"
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
