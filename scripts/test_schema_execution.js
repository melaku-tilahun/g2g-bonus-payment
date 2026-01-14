const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

const dbConfig = {
  host: "127.0.0.1",
  user: "root",
  password: "root@123",
  multipleStatements: true, // Required to run the full schema script
};

async function testSchema() {
  console.log("Starting Schema Verification...");

  // 1. connect without selecting DB
  const connection = await mysql.createConnection(dbConfig);
  const TEST_DB = "g2g_test_schema_db";

  try {
    // 2. Create fresh test DB
    console.log(`Creating test database ${TEST_DB}...`);
    await connection.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
    await connection.query(`CREATE DATABASE ${TEST_DB}`);
    await connection.query(`USE ${TEST_DB}`);

    // 3. Read schema.sql
    const schemaPath = path.join(__dirname, "../src/config/schema.sql");
    console.log(`Reading schema from ${schemaPath}...`);
    let schemaSql = fs.readFileSync(schemaPath, "utf8");

    // Remove "CREATE DATABASE" and "USE" lines from the script to ensure it uses our test DB
    // or just let it run if it checks IF NOT EXISTS.
    // However, schema.sql says "USE g2g_bonus_db", which we want to override for the test.
    // We will replace "USE g2g_bonus_db" with "USE g2g_test_schema_db"
    schemaSql = schemaSql.replace(/USE g2g_bonus_db;/gi, `USE ${TEST_DB};`);
    schemaSql = schemaSql.replace(
      /CREATE DATABASE IF NOT EXISTS g2g_bonus_db;/gi,
      `-- database creation skipped for test`
    );

    // 4. Execute Schema
    console.log("Executing schema SQL...");
    await connection.query(schemaSql);

    console.log("✅ SUCCESS! Schema executed without errors.");
  } catch (error) {
    console.error("❌ FAILED! Schema execution error:");
    console.error(error.message);
    if (error.sql) {
      console.error("Caused by query (snippet):", error.sql.substring(0, 100));
    }
  } finally {
    // 5. Cleanup
    console.log(`Cleaning up: Dropping test database ${TEST_DB}...`);
    await connection.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
    await connection.end();
  }
}

testSchema();
