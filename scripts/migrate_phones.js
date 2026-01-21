// Use the application's existing pool configuration to ensure connection success
const pool = require("../src/config/database");

async function migrate() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    console.log("Starting migration...");

    // 1. Add is_telebirr_verified to drivers
    console.log("Adding is_telebirr_verified to drivers...");
    try {
      await connection.query(
        "ALTER TABLE drivers ADD COLUMN is_telebirr_verified BOOLEAN DEFAULT FALSE",
      );
    } catch (err) {
      if (err.code === "ER_DUP_FIELDNAME") {
        console.log("Column is_telebirr_verified already exists. Skipping.");
      } else {
        throw err;
      }
    }

    // 2. Create driver_phones table
    console.log("Creating driver_phones table...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS driver_phones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        driver_id VARCHAR(64) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        status ENUM('active', 'inactive', 'pending', 'rejected') DEFAULT 'pending',
        is_primary BOOLEAN DEFAULT FALSE,
        
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        valid_from TIMESTAMP NULL,
        valid_to TIMESTAMP NULL,
        
        added_by_import_id INT NULL,
        approved_by INT(11) NULL,
        rejection_reason TEXT NULL,
        
        INDEX idx_driver_phone_status (driver_id, status),
        INDEX idx_phone_unique_active (phone_number, status),
        FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    // 3. Migrate existing phone numbers
    console.log("Migrating existing phone numbers...");
    const [drivers] = await connection.query(
      "SELECT driver_id, phone_number FROM drivers WHERE phone_number IS NOT NULL AND phone_number != ''",
    );

    let migratedCount = 0;
    for (const driver of drivers) {
      // Check if already exists to avoid duplicates if re-run
      const [existing] = await connection.query(
        "SELECT id FROM driver_phones WHERE driver_id = ? AND phone_number = ?",
        [driver.driver_id, driver.phone_number],
      );

      if (existing.length === 0) {
        await connection.query(
          `INSERT INTO driver_phones 
           (driver_id, phone_number, status, is_primary, valid_from, added_at) 
           VALUES (?, ?, 'active', TRUE, NOW(), NOW())`,
          [driver.driver_id, driver.phone_number],
        );
        migratedCount++;
      }
    }
    console.log(`Migrated ${migratedCount} phone numbers.`);

    // 4. Set ALL drivers to unverified (Strict Requirement)
    console.log("Setting all drivers to 'Unverified'...");
    await connection.query("UPDATE drivers SET is_telebirr_verified = FALSE");

    await connection.commit();
    console.log("Migration completed successfully successfully! ✅");
  } catch (error) {
    await connection.rollback();
    console.error("Migration failed:", error);
  } finally {
    connection.release();
    process.exit();
  }
}

migrate();
