const pool = require("./src/config/database");

async function migrate() {
  try {
    const [columns] = await pool.query(
      "SHOW COLUMNS FROM bonuses LIKE 'force_pay'"
    );
    if (columns.length === 0) {
      console.log("Adding force_pay column...");
      await pool.query(
        "ALTER TABLE bonuses ADD COLUMN force_pay BOOLEAN DEFAULT FALSE;"
      );
      console.log("Column added successfully.");
    } else {
      console.log("Column force_pay already exists.");
    }
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit();
  }
}

migrate();
