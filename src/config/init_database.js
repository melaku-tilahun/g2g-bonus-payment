const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function initializeDatabase() {
  console.log("🚀 Starting database initialization...\n");

  // Create connection without database selection
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  try {
    // Read schema file
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    console.log("📄 Reading schema.sql...");
    console.log("🔧 Creating database and tables...\n");

    // Execute schema
    await connection.query(schema);

    console.log("✅ Database created successfully!");
    console.log("✅ All tables created successfully!\n");

    // Verify tables
    await connection.query(`USE ${process.env.DB_NAME || "g2g_bonus_db"}`);
    const [tables] = await connection.query("SHOW TABLES");

    console.log("📋 Created tables:");
    tables.forEach((table) => {
      const tableName = Object.values(table)[0];
      console.log(`   ✓ ${tableName}`);
    });

    console.log("\n🎉 Database initialization complete!");
    console.log("\n⚠️  Next steps:");
    console.log("   1. Create an admin user account");
    console.log("   2. Start the application: npm start");
  } catch (error) {
    console.error("❌ Error initializing database:", error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

initializeDatabase();
