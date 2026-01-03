const pool = require("../config/database");

async function migrate() {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to database...");

    // Check if columns exist
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM payments LIKE 'status'"
    );

    if (columns.length === 0) {
      console.log("Adding status and batch_id columns...");
      await connection.query(`
            ALTER TABLE payments 
            ADD COLUMN status ENUM('processing', 'paid') NOT NULL DEFAULT 'processing' AFTER total_amount,
            ADD COLUMN batch_id VARCHAR(50) NULL AFTER status
        `);
      console.log("Columns added successfully.");
    } else {
      console.log("Columns already exist. Skipping.");
    }

    connection.release();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
