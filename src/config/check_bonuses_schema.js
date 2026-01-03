const pool = require("./database");

async function checkSchema() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query("DESCRIBE bonuses");
    console.log("Bonuses Table Schema:");
    rows.forEach((row) => {
      console.log(`${row.Field.padEnd(20)} | ${row.Type}`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    connection.release();
    pool.end();
  }
}

checkSchema();
