const fs = require("fs");
const path = require("path");
const pool = require("./database");

async function runMigration() {
  const migrationFile = path.join(
    __dirname,
    "migrations",
    "add_bonus_columns.sql"
  );
  const sql = fs.readFileSync(migrationFile, "utf8");

  // Split statements by semicolon, filtering out empty ones
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const connection = await pool.getConnection();
  try {
    for (const statement of statements) {
      console.log("Executing:", statement.substring(0, 50) + "...");
      await connection.query(statement);
    }
    console.log("Migration completed successfully.");
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("Columns already exist, migration skipped/partially done.");
    } else {
      console.error("Migration failed:", error);
      process.exit(1);
    }
  } finally {
    connection.release();
    pool.end(); // Close pool to exit script
  }
}

runMigration();
