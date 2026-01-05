const pool = require("./database");

async function checkSchema() {
  const connection = await pool.getConnection();
  try {
    const [dbNameResult] = await connection.query(
      "SELECT DATABASE() as db, @@hostname as host"
    );
    console.log(
      `📡 Connected to Database: ${dbNameResult[0].db} on Host: ${dbNameResult[0].host}`
    );

    const tables = [
      "users",
      "drivers",
      "import_logs",
      "payments",
      "bonuses",
      "audit_logs",
    ];
    for (const table of tables) {
      console.log(`\n--- Schema for ${table.toUpperCase()} table ---`);
      const [rows] = await connection.query(`DESCRIBE ${table}`);
      rows.forEach((row) => {
        console.log(
          `${row.Field.padEnd(20)} | ${row.Type.padEnd(
            20
          )} | Null: ${row.Null.padEnd(3)} | Key: ${row.Key}`
        );
      });
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    connection.release();
    pool.end();
  }
}

checkSchema();
