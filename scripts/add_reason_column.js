const pool = require("../src/config/database");

async function migrate() {
  const connection = await pool.getConnection();
  try {
    console.log("Starting migration: Adding reason column to driver_phones...");

    // 1. Add reason column
    try {
      await connection.query(
        "ALTER TABLE driver_phones ADD COLUMN reason TEXT NULL AFTER rejection_reason",
      );
      console.log("Added 'reason' column.");
    } catch (err) {
      if (err.code === "ER_DUP_FIELDNAME") {
        console.log("'reason' column already exists.");
      } else {
        throw err;
      }
    }

    // 2. Copy existing rejection_reasons to reason
    console.log("Migrating existing rejection reasons...");
    await connection.query(
      "UPDATE driver_phones SET reason = rejection_reason WHERE rejection_reason IS NOT NULL AND reason IS NULL",
    );

    console.log("Migration completed successfully! ✅");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    connection.release();
    process.exit();
  }
}

migrate();
