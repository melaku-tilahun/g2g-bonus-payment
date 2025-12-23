# Driver Bonus Tracking Platform

A centralized web application designed to automate the accumulation, tracking, and payment processing of driver performance bonuses for ride service providers. This system eliminates manual Excel file searches and mental calculations, ensuring payment accuracy and operational efficiency.

## 🌟 Overview

Operating a driver bonus compensation system involves managing weekly performance-based bonuses across hundreds of drivers. This platform solves the "manual calculation" bottleneck by providing a centralized database where bonuses are automatically accumulated and flagged for payment upon driver verification.

**Primary Goal:** Streamline bonus calculation and payment for newly verified drivers.

## 🚀 Key Features

- **Automated Excel Import:** Weekly upload of Yango-generated Excel files with automatic parsing.
- **Cumulative Tracking:** Bonuses automatically sum up per driver across multiple weeks until marked as paid.
- **Strict Validation:** Multi-step validation for Excel files (single sheet, exact column names, numeric values).
- **Verification Management:** A secure workflow to mark drivers as verified, which triggers the lump-sum payment phase.
- **Direct Payment Blocking:** Once a driver is verified and paid, the system automatically blocks further bonus accumulation to prevent double payments.
- **Audit Trail:** Comprehensive logging of all administrative actions (imports, verifications, payments).
- **Dashboard Analytics:** Real-time visibility into total pending bonuses and unverified driver counts.

## 🛠️ Technology Stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3 (Bootstrap 5 for layout).
- **Backend:** Node.js with Express.js.
- **Database:** MySQL 8.0+.
- **Excel Processing:** ExcelJS for robust `.xlsx` parsing.
- **Security:** JWT-based authentication with bcrypt password hashing.

## 📋 Business Logic & Rules

### THE CRITICAL RULE: Verified Driver Import Blocking
To prevent operational errors and double payments, the system follows a strict lifecycle:
1. **Unverified Mode:** Excel imports are allowed. Bonuses accumulate weekly.
2. **Verification:** Admin marks driver as verified (requires password confirmation).
3. **Payment:** Admin processes a lump-sum payment of all accumulated bonuses.
4. **Verified Mode:** Future Excel imports for this driver are **BLOCKED**. The driver transitions to weekly direct payments outside of this system.

## ⚙️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/melaku-tilahun/g2g-bonus-payment.git
   cd g2g-bonus-payment
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Database Setup:**
   - Create a MySQL database named `g2g_bonus_db`.
   - Import the schema from `src/config/schema.sql`.
   - Run the initialization script if available, or manually create the first admin user.

4. **Environment Configuration:**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=your_password
   DB_NAME=g2g_bonus_db
   JWT_SECRET=your_super_secret_key
   ```

5. **Start the server:**
   ```bash
   npm start
   ```
   The platform will be accessible at `http://localhost:3000`.

## 📁 Project Structure

- `src/controllers/`: API request handlers.
- `src/services/`: Core logic (Excel parsing, Auth, Auditing).
- `src/routes/`: Express API route definitions.
- `src/config/`: Database connection and SQL schema.
- `public/`: Frontend static files and UI pages.

## 📖 Documentation

For full technical specifications, API references, and detailed user guides, please refer to the [Driver Bonus Tracking Documentation.md](./Driver%20Bonus%20Tracking%20Documentation.md).

## 📄 License

MIT License. See [LICENSE](./LICENSE) for details.