// const mysql = require("mysql2/promise");
// const bcrypt = require("bcrypt");
// require("dotenv").config();

// async function createAdmin() {
//   const connection = await mysql.createConnection({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//   });

//   try {
//     const email = "admin@yango.com";
//     const password = "admin123";
//     const hashedPassword = await bcrypt.hash(password, 10);

//     const [rows] = await connection.query(
//       "SELECT * FROM users WHERE email = ?",
//       [email]
//     );

//     if (rows.length > 0) {
//       console.log("❌ Admin user already exists!");
//     } else {
//       await connection.query(
//         `
//                 INSERT INTO users (full_name, email, password_hash, role)
//                 VALUES (?, ?, ?, ?)
//             `,
//         ["System Admin", email, hashedPassword, "admin"]
//       );

//       console.log("✅ Admin user created successfully!");
//       console.log(`📧 Email: ${email}`);
//       console.log(`🔑 Password: ${password}`);
//     }
//   } catch (error) {
//     console.error("Error:", error);
//   } finally {
//     await connection.end();
//   }
// }

// createAdmin();
