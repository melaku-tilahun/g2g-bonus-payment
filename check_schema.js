const mysql = require("mysql2/promise");
const fs = require("fs");
require("dotenv").config();

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [rows] = await connection.query("SHOW TABLES");
    const tables = rows.map((r) => Object.values(r)[0]);
    let output = "";

    for (const table of tables) {
      const [create] = await connection.query(`SHOW CREATE TABLE ${table}`);
      output += `\n--- ${table} ---\n`;
      output += create[0]["Create Table"] + ";\n";
    }

    fs.writeFileSync("schema_dump.txt", output, "utf8");
    console.log("Schema dumped to schema_dump.txt");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await connection.end();
  }
}

checkSchema();
