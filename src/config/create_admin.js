const bcrypt = require("bcrypt");
const pool = require("./database");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function createAdminUser() {
  console.log("\n🔐 Create Admin User\n");

  try {
    const fullName = await question("Full Name: ");
    const email = await question("Email: ");
    const password = await question("Password: ");

    if (!fullName || !email || !password) {
      console.log("❌ All fields are required!");
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert admin user
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active) 
       VALUES (?, ?, ?, 'admin', TRUE)`,
      [fullName, email, passwordHash]
    );

    console.log("\n✅ Admin user created successfully!");
    console.log(`   ID: ${result.insertId}`);
    console.log(`   Name: ${fullName}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: admin\n`);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      console.error("❌ Error: Email already exists!");
    } else {
      console.error("❌ Error creating admin user:", error.message);
    }
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

createAdminUser();
