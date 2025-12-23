# Driver Bonus Tracking Platform

# 1. Overview

## 1.1 Executive Summary

The Driver Bonus Tracking Platform is a centralized web application designed to automate the accumulation, tracking, and payment processing of driver performance bonuses for Yango ride service providers. The system eliminates manual Excel file searches and calculations, reducing administrative overhead by 90% while ensuring payment accuracy.

**Platform Type:** Web Application

**Target Users:** Administrative staff and managers

**Primary Goal:** Streamline bonus calculation and payment for newly verified drivers

## 1.2 Problem Statement

<aside>
🎯

**Business Context**

We are Yango ride service providers operating a driver bonus compensation system. Drivers earn weekly performance-based bonuses, but payment is contingent upon successful verification through document submission and approval.

### The Core Problem

Unverified drivers accumulate unpaid bonuses over multiple weeks (typically 2-4 weeks). When a driver completes verification, staff must manually search through separate weekly Excel files to locate all bonus entries for that driver, sum the amounts, and process payment.

### Current Process

📊 **Each Monday:** We generate Excel files with driver_id, Name, Date, bonus_Amount

⏰ **When verified:** We search 4+ files, find entries, calculate totals, then pay

😓 **Result:** Boring, slow, error-prone manual work

### Key Pain Points

- Manual search across multiple large Excel files is time-consuming and tedious
- No centralized system to track cumulative bonuses for unverified drivers
- Process delays driver payments and creates administrative burden
</aside>

### Current Workflow

**Weekly Process (Every Monday):**

- Generate Excel files containing driver bonus data
- **File structure:** `ID`, `Full name`, `Phone number`, `Date`, `Net payout`
- **Example data:**
    - ID: `85fb80236ffa474db93fdccd0cdab66b`
    - Full name: `Lemenih Wubamlak`
    - Phone number: `935251885`
    - Date: `1-Dec-25`
    - Net payout: `1235.7` (this is the bonus amount)
- Each file represents one week of bonus accumulation
- Files stored separately without integration

**Verification & Payment Process:**

- Drivers submit required documents for verification
- Verification typically takes 2-4 weeks from driver onboarding
- During this period, bonuses accumulate across multiple weekly files
- Upon verification approval, staff must manually:
    - Open 2-4+ separate Excel files
    - Search for the specific driver_id in each file
    - Manually note bonus amounts from each week
    - Calculate the total sum using calculator or mental math
    - Process payment based on calculated total

### Critical Pain Points

<aside>
❌

**1. Time-Consuming Manual Search**
Staff spend 5-15 minutes per driver searching through multiple large Excel files, especially when dealing with hundreds of drivers per week.

</aside>

<aside>
❌

**2. Error-Prone Calculations**
Manual summation of bonuses from multiple sources increases risk of calculation errors, leading to underpayment or overpayment.

</aside>

<aside>
❌

**3. No Centralized Visibility**
Impossible to quickly see which drivers have pending bonuses or how much they've accumulated without manual investigation.

</aside>

<aside>
❌

**4. Scalability Issues**
As driver count grows, the manual process becomes exponentially more difficult. Current process doesn't scale beyond small operations.

</aside>

<aside>
❌

**5. Payment Delays**
The tedious manual process may cause delays in driver payments after verification, impacting driver satisfaction and retention.

</aside>

<aside>
❌

**6. No Audit Trail**
Difficult to track payment history, verify calculations, or resolve disputes without re-doing manual searches.

</aside>

### Business Impact

**Operational Costs:**

- Administrative time waste: ~10 min/driver × 20-50 drivers/week = 3-8 hours/week
- Potential calculation errors requiring corrections
- Staff frustration and burnout from repetitive tasks

**Driver Experience:**

- Payment delays reduce driver satisfaction
- Lack of transparency into accumulated bonuses
- Verification process feels opaque and slow

**Business Risk:**

- No scalability path for growth
- Manual errors could lead to financial discrepancies
- Competitive disadvantage vs. automated competitors

## 1.3 Solution Overview

<aside>
✨

**Vision:** A centralized web application that automatically accumulates driver bonuses from weekly Excel imports, provides instant visibility into pending payments, and eliminates manual calculation work.

</aside>

**Core Functionality:**

- **Weekly Import System:** Upload Excel files every Monday → automatic parsing and database storage
- **Cumulative Tracking:** Bonuses automatically accumulate per driver (Week 1: 10,000 + Week 2: 3,000 + Week 3: 5,000 = 18,000)
- **Instant Lookup:** Search driver by ID or name → see complete bonus history and total
- **Verification Management:** Mark drivers as verified → trigger payment workflow
- **Payment Processing:** Record payments and clear accumulated bonuses

**Technology Stack:**

- **Frontend:** Vanilla JavaScript (HTML5, CSS3, vanilla JS)
- **Backend:** Node.js with Express.js framework
- **Database:** MySQL for relational data storage
- **Excel Processing:** Node.js libraries (`exceljs` or `xlsx`)

---

# 2. System Architecture

## 2.1 Architecture Diagram

```jsx
┌─────────────────┐
│   Web Browser   │
│  (Vanilla JS)   │
└────────┬────────┘
         │ HTTP/HTTPS
         ↓
┌─────────────────┐
│   Node.js API   │
│  (Express.js)   │
├─────────────────┤
│ • File Upload   │
│ • Excel Parser  │
│ • API Endpoints │
│ • Business Logic│
└────────┬────────┘
         │ SQL Queries
         ↓
┌─────────────────┐
│  MySQL Database │
├─────────────────┤
│ • drivers       │
│ • bonuses       │
│ • payments      │
│ • import_logs   │
│ • users         │
└─────────────────┘
```

## 2.2 System Components

### Presentation Layer (Frontend)

- Vanilla JavaScript web application
- Responsive UI for desktop and mobile
- Role-based interface elements
- Real-time search and data visualization

### Application Layer (Backend)

- Node.js with Express.js REST API
- Authentication and authorization middleware
- Business logic processing
- Excel file parsing and validation

### Data Layer (Database)

- MySQL relational database
- Normalized schema with referential integrity
- Indexed queries for performance
- Audit trail and transaction logging

---

# 3. Functional Requirements

## 3.1 User Roles and Permissions

### Admin Role

- Full access to all features
- Can create, edit, and delete users
- Can view all audit logs
- Can delete or modify data
- User management capabilities

### Staff Role

- Can upload Excel files
- Can search and view driver information
- Can view bonus accumulations
- Can mark drivers as verified
- Can process payments
- **Cannot** manage users
- **Cannot** view all audit logs

## 3.2 Core Features

### Feature 1: User Authentication

- Secure login with email and password
- JWT-based session management
- Password hashing with bcrypt
- Role-based access control
- Password change functionality

### Feature 2: Excel Import System

- Pre-upload file validation with checklist
- Weekly bonus file upload
- Automatic data parsing and validation
- Verified driver blocking
- Import summary reporting with detailed statistics
- Error handling and logging
- Import history with visual statistics display

### Feature 3: Driver Management

- Real-time driver search
- Driver detail view with bonus history
- Verification status management with password confirmation
- Bonus accumulation tracking
- Audit trail for driver verification

### Feature 4: Payment Processing

- Payment recording
- Payment history tracking
- Audit trail with user attribution
- Date range filtering

### Feature 5: Dashboard Analytics

- Total pending bonuses display
- Unverified driver count
- Weekly import statistics
- Recent activity overview

---

# 4. Business Logic & Rules

## 4.1 Driver Lifecycle Management

<aside>
⚠️

**CRITICAL BUSINESS RULE: Verified Driver Import Blocking**

</aside>

### Driver States & Payment Flow

**Unverified Driver (Bonus Accumulation Mode):**

- Driver is newly registered or awaiting document verification
- Excel imports are **allowed** for this driver
- Bonuses accumulate weekly in the database
- Example: Week 1: 10,000 + Week 2: 3,000 + Week 3: 5,000 = **18,000 pending**
- Payment happens **once** after verification (lump sum of all accumulated bonuses)

**Verified Driver (Direct Payment Mode):**

- Driver has submitted documents and been verified
- Excel imports are **BLOCKED** for this driver
- System rejects import rows with notification: *"Driver [ID] is marked as verified. Import not allowed."*
- Driver receives **weekly direct payments** going forward (outside this system)
- No more bonus accumulation in the database

### Why This Matters

**Problem Solved:**

- Prevents double-payment to verified drivers
- Clear separation between accumulation phase and direct payment phase
- Audit trail shows when driver transitioned from accumulation to direct payment

**Business Logic:**

- Verification is a **one-way transition** (cannot be reverted)
- Once verified and accumulated bonuses are paid, driver exits the accumulation system
- Future weekly bonuses are paid directly by Yango (not tracked in this system)

## 4.2 Import Processing Logic

### File Validation Rules

**Before processing any data:**

**1. Check sheet count:**

- **IF file has multiple sheets** → **REJECT file immediately**
- Display error: *"Excel file contains X sheets. Please upload a file with only one sheet."*
- No data processing occurs
- **IF file has exactly one sheet** → Proceed to column detection

**2. Column Detection & Validation (Strict Matching):**

<aside>
⚠️

**Strict Column Names:** Column names must match exactly (case-insensitive only). No typos or variations allowed.

</aside>

**Expected column names (case-insensitive):**

- `ID` - Required
- `Full name` - Required
- `Phone number` - Optional
- `Date` - Required
- `Net payout` - Required (must contain only numeric values)

**Validation process:**

- **Step 1:** Read the first row (header row) from Excel
- **Step 2:** Match columns using **exact name matching (case-insensitive)**:
    - "ID" = "id" = "Id" = "iD" ✅ (all valid)
    - "Phone number" = "PHONE NUMBER" = "phone number" ✅ (all valid)
    - "Phone" ❌ (rejected - not exact match)
    - "Pone number" ❌ (rejected - typo not allowed)
    - "Net payout" = "net payout" = "NET PAYOUT" ✅ (all valid)
- **Step 3:** Validate required columns are present:
    - **Required:** ID, Full name, Date, Net payout
    - **Optional:** Phone number
    - **IF required column missing or misspelled** → Reject file with clear error message
- **Step 4:** Validate data types for numeric column:
    - **Net payout** column: All values must be numbers (decimals allowed)
    - **IF non-numeric value found** → Add row to error list

### Error Messages

*Missing required column:*

- "Required column 'ID' not found. Please check your Excel file has a column named 'ID'."
- "Required column 'Net payout' not found. Please check your Excel file."

*Misspelled column:*

- "Column 'Pone number' not recognized. Did you mean 'Phone number'?"
- "Column 'Phone' not recognized. Expected column name is 'Phone number'."

*Invalid numeric value:*

- "Row 5: 'Net payout' must be a number. Found: 'ABC'"

### Validation Scenarios

*Scenario 1: Correct columns (different case)*

- Excel has: "id", "full name", "phone number", "date", "net payout"
- System matches all columns (case-insensitive) ✅
- Import proceeds ✅

*Scenario 2: Correct columns (different order)*

- Excel has: "Date", "Full name", "Net payout", "ID", "Phone number"
- System searches for each column by name (ignores position) ✅
- Import proceeds ✅

*Scenario 3: Typo in column name*

- Excel has: "ID", "Full name", "Pone number", "Date", "Net payout"
- System error: "Column 'Pone number' not recognized. Did you mean 'Phone number'?" ❌
- Import rejected ❌

*Scenario 4: Missing required column*

- Excel has: "Name", "Date", "Amount" (missing "ID" column)
- System error: "Required column 'ID' not found. Please check your Excel file." ❌
- Import rejected ❌

*Scenario 5: Non-numeric value in amount column*

- Excel has correct columns, but Row 10 has "Net payout" = "TBD"
- Row 10 added to error list: "Row 10: 'Net payout' must be a number. Found: 'TBD'" ❌
- Other valid rows can still be imported (partial success)

## 4.3 Row Processing Logic

**When processing each Excel row:**

1. **Check if driver_id exists in database:**
    - **NO** → New driver, create driver record (verified=false) + insert bonus
    - **YES** → Driver exists, check verification status:
        - **verified = false** → Unverified, insert bonus (accumulation continues)
        - **verified = true** → **REJECT row**, add to skipped items with notification
2. **Import Summary Report:**
    - ✅ Successfully imported: X records
    - ⏭️ Skipped (verified drivers): Y records
        - List of skipped driver_ids with names
    - ❌ Errors: Z records (format issues, missing data, etc.)

---

# 5. Technical Specification

## 5.1 Database Schema

### ERD (Entity Relationship Diagram)

```jsx
┌─────────────────┐       ┌─────────────────┐
│    drivers      │       │     bonuses     │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │───┐   │ id (PK)         │
│ driver_id       │   └──<│ driver_id (FK)  │
│ name            │       │ week_date       │
│ phone           │       │ bonus_amount    │
│ email           │       │ imported_at     │
│ verified        │       │ import_log_id   │
│ verified_date   │       └─────────────────┘
│ created_at      │              │
│ updated_at      │              │
└─────────────────┘              │
        │                        │
        │       ┌────────────────┘
        │       │
        │       ↓
        │  ┌─────────────────┐
        │  │  import_logs    │
        │  ├─────────────────┤
        │  │ id (PK)         │
        │  │ file_name       │
        │  │ week_date       │
        │  │ records_count   │
        │  │ imported_by     │
        │  │ imported_at     │
        │  └─────────────────┘
        │
        └──>
    ┌─────────────────┐
    │    payments     │
    ├─────────────────┤
    │ id (PK)         │
    │ driver_id (FK)  │
    │ total_amount    │
    │ payment_date    │
    │ payment_method  │
    │ bonus_period    │
    │ processed_by    │
    │ notes           │
    │ created_at      │
    └─────────────────┘
```

### Table Definitions

### 5.1.1 drivers table

```sql
CREATE TABLE drivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id VARCHAR(64) UNIQUE NOT NULL,  -- Long hash ID from Excel
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  email VARCHAR(255),
  verified BOOLEAN DEFAULT FALSE,
  verified_date DATE NULL,
  verified_by INT NULL,  -- Foreign key to users table
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (verified_by) REFERENCES users(id),
  INDEX idx_driver_id (driver_id),
  INDEX idx_verified (verified),
  INDEX idx_name (full_name)
);
```

**Purpose:** Store driver master data and verification status

**Key Fields:**

- `driver_id`: Unique hash identifier from Yango Excel (e.g., `85fb80236ffa474db93fdccd0cdab66b`)
- `full_name`: Driver's full name from Excel "Full name" column
- `phone_number`: Driver's phone from Excel "Phone number" column
- `email`: Driver's email address (optional)
- `verified`: Boolean flag indicating verification status
- `verified_date`: When driver was verified (for filtering bonuses)
- `verified_by`: Links to the user who verified the driver (for audit trail)
- `created_at`: When the driver record was created
- `updated_at`: Last update timestamp

### 5.1.2 bonuses table

```sql
CREATE TABLE bonuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id VARCHAR(64) NOT NULL,
  week_date DATE NOT NULL,
  net_payout DECIMAL(10, 2) NOT NULL,  -- From Excel "Net payout" column
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  import_log_id INT,
  FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
  FOREIGN KEY (import_log_id) REFERENCES import_logs(id),
  INDEX idx_driver_week (driver_id, week_date),
  INDEX idx_week_date (week_date),
  UNIQUE KEY unique_driver_week (driver_id, week_date)
);
```

**Purpose:** Store individual weekly bonus entries

**Key Fields:**

- `driver_id`: Links to driver (hash ID from Excel)
- `week_date`: Date from Excel "Date" column (e.g., `1-Dec-25`)
- `net_payout`: The bonus amount from Excel "Net payout" column (e.g., `1235.7`, `2903.33`, `552.85`)
- `import_log_id`: Tracks which file import this came from

**Important Constraint:**

> `UNIQUE KEY unique_driver_week`: Prevents duplicate bonuses for same driver in same week
> 

### 5.1.3 payments table

```sql
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id VARCHAR(50) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50),
  bonus_period_start DATE,
  bonus_period_end DATE,
  processed_by INT,  -- Foreign key to users table
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
  FOREIGN KEY (processed_by) REFERENCES users(id),
  INDEX idx_driver_id (driver_id),
  INDEX idx_payment_date (payment_date)
);
```

**Purpose:** Record payment transactions and audit trail

**Key Fields:**

- `total_amount`: Sum of bonuses paid
- `bonus_period_start/end`: Date range of bonuses included
- `processed_by`: Links to the admin user who processed payment
- `notes`: Additional payment details or references

### 5.1.4 import_logs table

```sql
CREATE TABLE import_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  week_date DATE NOT NULL,
  total_records INT NOT NULL,
  success_count INT NOT NULL,
  skipped_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  new_drivers_count INT DEFAULT 0,
  existing_drivers_count INT DEFAULT 0,
  rejected_verified_count INT DEFAULT 0,
  skipped_details JSON,
  imported_by INT,  -- Foreign key to users table
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('success', 'partial', 'failed') DEFAULT 'success',
  error_message TEXT,
  FOREIGN KEY (imported_by) REFERENCES users(id),
  INDEX idx_week_date (week_date)
);
```

**Purpose:** Track Excel file imports for audit and troubleshooting with detailed statistics

**Key Fields:**

- `file_name`: Original Excel filename
- `week_date`: Week date for the imported bonuses
- `total_records`: Total rows in Excel file
- `success_count`: Number of bonuses successfully imported
- `skipped_count`: Number of verified drivers skipped
- `error_count`: Number of rows with errors
- `new_drivers_count`: Number of new drivers created during this import
- `existing_drivers_count`: Number of existing drivers updated during this import
- `rejected_verified_count`: Number of verified drivers that were rejected
- `skipped_details`: JSON array with {driver_id, name, reason} for each skipped row
- `imported_by`: Links to the user who performed the import
- `imported_at`: Timestamp when import was performed
- `status`: Import success/failure status (success, partial, failed)
- `error_message`: Details about any errors that occurred

### 5.1.5 users table

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT NULL,
  INDEX idx_email (email),
  INDEX idx_role (role),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**Purpose:** Store user accounts and authentication information

**Key Fields:**

- `full_name`: User's full name for display
- `email`: Unique email for login (username)
- `password_hash`: Bcrypt hashed password (never store plain text!)
- `role`: User role - either 'admin' or 'staff'
- `is_active`: Flag to enable/disable user accounts without deletion
- `last_login`: Track last login time
- `created_by`: Which admin created this user (for audit trail)

### Key SQL Queries

### Get accumulated bonuses for a driver:

```sql
SELECT 
  d.driver_id,
  d.full_name,
  SUM([b.net](http://b.net)_payout) as total_bonus,
  COUNT([b.id](http://b.id)) as weeks_count,
  MIN(b.week_date) as first_week,
  MAX(b.week_date) as last_week
FROM drivers d
JOIN bonuses b ON d.driver_id = b.driver_id
WHERE d.driver_id = ?
GROUP BY d.driver_id, d.full_name;
```

### Get all unverified drivers with pending bonuses:

```sql
SELECT 
  d.driver_id,
  d.full_name,
  [d.phone](http://d.phone)_number,
  SUM([b.net](http://b.net)_payout) as total_pending,
  COUNT([b.id](http://b.id)) as weeks_pending,
  MAX(b.week_date) as latest_bonus_date
FROM drivers d
JOIN bonuses b ON d.driver_id = b.driver_id
WHERE d.verified = FALSE
GROUP BY d.driver_id, d.full_name, [d.phone](http://d.phone)_number
ORDER BY total_pending DESC;
```

### Get detailed bonus breakdown for payment:

```sql
SELECT 
  b.week_date,
  [b.net](http://b.net)_payout,
  b.imported_at,
  il.file_name
FROM bonuses b
LEFT JOIN import_logs il ON b.import_log_id = [il.id](http://il.id)
WHERE b.driver_id = ?
ORDER BY b.week_date DESC;
```

## 5.2 API Reference

### Authentication Endpoints

### POST /api/auth/login

**Description:** Authenticate user and receive JWT token

**Access:** Public

**Request:**

```json
POST /api/auth/login
Content-Type: application/json

{
  "email": "[staff@example.com](mailto:staff@example.com)",
  "password": "SecurePass123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "full_name": "John Doe",
    "email": "[staff@example.com](mailto:staff@example.com)",
    "role": "staff",
    "last_login": "2025-12-23T08:30:00Z"
  }
}
```

**Error Response (401):**

```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

### POST /api/auth/logout

**Description:** Logout current user and invalidate session

**Access:** Authenticated users

**Request:**

```json
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /api/auth/me

**Description:** Get current authenticated user profile

**Access:** Authenticated users

**Request:**

```json
GET /api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "user": {
    "id": 1,
    "full_name": "John Doe",
    "email": "[staff@example.com](mailto:staff@example.com)",
    "role": "staff",
    "is_active": true,
    "last_login": "2025-12-23T08:30:00Z",
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

### POST /api/auth/change-password

**Description:** Change own password

**Access:** Authenticated users

**Request:**

```json
POST /api/auth/change-password
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "current_password": "OldPass123",
  "new_password": "NewSecurePass456"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Response (400):**

```json
{
  "success": false,
  "error": "Current password is incorrect"
}
```

### User Management Endpoints (Admin Only)

### GET /api/users

**Description:** List all users

**Access:** Admin only

**Request:**

```json
GET /api/users
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "full_name": "Admin User",
      "email": "[admin@example.com](mailto:admin@example.com)",
      "role": "admin",
      "is_active": true,
      "last_login": "2025-12-23T08:00:00Z",
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": 2,
      "full_name": "Staff Member",
      "email": "[staff@example.com](mailto:staff@example.com)",
      "role": "staff",
      "is_active": true,
      "last_login": "2025-12-22T15:30:00Z",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/users

**Description:** Create new user account

**Access:** Admin only

**Request:**

```json
POST /api/users
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "full_name": "New Staff Member",
  "email": "[newstaff@example.com](mailto:newstaff@example.com)",
  "password": "TempPassword123",
  "role": "staff"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": 3,
    "full_name": "New Staff Member",
    "email": "[newstaff@example.com](mailto:newstaff@example.com)",
    "role": "staff",
    "is_active": true,
    "created_at": "2025-12-23T08:37:00Z",
    "created_by": 1
  }
}
```

**Error Response (400):**

```json
{
  "success": false,
  "error": "Email already exists"
}
```

### GET /api/users/:id

**Description:** Get specific user details

**Access:** Admin only

**Request:**

```json
GET /api/users/2
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "user": {
    "id": 2,
    "full_name": "Staff Member",
    "email": "[staff@example.com](mailto:staff@example.com)",
    "role": "staff",
    "is_active": true,
    "last_login": "2025-12-22T15:30:00Z",
    "created_at": "2025-01-15T10:00:00Z",
    "created_by": 1
  }
}
```

### PUT /api/users/:id

**Description:** Update user details

**Access:** Admin only

**Request:**

```json
PUT /api/users/2
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "full_name": "Updated Staff Name",
  "email": "[updated@example.com](mailto:updated@example.com)",
  "role": "admin",
  "is_active": true
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "User updated successfully",
  "user": {
    "id": 2,
    "full_name": "Updated Staff Name",
    "email": "[updated@example.com](mailto:updated@example.com)",
    "role": "admin",
    "is_active": true,
    "updated_at": "2025-12-23T08:40:00Z"
  }
}
```

### DELETE /api/users/:id

**Description:** Deactivate user (soft delete)

**Access:** Admin only

**Request:**

```json
DELETE /api/users/2
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "User deactivated successfully"
}
```

### PUT /api/users/:id/reset-password

**Description:** Admin resets user password

**Access:** Admin only

**Request:**

```json
PUT /api/users/2/reset-password
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "new_password": "ResetPassword123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### Driver Endpoints

### GET /api/drivers

**Description:** List all drivers with pagination

**Access:** Staff + Admin

**Request:**

```json
GET /api/drivers?page=1&limit=50
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "drivers": [
    {
      "id": 1,
      "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
      "full_name": "Lemenih Wubamlak",
      "phone_number": "935251885",
      "verified": false,
      "verified_date": null,
      "created_at": "2025-12-01T10:00:00Z"
    },
    {
      "id": 2,
      "driver_id": "a3c4f89e1b234d5678901234567890ab",
      "full_name": "Abebe Kebede",
      "phone_number": "911223344",
      "verified": true,
      "verified_date": "2025-12-15",
      "created_at": "2025-11-20T09:30:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_records": 245,
    "per_page": 50
  }
}
```

### GET /api/drivers/:id

**Description:** Get specific driver details

**Access:** Staff + Admin

**Request:**

```json
GET /api/drivers/85fb80236ffa474db93fdccd0cdab66b
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "driver": {
    "id": 1,
    "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
    "full_name": "Lemenih Wubamlak",
    "phone_number": "935251885",
    "email": null,
    "verified": false,
    "verified_date": null,
    "created_at": "2025-12-01T10:00:00Z",
    "updated_at": "2025-12-01T10:00:00Z"
  }
}
```

### GET /api/drivers/search

**Description:** Search drivers by name or ID

**Access:** Staff + Admin

**Request:**

```json
GET /api/drivers/search?q=Lemenih
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "results": [
    {
      "id": 1,
      "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
      "full_name": "Lemenih Wubamlak",
      "phone_number": "935251885",
      "verified": false,
      "total_pending_bonus": 18735.57
    }
  ],
  "count": 1
}
```

### PUT /api/drivers/:id/verify

**Description:** Mark driver as verified (requires password confirmation)

**Access:** Staff + Admin

**Security:** User must enter their password to confirm this action

**Request:**

```json
PUT /api/drivers/85fb80236ffa474db93fdccd0cdab66b/verify
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "verified_date": "2025-12-23",
  "password": "UserPassword123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Driver verified successfully",
  "driver": {
    "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
    "full_name": "Lemenih Wubamlak",
    "verified": true,
    "verified_date": "2025-12-23",
    "verified_by": "Admin User"
  }
}
```

**Error Response (401):**

```json
{
  "success": false,
  "error": "Invalid password. Please enter your correct password to confirm verification."
}
```

### Bonus Endpoints

### GET /api/bonuses/driver/:driverId

**Description:** Get all bonus records for a driver with sorting

**Access:** Staff + Admin

**Request:**

```json
GET /api/bonuses/driver/85fb80236ffa474db93fdccd0cdab66b?sortBy=date&order=desc
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "driver": {
    "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
    "full_name": "Lemenih Wubamlak",
    "verified": false
  },
  "bonuses": [
    {
      "id": 127,
      "week_date": "2025-12-15",
      "net_payout": 5500.25,
      "imported_at": "2025-12-16T08:00:00+03:00",
      "import_log_id": 18
    },
    {
      "id": 98,
      "week_date": "2025-12-08",
      "net_payout": 3235.50,
      "imported_at": "2025-12-09T08:15:00+03:00",
      "import_log_id": 15
    },
    {
      "id": 67,
      "week_date": "2025-12-01",
      "net_payout": 8764.12,
      "imported_at": "2025-12-02T08:30:00+03:00",
      "import_log_id": 12
    },
    {
      "id": 45,
      "week_date": "2025-11-24",
      "net_payout": 1235.70,
      "imported_at": "2025-11-25T09:00:00+03:00",
      "import_log_id": 9
    }
  ],
  "total_bonus": 18735.57,
  "total_count": 4
}
```

### GET /api/bonuses/driver/:driverId/total

**Description:** Get accumulated bonus total for a driver

**Access:** Staff + Admin

**Request:**

```json
GET /api/bonuses/driver/85fb80236ffa474db93fdccd0cdab66b/total
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
  "full_name": "Lemenih Wubamlak",
  "phone_number": "935251885",
  "verified": false,
  "verified_date": null,
  "total_bonus": 18735.57,
  "weeks_count": 4,
  "first_week": "2025-11-24",
  "last_week": "2025-12-15"
}
```

### GET /api/bonuses/driver/:driverId/import-history

**Description:** Get import history for a driver

**Access:** Staff + Admin

**Request:**

```json
GET /api/bonuses/driver/85fb80236ffa474db93fdccd0cdab66b/import-history
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
  "full_name": "Lemenih Wubamlak",
  "import_history": [
    {
      "import_log_id": 18,
      "import_date": "2025-12-16T08:00:00+03:00",
      "file_name": "bonuses_week3_december.xlsx",
      "week_date": "2025-12-15",
      "bonus_amount": 5500.25,
      "imported_by": "Admin User",
      "imported_by_email": "[admin@example.com](mailto:admin@example.com)"
    },
    {
      "import_log_id": 15,
      "import_date": "2025-12-09T08:15:00+03:00",
      "file_name": "bonuses_week2_december.xlsx",
      "week_date": "2025-12-08",
      "bonus_amount": 3235.50,
      "imported_by": "Staff Member",
      "imported_by_email": "[staff@example.com](mailto:staff@example.com)"
    },
    {
      "import_log_id": 12,
      "import_date": "2025-12-02T08:30:00+03:00",
      "file_name": "bonuses_week1_december.xlsx",
      "week_date": "2025-12-01",
      "bonus_amount": 8764.12,
      "imported_by": "Admin User",
      "imported_by_email": "[admin@example.com](mailto:admin@example.com)"
    },
    {
      "import_log_id": 9,
      "import_date": "2025-11-25T09:00:00+03:00",
      "file_name": "bonuses_week4_november.xlsx",
      "week_date": "2025-11-24",
      "bonus_amount": 1235.70,
      "imported_by": "Admin User",
      "imported_by_email": "[admin@example.com](mailto:admin@example.com)"
    }
  ],
  "total_imports": 4
}
```

### GET /api/bonuses/pending

**Description:** Get all unverified drivers with pending bonuses

**Access:** Staff + Admin

**Request:**

```json
GET /api/bonuses/pending?sortBy=amount&order=desc
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "pending_drivers": [
    {
      "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
      "full_name": "Lemenih Wubamlak",
      "phone_number": "935251885",
      "total_bonus": 18735.57,
      "weeks_count": 4,
      "first_week": "2025-11-24",
      "last_week": "2025-12-15"
    },
    {
      "driver_id": "b4d5e90f2c345e6789012345678901bc",
      "full_name": "Tigist Alemu",
      "phone_number": "922334455",
      "total_bonus": 12300.75,
      "weeks_count": 2,
      "first_week": "2025-12-08",
      "last_week": "2025-12-15"
    }
  ],
  "total_pending_amount": 31036.32,
  "total_drivers": 2
}
```

### Upload Endpoints

### POST /api/uploads/validate

**Description:** Validate Excel file before upload (pre-upload validation)

**Access:** Staff + Admin

**Purpose:** Check file validity before actual import

**Request:**

```json
POST /api/uploads/validate
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data

file: bonuses_week1_dec.xlsx
```

**Success Response (200):**

```json
{
  "success": true,
  "validation_results": {
    "file_readable": true,
    "single_sheet": true,
    "sheet_count": 1,
    "columns_valid": true,
    "required_columns_present": true,
    "columns_found": ["ID", "Full name", "Phone number", "Date", "Net payout"],
    "row_count": 52,
    "has_data": true,
    "numeric_validation": true
  },
  "checklist": [
    {"item": "File is readable", "status": "passed", "icon": "✅"},
    {"item": "Single sheet only", "status": "passed", "icon": "✅"},
    {"item": "All required columns present", "status": "passed", "icon": "✅"},
    {"item": "Column names are correct", "status": "passed", "icon": "✅"},
    {"item": "File contains data", "status": "passed", "icon": "✅"},
    {"item": "Net payout values are numeric", "status": "passed", "icon": "✅"}
  ],
  "ready_for_import": true,
  "message": "File validation passed. Ready to import."
}
```

**Error Response (400) - Multiple Sheets:**

```json
{
  "success": false,
  "validation_results": {
    "file_readable": true,
    "single_sheet": false,
    "sheet_count": 3,
    "columns_valid": false,
    "required_columns_present": false
  },
  "checklist": [
    {"item": "File is readable", "status": "passed", "icon": "✅"},
    {"item": "Single sheet only", "status": "failed", "icon": "❌"},
    {"item": "All required columns present", "status": "not_checked", "icon": "⏭️"},
    {"item": "Column names are correct", "status": "not_checked", "icon": "⏭️"},
    {"item": "File contains data", "status": "not_checked", "icon": "⏭️"},
    {"item": "Net payout values are numeric", "status": "not_checked", "icon": "⏭️"}
  ],
  "ready_for_import": false,
  "message": "Validation failed: Excel file contains 3 sheets. Please upload a file with only one sheet."
}
```

**Error Response (400) - Missing Columns:**

```json
{
  "success": false,
  "validation_results": {
    "file_readable": true,
    "single_sheet": true,
    "sheet_count": 1,
    "columns_valid": false,
    "required_columns_present": false,
    "columns_found": ["Name", "Date", "Amount"],
    "missing_columns": ["ID", "Full name", "Net payout"]
  },
  "checklist": [
    {"item": "File is readable", "status": "passed", "icon": "✅"},
    {"item": "Single sheet only", "status": "passed", "icon": "✅"},
    {"item": "All required columns present", "status": "failed", "icon": "❌"},
    {"item": "Column names are correct", "status": "failed", "icon": "❌"},
    {"item": "File contains data", "status": "passed", "icon": "✅"},
    {"item": "Net payout values are numeric", "status": "not_checked", "icon": "⏭️"}
  ],
  "ready_for_import": false,
  "message": "Validation failed: Required columns missing - ID, Full name, Net payout"
}
```

### POST /api/uploads/excel

**Description:** Upload and process Excel file with weekly bonus data

**Access:** Staff + Admin

**Note:** Should be called only after validation passes

**Request:**

```json
POST /api/uploads/excel
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data

file: bonuses_week1_dec.xlsx
week_date: 2025-12-01
```

**Success Response (200):**

```json
{
  "success": true,
  "import_log_id": 15,
  "file_name": "bonuses_week1_dec.xlsx",
  "week_date": "2025-12-01",
  "total_records": 52,
  "success_count": 45,
  "skipped_count": 5,
  "error_count": 2,
  "skipped_details": [
    {
      "driver_id": "a3c4f89e1b234d5678901234567890ab",
      "full_name": "Abebe Kebede",
      "reason": "Driver is marked as verified. Import not allowed."
    },
    {
      "driver_id": "c5e6a11d3f456g7890123456789012cd",
      "full_name": "Marta Getachew",
      "reason": "Driver is marked as verified. Import not allowed."
    }
  ],
  "errors": [
    {
      "row": 10,
      "error": "Net payout must be a number. Found: 'TBD'"
    },
    {
      "row": 25,
      "error": "Missing required field: driver_id"
    }
  ],
  "summary": {
    "new_drivers_created": 3,
    "existing_drivers_updated": 42,
    "verified_drivers_skipped": 5,
    "import_errors": 2
  }
}
```

**Error Response (400) - Multiple Sheets:**

```json
{
  "success": false,
  "error": "Excel file contains 3 sheets. Please upload a file with only one sheet."
}
```

**Error Response (400) - Invalid Columns:**

```json
{
  "success": false,
  "error": "Required column 'ID' not found. Please check your Excel file has a column named 'ID'.",
  "missing_columns": ["ID"],
  "found_columns": ["Name", "Date", "Amount"]
}
```

### GET /api/uploads/history

**Description:** View detailed import history logs with statistics

**Access:** Staff + Admin

**Request:**

```json
GET /api/uploads/history?page=1&limit=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "imports": [
    {
      "id": 15,
      "file_name": "bonuses_week1_dec.xlsx",
      "week_date": "2025-12-01",
      "total_records": 52,
      "success_count": 45,
      "skipped_count": 5,
      "error_count": 2,
      "new_drivers_count": 3,
      "existing_drivers_count": 42,
      "rejected_verified_count": 5,
      "status": "partial",
      "imported_by": "Admin User",
      "imported_at": "2025-12-02T08:00:00+03:00",
      "summary_text": "45 inserted, 5 rejected (verified drivers), 3 new drivers, 2 errors"
    },
    {
      "id": 14,
      "file_name": "bonuses_nov_week4.xlsx",
      "week_date": "2025-11-25",
      "total_records": 48,
      "success_count": 48,
      "skipped_count": 0,
      "error_count": 0,
      "new_drivers_count": 5,
      "existing_drivers_count": 43,
      "rejected_verified_count": 0,
      "status": "success",
      "imported_by": "Staff Member",
      "imported_at": "2025-11-26T08:15:00+03:00",
      "summary_text": "48 inserted, 0 rejected, 5 new drivers, 0 errors"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 3,
    "total_records": 50,
    "per_page": 20
  }
}
```

**UI Display Example:**

```
╔════════════════════════════════════════════════════════════════════════════╗
║                        Import History                                      ║
╠════════════════════════════════════════════════════════════════════════════╣
║ Date: Dec 2, 2025 08:00 AM | File: bonuses_week1_dec.xlsx                ║
║ ✅ 45 inserted | ❌ 5 rejected (verified) | 🆕 3 new drivers | ⚠️ 2 errors  ║
║ Imported by: Admin User                                                    ║
╟────────────────────────────────────────────────────────────────────────────╢
║ Date: Nov 26, 2025 08:15 AM | File: bonuses_nov_week4.xlsx               ║
║ ✅ 48 inserted | ❌ 0 rejected | 🆕 5 new drivers | ⚠️ 0 errors             ║
║ Imported by: Staff Member                                                  ║
╚════════════════════════════════════════════════════════════════════════════╝
```

### Payment Endpoints

### POST /api/payments

**Description:** Record payment for a driver

**Access:** Staff + Admin

**Request:**

```json
POST /api/payments
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
  "total_amount": 18735.57,
  "payment_date": "2025-12-23",
  "payment_method": "Bank Transfer",
  "bonus_period_start": "2025-11-24",
  "bonus_period_end": "2025-12-15",
  "notes": "Accumulated bonuses for 4 weeks (Nov 24 - Dec 15)"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "payment": {
    "id": 42,
    "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
    "driver_name": "Lemenih Wubamlak",
    "total_amount": 18735.57,
    "payment_date": "2025-12-23",
    "payment_method": "Bank Transfer",
    "bonus_period": "2025-11-24 to 2025-12-15",
    "processed_by": "Admin User",
    "notes": "Accumulated bonuses for 4 weeks (Nov 24 - Dec 15)",
    "created_at": "2025-12-23T08:37:00Z"
  }
}
```

**Error Response (400):**

```json
{
  "success": false,
  "error": "Driver not found or has no pending bonuses"
}
```

### GET /api/payments/history

**Description:** View payment history with filters

**Access:** Staff + Admin

**Request:**

```json
GET /api/payments/history?driver_id=85fb80236ffa474db93fdccd0cdab66b&start_date=2025-12-01&end_date=2025-12-31&page=1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**

```json
{
  "success": true,
  "payments": [
    {
      "id": 42,
      "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
      "driver_name": "Lemenih Wubamlak",
      "phone_number": "935251885",
      "total_amount": 18735.57,
      "payment_date": "2025-12-23",
      "payment_method": "Bank Transfer",
      "bonus_period_start": "2025-11-24",
      "bonus_period_end": "2025-12-15",
      "weeks_included": 4,
      "processed_by": "Admin User",
      "notes": "Accumulated bonuses for 4 weeks (Nov 24 - Dec 15)",
      "created_at": "2025-12-23T08:37:00Z"
    }
  ],
  "summary": {
    "total_payments": 1,
    "total_amount_paid": 18735.57,
    "date_range": {
      "start": "2025-12-01",
      "end": "2025-12-31"
    }
  },
  "pagination": {
    "current_page": 1,
    "total_pages": 1,
    "total_records": 1,
    "per_page": 20
  }
}
```

### Common Error Responses

**401 Unauthorized:**

```json
{
  "success": false,
  "error": "Unauthorized. Please login to access this resource."
}
```

**403 Forbidden (Admin Only Endpoint):**

```json
{
  "success": false,
  "error": "Forbidden. This action requires admin privileges."
}
```

**404 Not Found:**

```json
{
  "success": false,
  "error": "Resource not found"
}
```

**500 Internal Server Error:**

```json
{
  "success": false,
  "error": "Internal server error. Please try again later.",
  "error_id": "ERR-2025-12-23-001"
}
```

### API Usage Notes

<aside>
ℹ️

**Important API Guidelines:**

• All authenticated requests require the **Authorization** header with JWT token
• All POST/PUT requests use **Content-Type: application/json** (except file uploads which use multipart/form-data)
• Dates use **ISO 8601 format** (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)
• All monetary amounts are in **decimal format** with 2 decimal places
• Pagination uses **page** and **limit** query parameters (default: page=1, limit=20)
• Token should be stored securely on client side (localStorage or sessionStorage)
• Tokens expire after 24 hours and require re-authentication

</aside>

### Complete Driver Bonus Display Example

<aside>
📋

**Real-World Example:** How bonus data is fetched and displayed for a single driver

</aside>

This section demonstrates how multiple API endpoints work together to display comprehensive bonus information for a driver.

### Step 1: Get Driver Summary with Total Bonus

**API Call:**

```
GET /api/bonuses/driver/85fb80236ffa474db93fdccd0cdab66b/total
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**

```json
{
  "success": true,
  "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
  "full_name": "Lemenih Wubamlak",
  "phone_number": "935251885",
  "verified": false,
  "verified_date": null,
  "total_bonus": 18735.57,
  "weeks_count": 4,
  "first_week": "2025-11-24",
  "last_week": "2025-12-15"
}
```

### Step 2: Get Detailed Weekly Bonus Breakdown

**API Call:**

```
GET /api/bonuses/driver/85fb80236ffa474db93fdccd0cdab66b?sortBy=date&order=desc
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**

```json
{
  "success": true,
  "driver": {
    "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
    "full_name": "Lemenih Wubamlak",
    "phone_number": "935251885",
    "verified": false
  },
  "bonuses": [
    {
      "id": 127,
      "week_date": "2025-12-15",
      "net_payout": 5500.25,
      "imported_at": "2025-12-16T08:00:00+03:00",
      "import_log_id": 18
    },
    {
      "id": 98,
      "week_date": "2025-12-08",
      "net_payout": 3235.50,
      "imported_at": "2025-12-09T08:15:00+03:00",
      "import_log_id": 15
    },
    {
      "id": 67,
      "week_date": "2025-12-01",
      "net_payout": 8764.12,
      "imported_at": "2025-12-02T08:30:00+03:00",
      "import_log_id": 12
    },
    {
      "id": 45,
      "week_date": "2025-11-24",
      "net_payout": 1235.70,
      "imported_at": "2025-11-25T09:00:00+03:00",
      "import_log_id": 9
    }
  ],
  "total_bonus": 18735.57,
  "total_count": 4
}
```

### Step 3: Get Import History (Optional)

**API Call:**

```
GET /api/bonuses/driver/85fb80236ffa474db93fdccd0cdab66b/import-history
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**

```json
{
  "success": true,
  "driver_id": "85fb80236ffa474db93fdccd0cdab66b",
  "full_name": "Lemenih Wubamlak",
  "import_history": [
    {
      "import_log_id": 18,
      "import_date": "2025-12-16T08:00:00+03:00",
      "file_name": "bonuses_week3_december.xlsx",
      "week_date": "2025-12-15",
      "bonus_amount": 5500.25,
      "imported_by": "Admin User",
      "imported_by_email": "[admin@example.com](mailto:admin@example.com)"
    },
    {
      "import_log_id": 15,
      "import_date": "2025-12-09T08:15:00+03:00",
      "file_name": "bonuses_week2_december.xlsx",
      "week_date": "2025-12-08",
      "bonus_amount": 3235.50,
      "imported_by": "Staff Member",
      "imported_by_email": "[staff@example.com](mailto:staff@example.com)"
    },
    {
      "import_log_id": 12,
      "import_date": "2025-12-02T08:30:00+03:00",
      "file_name": "bonuses_week1_december.xlsx",
      "week_date": "2025-12-01",
      "bonus_amount": 8764.12,
      "imported_by": "Admin User",
      "imported_by_email": "[admin@example.com](mailto:admin@example.com)"
    },
    {
      "import_log_id": 9,
      "import_date": "2025-11-25T09:00:00+03:00",
      "file_name": "bonuses_week4_november.xlsx",
      "week_date": "2025-11-24",
      "bonus_amount": 1235.70,
      "imported_by": "Admin User",
      "imported_by_email": "[admin@example.com](mailto:admin@example.com)"
    }
  ],
  "total_imports": 4
}
```

### Frontend UI Display

**How the data appears in the user interface:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Driver Bonus Details                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Driver Information                                             │
│  ─────────────────────────────────────────────────────────────  │
│  Name:           Lemenih Wubamlak                               │
│  Driver ID:      85fb80236ffa474db93fdccd0cdab66b              │
│  Phone:          935251885                                      │
│  Status:         🟡 Unverified                                  │
│                                                                 │
│  ┌───────────────────────────────────────────────────┐         │
│  │  💰 Total Accumulated Bonus: 18,735.57 ETB       │         │
│  │  📅 Weeks Pending: 4                              │         │
│  │  📆 Period: Nov 24, 2025 - Dec 15, 2025          │         │
│  └───────────────────────────────────────────────────┘         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Weekly Bonus Breakdown                                         │
│  ─────────────────────────────────────────────────────────────  │
│  Sort by: [Date ▼]  Order: [Newest First ▼]                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Week: Dec 15, 2025                                      │   │
│  │ Bonus: 5,500.25 ETB                                     │   │
│  │ Imported: Dec 16, 2025 at 08:00 AM                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Week: Dec 08, 2025                                      │   │
│  │ Bonus: 3,235.50 ETB                                     │   │
│  │ Imported: Dec 09, 2025 at 08:15 AM                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Week: Dec 01, 2025                                      │   │
│  │ Bonus: 8,764.12 ETB                                     │   │
│  │ Imported: Dec 02, 2025 at 08:30 AM                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Week: Nov 24, 2025                                      │   │
│  │ Bonus: 1,235.70 ETB                                     │   │
│  │ Imported: Nov 25, 2025 at 09:00 AM                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  📋 Import History                                              │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  • Dec 16, 2025 - bonuses_week3_december.xlsx                  │
│    Amount: 5,500.25 ETB | By: Admin User                       │
│                                                                 │
│  • Dec 09, 2025 - bonuses_week2_december.xlsx                  │
│    Amount: 3,235.50 ETB | By: Staff Member                     │
│                                                                 │
│  • Dec 02, 2025 - bonuses_week1_december.xlsx                  │
│    Amount: 8,764.12 ETB | By: Admin User                       │
│                                                                 │
│  • Nov 25, 2025 - bonuses_week4_november.xlsx                  │
│    Amount: 1,235.70 ETB | By: Admin User                       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [✓ Mark as Verified]  [💳 Process Payment]  [← Back]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Alternative Table Format

**Compact table view for bonus breakdown:**

```
╔═══════════════╦═══════════════╦══════════════╦═══════════════════════╗
║ Week Date     ║ Bonus Amount  ║ File Name    ║ Imported Date/Time    ║
╠═══════════════╬═══════════════╬══════════════╬═══════════════════════╣
║ Dec 15, 2025  ║  5,500.25 ETB ║ week3_dec... ║ Dec 16, 08:00 AM      ║
║ Dec 08, 2025  ║  3,235.50 ETB ║ week2_dec... ║ Dec 09, 08:15 AM      ║
║ Dec 01, 2025  ║  8,764.12 ETB ║ week1_dec... ║ Dec 02, 08:30 AM      ║
║ Nov 24, 2025  ║  1,235.70 ETB ║ week4_nov... ║ Nov 25, 09:00 AM      ║
╠═══════════════╩═══════════════╩══════════════╩═══════════════════════╣
║ TOTAL:                              18,735.57 ETB (4 weeks)           ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### Key Display Elements

**Essential information shown to users:**

1. **Total prominently displayed** at the top (18,735.57 ETB)
2. **Individual weeks** listed with dates and amounts
3. **Sort controls** allow viewing by date or week, ascending/descending
4. **Import metadata** shows when and who imported each bonus
5. **Verification status** clearly visible (Unverified = can accumulate more)
6. **Action buttons** for marking verified or processing payment

**This gives staff instant visibility into:**

- How much the driver has accumulated
- Which weeks contributed to the total
- When bonuses were imported
- Whether the driver can receive payment (verification status)
- Complete audit trail of all bonus additions

## 5.3 Frontend Architecture

### File Structure

```jsx
/public
  /css
    - styles.css
    - dashboard.css
    - login.css
  /js
    - app.js (main application logic)
    - auth.js (authentication handling, token management)
    - upload.js (file upload handling)
    - search.js (driver search & lookup)
    - users.js (user management - admin only)
    - api.js (API communication layer with auth headers)
  /pages
    - login.html (login page - public)
    - index.html (dashboard - requires auth)
    - upload.html (import page - requires auth)
    - driver-detail.html (driver view - requires auth)
    - payments.html (payment history - requires auth)
    - users.html (user management - admin only)
    - profile.html (user profile - requires auth)
```

### Key Components

- **Login Page:** User authentication with email and password
- **Dashboard:** Overview of pending drivers, weekly statistics (role-based access)
- **Upload Module:** Excel file upload with validation and preview
- **Search Module:** Real-time driver search with autocomplete
- **Driver Detail View:** Complete bonus history with cumulative total
- **Payment Module:** Mark as paid and record payment details (admin only)
- **User Management:** Create, edit, and manage users (admin only)
- **User Profile:** View and edit own profile, change password
- **Navigation:** Role-based menu (different options for admin vs staff)

## 5.4 Performance & Scalability Analysis

<aside>
⚡

**Real-World Scenario:** Weekly Excel files with 3,000-5,000 driver records

</aside>

### Processing Time Estimates

**For a file with 5,000 driver records:**

**Breakdown by Operation:**

1. **File Upload & Reading (1-3 seconds)**
    - Upload 5,000 rows Excel file (~500KB - 2MB): 0.5-1s
    - Parse Excel with `exceljs` library: 0.5-2s
    - **Total: 1-3 seconds**
2. **Data Validation (2-5 seconds)**
    - Validate 5,000 rows (check columns, data types): 1-2s
    - Check for verified drivers (5,000 DB queries with proper indexing): 1-3s
    - **Total: 2-5 seconds**
3. **Database Operations (5-15 seconds)**
    - Check existing drivers (batch query with IN clause): 0.5-1s
    - Insert new drivers (assume 100-500 new drivers): 1-3s
    - Insert bonuses (5,000 insert operations, using batch insert): 3-10s
    - Create import log: 0.1s
    - **Total: 5-15 seconds**

**Estimated Total Processing Time: 8-23 seconds**

**Realistic Target: 10-15 seconds for 5,000 records**

### Resource Requirements

**Minimum Requirements:**

- **RAM:** 1GB (system) + 1GB (database) = **2GB total**
- **CPU:** 1 core @ 2.0 GHz
- **Storage:** 20GB (includes OS, app, database)
- **Processing:** Can handle 5,000 records in ~20-30 seconds

**Recommended Requirements (for smooth performance):**

- **RAM:** 2GB (system/app) + 2GB (database) + 1GB (buffer) = **4GB total**
- **CPU:** 2 cores @ 2.5 GHz or higher
- **Storage:** 50GB SSD (faster disk I/O)
- **Processing:** Can handle 5,000 records in ~10-15 seconds

**Optimal Requirements (for best performance):**

- **RAM:** 4GB (system/app) + 4GB (database) = **8GB total**
- **CPU:** 4 cores @ 3.0 GHz
- **Storage:** 100GB SSD
- **Processing:** Can handle 5,000 records in ~5-10 seconds

### Memory Usage Breakdown

**During Excel Import (5,000 records):**

```
Node.js Application:
- Base app memory: 50-80 MB
- Excel file in memory: 5-10 MB (5,000 rows)
- Parsed data structures: 20-30 MB
- Processing buffers: 10-20 MB
- Total Node.js: ~100-150 MB peak usage

MySQL Database:
- Buffer pool: 512 MB - 2 GB (configurable)
- Connection overhead: 10-20 MB per connection
- Query cache: 50-100 MB
- Temp tables for batch operations: 50-100 MB
- Total MySQL: ~700 MB - 2.5 GB

Total System RAM Usage: ~1 GB - 2.7 GB
```

### CPU Usage Patterns

**During Import Processing:**

1. **CPU Spike (File Upload & Parsing):** 40-60% CPU for 1-3 seconds
    - Excel parsing is CPU-intensive
    - Single-threaded operation
2. **Moderate CPU (Validation):** 20-40% CPU for 2-5 seconds
    - String comparisons, data type checks
    - Database lookups (mostly I/O-bound)
3. **Mixed CPU/I0 (Database Inserts):** 30-50% CPU for 5-15 seconds
    - Database write operations
    - Index updates
    - Transaction logging

**Average CPU Usage During Import: 30-50%**

**CPU Idle: 2-5% (when no imports running)**

### Bottleneck Analysis

<aside>
🔍

**Primary Bottlenecks:**

</aside>

**1. Database Write Operations (Biggest Bottleneck)**

- **Issue:** 5,000 individual INSERT operations are slow
- **Impact:** 70% of total processing time
- **Solution:** Use batch inserts

**Example - Slow Approach (Individual Inserts):**

```jsx
// BAD: One query per row (5,000 queries!)
for (let row of rows) {
  await db.query('INSERT INTO bonuses VALUES (?, ?, ?)', [[row.id](http://row.id), row.amount, [row.date](http://row.date)]);
}
// Time: 15-30 seconds for 5,000 rows
```

**Example - Fast Approach (Batch Insert):**

```jsx
// GOOD: One query for all rows (1 query!)
const values = [rows.map](http://rows.map)(r => [[r.id](http://r.id), r.amount, [r.date](http://r.date)]);
await db.query('INSERT INTO bonuses VALUES ?', [values]);
// Time: 3-5 seconds for 5,000 rows
// Speed improvement: 3-6x faster!
```

**2. Verified Driver Checking**

- **Issue:** Checking if 5,000 drivers are verified
- **Impact:** 20% of processing time
- **Solution:** Use batch SELECT with IN clause

**Example - Optimized Check:**

```jsx
// GOOD: One query for all drivers
const driverIds = [rows.map](http://rows.map)(r => r.driver_id);
const verified = await db.query(
  'SELECT driver_id FROM drivers WHERE driver_id IN (?) AND verified = true',
  [driverIds]
);
// Create a Set for O(1) lookup
const verifiedSet = new Set([verified.map](http://verified.map)(v => v.driver_id));

// Fast lookup for each row
for (let row of rows) {
  if (verifiedSet.has(row.driver_id)) {
    skip(row); // Driver is verified
  }
}
// Time: 1-3 seconds for 5,000 rows
```

**3. Excel Parsing**

- **Issue:** Large Excel files take time to parse
- **Impact:** 10% of processing time
- **Solution:** Use streaming parser for very large files (10,000+ rows)

### Optimization Strategies

<aside>
🚀

**Performance Optimizations (Must Implement)**

</aside>

**1. Batch Database Operations**

✅ **INSERT Operations:**

```jsx
// Insert up to 1,000 records per query
const BATCH_SIZE = 1000;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  await db.query('INSERT INTO bonuses VALUES ?', [batch]);
}
```

**Impact:** 5-10x faster inserts

✅ **SELECT Operations (Verified Check):**

```jsx
// Single query with IN clause
const verified = await db.query(
  'SELECT driver_id FROM drivers WHERE driver_id IN (?) AND verified = true',
  [allDriverIds]
);
```

**Impact:** 100x faster than individual queries

**2. Database Indexing**

✅ **Critical Indexes:**

```sql
-- MUST HAVE for performance
CREATE INDEX idx_driver_id ON drivers(driver_id);
CREATE INDEX idx_verified ON drivers(verified);
CREATE UNIQUE INDEX idx_driver_week ON bonuses(driver_id, week_date);
```

**Impact:** 10-50x faster lookups

**3. Database Connection Pooling**

✅ **Use Connection Pool:**

```jsx
const pool = mysql.createPool({
  host: '[localhost](http://localhost)',
  user: 'root',
  database: 'driver_bonuses',
  connectionLimit: 10, // Reuse connections
  queueLimit: 0
});
```

**Impact:** Eliminates connection overhead

**4. Transaction Batching**

✅ **Use Transactions:**

```jsx
const connection = await pool.getConnection();
await connection.beginTransaction();
try {
  // All inserts in one transaction
  await connection.query('INSERT INTO bonuses VALUES ?', [batch1]);
  await connection.query('INSERT INTO bonuses VALUES ?', [batch2]);
  await connection.commit();
} catch (err) {
  await connection.rollback();
  throw err;
}
```

**Impact:** 2-3x faster, ensures data consistency

**5. Memory Optimization**

✅ **Stream Processing (for 10,000+ rows):**

```jsx
// For very large files, use streaming
const workbook = new [ExcelJS.stream](http://ExcelJS.stream).xlsx.WorkbookReader(filePath);
for await (const worksheetReader of workbook) {
  for await (const row of worksheetReader) {
    // Process one row at a time (low memory)
    await processRow(row);
  }
}
```

**Impact:** Constant memory usage regardless of file size

### Performance Benchmarks

<aside>
📊

**Real-World Performance Metrics**

</aside>

| **File Size** | **Driver Count** | **Processing Time** | **RAM Usage** | **CPU Peak** |
| --- | --- | --- | --- | --- |
| 500 KB | 1,000 drivers | 2-4 seconds | ~500 MB | 40% |
| 1 MB | 3,000 drivers | 6-10 seconds | ~800 MB | 50% |
| 2 MB | 5,000 drivers | 10-15 seconds | ~1.2 GB | 60% |
| 5 MB | 10,000 drivers | 20-30 seconds | ~2 GB | 70% |

**Assumptions:**

- Modern server (2 CPU cores @ 2.5 GHz, 4GB RAM)
- SSD storage
- All optimizations implemented (batch inserts, indexes, connection pooling)
- 50% of drivers are new (need to create driver records)
- 10% of drivers are verified (will be skipped)

### Scalability Limits

**Current Architecture Can Handle:**

✅ **Up to 10,000 drivers per import** (20-30 seconds)

✅ **Up to 100,000 total drivers in database** (search remains fast with indexes)

✅ **Weekly imports indefinitely** (database size grows slowly: ~10 MB/week)

✅ **5-10 concurrent users** without performance issues

**When You'll Need to Upgrade:**

⚠️ **15,000+ drivers per import** → Consider streaming processing

⚠️ **500,000+ total drivers** → Consider database partitioning

⚠️ **20+ concurrent users** → Consider load balancing

⚠️ **Multiple imports per day** → Consider background job queue

### Monitoring & Alerts

<aside>
🔔

**What to Monitor in Production**

</aside>

**Key Metrics:**

1. **Import Processing Time**
    - Alert if > 30 seconds for 5,000 records
    - Indicates: Database slowdown or optimization failure
2. **Memory Usage**
    - Alert if Node.js process > 500 MB
    - Alert if MySQL > 80% of allocated RAM
    - Indicates: Memory leak or need for upgrade
3. **CPU Usage**
    - Alert if sustained > 80% for > 60 seconds
    - Indicates: Need for more CPU cores or optimization
4. **Database Connection Pool**
    - Alert if queue length > 10
    - Indicates: Too many concurrent requests
5. **Error Rate**
    - Alert if import failure rate > 5%
    - Indicates: Data quality issues or bugs

### Recommended Server Specifications

<aside>
💻

**Recommended Production Server Setup**

</aside>

**For 3,000-5,000 drivers per week:**

**Option 1: Single Server (Small Operation)**

- **Provider:** DigitalOcean Droplet, AWS EC2 t3.medium, Linode
- **Specs:** 2 vCPU, 4GB RAM, 80GB SSD
- **Cost:** ~$20-40/month
- **Performance:** 10-15 seconds per import

**Option 2: Separate Database (Medium Operation)**

- **App Server:** 1 vCPU, 2GB RAM
- **DB Server:** 2 vCPU, 4GB RAM, 100GB SSD
- **Cost:** ~$40-60/month
- **Performance:** 8-12 seconds per import
- **Benefit:** Better reliability and scalability

**Option 3: Managed Services (Easiest)**

- **App:** Heroku, Railway, or AWS Elastic Beanstalk
- **Database:** AWS RDS, DigitalOcean Managed MySQL
- **Cost:** ~$50-100/month
- **Performance:** 8-12 seconds per import
- **Benefit:** Automatic backups, scaling, monitoring

### Database Growth Estimation

**Storage Requirements Over Time:**

```
Weekly Data:
- 5,000 bonus records × 100 bytes/record = 500 KB/week
- 500 new drivers × 200 bytes/driver = 100 KB/week
- Total: ~600 KB/week

Yearly Data:
- 52 weeks × 600 KB = ~31 MB/year

5-Year Projection:
- 5 years × 31 MB = ~155 MB
- Plus indexes and overhead: ~500 MB total

Conclusion: Storage is NOT a bottleneck
```

**Database Size After 1 Year:**

- Drivers table: ~5 MB (10,000 drivers)
- Bonuses table: ~25 MB (260,000 records)
- Import logs: ~2 MB (52 imports)
- Payments table: ~1 MB (2,000 payments)
- Indexes: ~10 MB
- **Total: ~50 MB**

**Even after 5 years: < 500 MB database size**

### Performance Testing Checklist

**Before Production Launch:**

- [ ]  Test import with 1,000 driver file (should take < 5 seconds)
- [ ]  Test import with 5,000 driver file (should take < 15 seconds)
- [ ]  Test import with 10,000 driver file (should take < 30 seconds)
- [ ]  Monitor memory usage during import (should stay < 2 GB)
- [ ]  Test concurrent imports (2 users uploading at same time)
- [ ]  Test search performance with 50,000+ drivers in database
- [ ]  Test database backup and restore procedures
- [ ]  Verify all database indexes are created
- [ ]  Load test with 10 concurrent users
- [ ]  Test server behavior under high CPU load (80%+)

### Quick Reference: Performance Targets

<aside>
🎯

**Performance Goals to Meet**

</aside>

✅ **Excel Upload (5,000 records): < 15 seconds**

✅ **Driver Search: < 1 second**

✅ **Driver Detail View: < 2 seconds**

✅ **Dashboard Load: < 3 seconds**

✅ **Payment Recording: < 1 second**

✅ **Concurrent Users: 5-10 without slowdown**

✅ **RAM Usage: < 2 GB total**

✅ **CPU Usage: < 60% average during imports**

✅ **Uptime: 99.5%+ (< 4 hours downtime/month)**

## 5.5 Backend Architecture

### Project Structure

```jsx
/src
  /routes
    - auth.js (login, logout, profile)
    - users.js (user management - admin only)
    - drivers.js
    - bonuses.js
    - uploads.js
    - payments.js
  /controllers
    - authController.js
    - userController.js
    - driverController.js
    - bonusController.js
    - uploadController.js
    - paymentController.js
  /services
    - authService.js (password hashing, JWT generation)
    - excelParser.js
    - bonusCalculator.js
    - validationService.js
  /models
    - User.js
    - Driver.js
    - Bonus.js
    - Payment.js
  /config
    - database.js
    - auth.js (JWT secret, session config)
  /middleware
    - authenticate.js (verify JWT/session)
    - authorize.js (check user roles)
    - errorHandler.js
    - validator.js
  - server.js (entry point)
```

---

# 6. Development Guide

## 6.1 Environment Setup

### Prerequisites

**Development Environment:**

- Node.js v18+ LTS
- MySQL 8.0+
- Modern web browser (Chrome, Firefox, Safari)
- Code editor (VS Code recommended)
- Git for version control

### Installation Steps

1. **Clone the repository**
2. **Install dependencies:**

```json
{
  "express": "^4.18.0",
  "mysql2": "^3.6.0",
  "exceljs": "^4.3.0",
  "multer": "^1.4.5",
  "dotenv": "^16.3.0",
  "cors": "^2.8.5",
  "bcrypt": "^5.1.0",
  "jsonwebtoken": "^9.0.0",
  "express-session": "^1.17.0",
  "express-validator": "^7.0.0"
}
```

1. **Configure environment variables (.env file):**
    - Database credentials
    - JWT secret key
    - Session secret
    - Port configuration
2. **Initialize database:**
    - Create database
    - Run schema migration scripts
    - Create initial admin user
3. **Start development server**

## 6.2 Development Roadmap

### Phase 0: Authentication & User Management (Week 1)

<aside>
🔐

**Goal:** Build authentication system and user management (foundation for all other features)

</aside>

**Backend Tasks:**

- [ ]  Create `users` table in database
- [ ]  Install authentication dependencies:
    - `bcrypt` - Password hashing
    - `jsonwebtoken` - JWT tokens
    - `express-session` - Session management
    - `express-validator` - Input validation
- [ ]  Create authentication middleware:
    - `authenticate.js` - Verify JWT/session
    - `authorize.js` - Check user roles (admin/staff)
- [ ]  Implement authentication endpoints:
    - `POST /api/auth/login` - Login with email/password
    - `POST /api/auth/logout` - Logout and clear session
    - `GET /api/auth/me` - Get current user profile
    - `POST /api/auth/change-password` - Change password
- [ ]  Implement user management endpoints (admin only):
    - `POST /api/users` - Create new user
    - `GET /api/users` - List all users
    - `PUT /api/users/:id` - Update user
    - `DELETE /api/users/:id` - Deactivate user
- [ ]  **Create initial admin user** (via SQL or seed script)

**Frontend Tasks:**

- [ ]  Create login page (login.html)
- [ ]  Build login form with email and password
- [ ]  Implement authentication logic (auth.js):
    - Store JWT token in localStorage or sessionStorage
    - Add Authorization header to all API requests
    - Handle token expiration and refresh
    - Redirect to login if unauthorized
- [ ]  Create user management page (admin only)
- [ ]  Add role-based UI elements:
    - Show/hide features based on user role
    - Display current user name in header
    - Add logout button

**Testing:**

- [ ]  Test user login and logout
- [ ]  Test role-based access control:
    - Staff cannot access admin-only features
    - Admin can access all features
- [ ]  Test password hashing (never stored in plain text)
- [ ]  Test token expiration and renewal
- [ ]  Test creating initial admin account

**Deliverables:**

✅ Working authentication system

✅ User management for admins

✅ Role-based access control

✅ Initial admin account created

### Phase 1: Foundation Setup (Week 1)

<aside>
🔧

**Goal:** Set up development environment and core infrastructure

</aside>

**Tasks:**

- [ ]  Set up Node.js project with Express.js
- [ ]  Initialize MySQL database and create all tables (drivers, bonuses, payments, import_logs, users)
- [ ]  Set up project structure (folders, files)
- [ ]  Configure environment variables (.env file):
    - Database credentials
    - JWT secret key
    - Session secret
    - Port configuration
- [ ]  Install dependencies:
    - `express` - Web framework
    - `mysql2` - MySQL client
    - `exceljs` - Excel parsing
    - `multer` - File upload handling
    - `dotenv` - Environment configuration
    - `cors` - CORS handling
    - `bcrypt` - Password hashing
    - `jsonwebtoken` - JWT tokens
    - `express-session` - Session management
    - `express-validator` - Input validation
- [ ]  Create basic server with health check endpoint
- [ ]  Test database connection

**Deliverables:**

✅ Working Node.js server

✅ MySQL database with complete schema

✅ Project structure ready for development

### Phase 2: Excel Import System (Week 1-2)

<aside>
📊

**Goal:** Build the core Excel upload and parsing functionality

</aside>

**Backend Tasks:**

- [ ]  **Protect route with authentication middleware** (requires login)
- [ ]  Create pre-upload validation endpoint (`POST /api/uploads/validate`)
    - Validate file is readable
    - Check single sheet only
    - Verify required columns present
    - Check column names are correct
    - Validate net payout values are numeric
    - Return checklist with pass/fail status for each check
- [ ]  Create file upload endpoint (`POST /api/uploads/excel`)
- [ ]  Implement Excel parser service:
    - **Validate file has exactly one sheet** (reject if multiple sheets detected)
    - Parse Excel file and extract columns: **ID**, **Full name**, **Phone number**, **Date**, **Net payout**
    - Map Excel columns to database fields:
        - `ID` → `driver_id`
        - `Full name` → `full_name`
        - `Phone number` → `phone_number`
        - `Date` → `week_date`
        - `Net payout` → `net_payout` (this is the bonus amount)
    - Validate data format and required fields (ID, Full name, Date, Net payout are required)
    - Handle errors gracefully
- [ ]  **Implement verified driver blocking logic:**
    - For each row, check if driver_id exists and is verified
    - **IF verified = true:** Skip row, add to "skipped_records" array with reason
    - **IF verified = false OR new driver:** Proceed with import
    - Track skipped count separately from success count
- [ ]  Insert parsed data into database:
    - **New driver:** Create driver record (verified=false) + insert bonus
    - **Existing unverified driver:** Insert bonus only (accumulation)
    - **Verified driver:** Do NOT insert, log as skipped
    - Log import in `import_logs` table with detailed counts:
        - success_count: Successfully imported bonuses
        - skipped_count: Verified drivers skipped
        - error_count: Rows with errors
        - new_drivers_count: New drivers created
        - existing_drivers_count: Existing drivers updated
        - rejected_verified_count: Verified drivers rejected
- [ ]  **Implement duplicate detection (same driver + same week)**
- [ ]  Create import history endpoint with enhanced statistics
    - Return detailed breakdown of each import
    - Include summary_text for easy display
    - Show visual statistics (inserted, rejected, new, errors)

**Frontend Tasks:**

- [ ]  Create upload page (upload.html)
- [ ]  Build file input with drag-and-drop
- [ ]  **Implement pre-upload validation:**
    - Call validation endpoint when file is selected
    - Display validation checklist with icons:
        - ✅ File is readable
        - ✅ Single sheet only
        - ✅ All required columns present
        - ✅ Column names are correct
        - ✅ File contains data
        - ✅ Net payout values are numeric
    - Only enable "Upload" button if validation passes
    - Show clear error messages if validation fails
- [ ]  Show upload progress indicator
- [ ]  Display enhanced import summary after upload:
    - ✅ Successfully imported: X records
    - ⏭️ Skipped (verified drivers): Y records
        - **Show detailed list:** driver_id, name, reason ("Driver is verified")
    - 🆕 New drivers created: Z records
    - 📝 Existing drivers updated: W records
    - ❌ Errors: E records (format issues, missing data)
    - Visual distinction with icons and colors
- [ ]  **Create import history list view:**
    - Display all imports with statistics
    - Show: date, filename, counts (inserted, rejected, new, errors)
    - Format: "45 inserted, 5 rejected (verified), 3 new drivers, 2 errors"
    - Include imported by user name
- [ ]  Style with clean, professional CSS

**Testing:**

- [ ]  Test with sample Excel files (mix of new, unverified, and verified drivers)
- [ ]  **Test multi-sheet validation:**
    - Upload Excel file with 2+ sheets
    - Verify import is rejected with error message: "Excel file contains multiple sheets. Please upload a file with only one sheet."
    - Confirm no data is imported from multi-sheet files
- [ ]  **Test verified driver blocking:**
    - Create a verified driver in database
    - Upload Excel with that driver_id
    - Verify row is skipped with proper notification
    - Confirm no bonus is added to database
- [ ]  Test new driver creation (driver not in database)
- [ ]  Test unverified driver bonus accumulation
- [ ]  Test duplicate upload prevention (same driver + same week)
- [ ]  Test error handling (corrupt files, wrong format)

**Deliverables:**

✅ Working Excel import system

✅ Data stored correctly in database

✅ User-friendly upload interface

### Phase 3: Driver Search & Lookup (Week 2)

<aside>
🔍

**Goal:** Build driver search and bonus accumulation view

</aside>

**Backend Tasks:**

- [ ]  Create driver search endpoint (`GET /api/drivers/search?q=name`)
- [ ]  Create driver details endpoint (`GET /api/drivers/:id`)
- [ ]  Create accumulated bonus endpoint (`GET /api/bonuses/driver/:driverId/total`)
- [ ]  Create bonus breakdown endpoint (list all weeks)
- [ ]  Optimize queries with indexes

**Frontend Tasks:**

- [ ]  Create search interface with input field
- [ ]  Implement real-time search (debounced API calls)
- [ ]  Display search results (driver list)
- [ ]  Create driver detail view:
    - Driver info (name, ID, verification status)
    - **Total accumulated bonus (prominent display)**
    - **Bonus breakdown table with sorting controls:**
        - Table columns: Week Date | Bonus Amount
        - Dropdown to sort by: Date (default) or Week
        - Toggle button for sort order: Descending (newest first) or Ascending (oldest first)
        - Clean, intuitive controls above the table
    - **Import history section:**
        - Tab or collapsible section for "Import History"
        - Shows: Import date, count of bonuses imported, which weeks were included
        - Helps answer: "When did we add bonuses for this driver?"
    - Total weeks pending
- [ ]  **Add "Mark as Verified" button (Staff + Admin):**
    - Show confirmation dialog
    - **Require password entry to confirm action**
    - Display password input field in confirmation dialog
    - Validate password on backend before verification
    - Show error if password is incorrect
    - Display who verified the driver after successful verification
- [ ]  Responsive design for mobile access

**Testing:**

- [ ]  Test search with various queries
- [ ]  Verify bonus calculations are correct
- [ ]  Test with drivers having 0, 1, and multiple bonuses

**Deliverables:**

✅ Fast driver search

✅ Accurate bonus accumulation display

✅ Clean, intuitive UI

### Phase 4: Dashboard & Analytics (Week 3)

<aside>
📈

**Goal:** Build overview dashboard with key metrics

</aside>

**Backend Tasks:**

- [ ]  Create dashboard statistics endpoint:
    - Total unverified drivers
    - Total pending bonus amount
    - This week's imported records
    - Recent imports
- [ ]  Create pending drivers list endpoint
- [ ]  Add pagination support for large lists

**Frontend Tasks:**

- [ ]  Create dashboard page (index.html)
- [ ]  Display key metrics in cards:
    - 💰 Total Pending Bonuses
    - 👥 Unverified Drivers
    - 📊 This Week's Records
- [ ]  Show list of unverified drivers with pending amounts
- [ ]  Add quick actions:
    - View driver details
    - Upload new Excel file
- [ ]  Create navigation menu

**Testing:**

- [ ]  Verify statistics calculations
- [ ]  Test with various data volumes
- [ ]  Check mobile responsiveness

**Deliverables:**

✅ Informative dashboard

✅ At-a-glance system status

✅ Easy navigation

### Phase 5: Verification & Payment Tracking (Week 3-4)

<aside>
✅

**Goal:** Complete the workflow with verification and payment recording

</aside>

**Backend Tasks:**

- [ ]  Create verification endpoint (`PUT /api/drivers/:id/verify`) - Staff + Admin
    - **Require password confirmation in request**
    - Validate user's password before verification
    - Return error if password is incorrect
    - Store `verified_by` user ID in drivers table
    - Return verification details including who verified
- [ ]  Create payment recording endpoint (`POST /api/payments`) - Staff + Admin
- [ ]  Create payment history endpoint (Staff + Admin)
- [ ]  Implement payment transaction logic:
    - Record payment details
    - Link to bonus records
    - Store which user processed the payment (from authenticated user)
    - Update driver status if needed

**Frontend Tasks:**

- [ ]  Add verification workflow (Staff + Admin):
    - Confirmation dialog before marking verified
    - Option to add verification date
- [ ]  Create payment form (Staff + Admin):
    - Pre-filled total bonus amount
    - Payment method dropdown
    - Date picker
    - Notes field
    - "Mark as Paid" button
- [ ]  Create payment history page (Staff + Admin):
    - List all payments with username who processed
    - Filter by date range, driver
    - Export capability
- [ ]  Add success/error notifications
- [ ]  Implement role-based UI:
    - Admin-only: User management, view all audit logs
    - Staff + Admin: Verification, payments, imports, search

**Testing:**

- [ ]  Test verification workflow
- [ ]  Test payment recording
- [ ]  Verify audit trail is complete

**Deliverables:**

✅ Complete verification system

✅ Payment tracking with history

✅ Full audit trail

### Phase 6: Testing, Polish & Deployment (Week 4)

<aside>
🚀

**Goal:** Finalize, test thoroughly, and deploy to production

</aside>

**Testing Tasks:**

- [ ]  End-to-end testing with real data
- [ ]  Cross-browser testing (Chrome, Firefox, Safari)
- [ ]  Mobile responsiveness testing
- [ ]  Load testing with large Excel files
- [ ]  Security testing:
    - SQL injection prevention
    - File upload validation
    - Input sanitization
- [ ]  User acceptance testing with staff

**Polish Tasks:**

- [ ]  Improve error messages and user feedback
- [ ]  Add loading states for all async operations
- [ ]  Optimize database queries
- [ ]  Add data validation on frontend and backend
- [ ]  Create user documentation/guide
- [ ]  Add tooltips and help text where needed

**Deployment Tasks:**

- [ ]  Choose hosting provider (VPS, cloud, etc.)
- [ ]  Set up production MySQL database
- [ ]  Configure production environment variables
- [ ]  Deploy Node.js application
- [ ]  Set up SSL certificate (HTTPS)
- [ ]  Configure domain name
- [ ]  Set up automated backups for database
- [ ]  Monitor application logs

**Deliverables:**

✅ Fully tested application

✅ Deployed to production

✅ Staff trained on usage

✅ Documentation complete

### Timeline Summary

<aside>
⏱️

**Total Development Time: 4 weeks**

• **Week 1:** Foundation + Excel Import (50% complete)
• **Week 2:** Search/Lookup + Dashboard (75% complete)
• **Week 3:** Analytics + Payment System (90% complete)
• **Week 4:** Testing + Deployment (100% complete)

</aside>

---

# 7. Deployment Guide

## 7.1 Production Requirements

**Infrastructure:**

- Linux server (Ubuntu 22.04 recommended) or cloud hosting
- 2GB+ RAM
- 20GB+ storage
- SSL certificate
- Domain name
- Regular automated backups

**Security:**

- HTTPS/SSL encryption
- Environment variable protection
- Database access controls
- Regular security updates
- Backup and disaster recovery plan

## 7.2 Deployment Checklist

- [ ]  Choose hosting provider (VPS, cloud, etc.)
- [ ]  Set up production MySQL database
- [ ]  Configure production environment variables
- [ ]  Deploy Node.js application
- [ ]  Set up SSL certificate (HTTPS)
- [ ]  Configure domain name
- [ ]  Set up automated backups for database
- [ ]  Monitor application logs
- [ ]  Configure firewall rules
- [ ]  Set up monitoring and alerting

---

# 8. Help & User Guide

## 8.1 Quick Start Guide

<aside>
🚀

**New to the system?** Follow this step-by-step guide to get started!

</aside>

### For First-Time Users

**Step 1: Login**

1. Open the application in your web browser
2. Enter your email and password (provided by your administrator)
3. Click "Login"

**Step 2: Navigate the Dashboard**

- View total pending bonuses and unverified driver count
- See recent imports and system activity
- Use the navigation menu to access different features

**Step 3: Upload Your First Excel File**

1. Click "Upload" in the navigation menu
2. Click "Choose File" or drag and drop your Excel file
3. Wait for validation (checklist will appear)
4. If validation passes, enter the week date
5. Click "Upload" to import
6. Review the import summary

**Step 4: Search for a Driver**

1. Click "Search Drivers" in the navigation menu
2. Type driver name or ID in the search box
3. Click on a driver to view details
4. Review accumulated bonuses and weekly breakdown

**Step 5: Verify a Driver** (Staff + Admin)

1. Search and open driver details
2. Click "Mark as Verified"
3. **Enter your password** to confirm
4. Enter verification date
5. Click "Confirm"

## 8.2 Common Tasks

### How to Upload Weekly Bonus Files

<aside>
📤

**Task:** Import weekly bonus data from Excel

</aside>

**Prerequisites:**

- Excel file with columns: ID, Full name, Phone number, Date, Net payout
- File must have only one sheet
- You must be logged in

**Steps:**

1. **Prepare Your File:**
    - Make sure Excel has only one sheet
    - Verify column names match exactly: "ID", "Full name", "Phone number", "Date", "Net payout"
    - Check that "Net payout" column contains only numbers
2. **Upload the File:**
    - Go to Upload page
    - Select or drag-drop your Excel file
    - Wait for automatic validation
3. **Check Validation Results:**
    - ✅ File is readable
    - ✅ Single sheet only
    - ✅ All required columns present
    - ✅ Column names are correct
    - ✅ File contains data
    - ✅ Net payout values are numeric
4. **Complete Upload:**
    - Enter week date (e.g., 2025-12-01)
    - Click "Upload"
    - Review import summary

**Expected Results:**

- Successfully imported: XX records
- Skipped (verified drivers): YY records
- New drivers created: ZZ records
- Errors: EE records

### How to Find Driver Bonus Information

<aside>
🔍

**Task:** Look up a driver's accumulated bonuses

</aside>

**Steps:**

1. **Search for Driver:**
    - Go to "Search Drivers" page
    - Type driver name or ID
    - Results appear as you type
2. **View Driver Details:**
    - Click on driver from search results
    - See total accumulated bonus at top
    - Review weekly breakdown below
3. **Check Import History:**
    - Scroll to "Import History" section
    - See when bonuses were imported
    - View which files included this driver

**Information Available:**

- Total accumulated bonus amount
- Number of weeks pending
- Date range (first week to last week)
- Individual weekly bonuses
- Import dates and who imported

### How to Verify a Driver

<aside>
✅

**Task:** Mark a driver as verified after document approval

</aside>

**Important:** This action is permanent and cannot be undone!

**Steps:**

1. **Find the Driver:**
    - Search for driver by name or ID
    - Open driver details page
2. **Review Bonus Information:**
    - Check total accumulated bonus
    - Note the amount for payment processing
3. **Mark as Verified:**
    - Click "Mark as Verified" button
    - **Confirmation dialog appears**
4. **Confirm with Password:**
    - Enter verification date
    - **Type your password** (security requirement)
    - Click "Confirm"
5. **Verification Complete:**
    - Driver status changes to "Verified"
    - Future imports will skip this driver
    - System shows who verified (your name)

**What Happens After:**

- Driver stops accumulating bonuses in system
- Future Excel imports will reject rows for this driver
- Driver receives weekly payments directly (outside system)

### How to Record a Payment

<aside>
💳

**Task:** Record payment of accumulated bonuses

</aside>

**Prerequisites:**

- Driver must be verified
- You know the total bonus amount to pay

**Steps:**

1. **Open Driver Details:**
    - Search for driver
    - View accumulated bonus total
2. **Click "Process Payment":**
    - Payment form opens
    - Total amount is pre-filled
3. **Enter Payment Details:**
    - Payment date (usually today)
    - Payment method (Bank Transfer, Cash, etc.)
    - Bonus period start date
    - Bonus period end date
    - Optional notes
4. **Submit Payment:**
    - Review all information
    - Click "Record Payment"
    - Confirmation message appears
5. **Verify Payment Recorded:**
    - Go to "Payment History" page
    - Find the payment you just recorded
    - Check details are correct

### How to View Import History

<aside>
📋

**Task:** Review past Excel file imports

</aside>

**Steps:**

1. **Go to Import History:**
    - Click "Import History" in navigation
    - List of all imports appears
2. **Review Import Details:**
    - Date and time of import
    - Filename
    - Statistics: inserted, rejected, new drivers, errors
    - Who imported the file
3. **Filter or Search:**
    - Use date range filters
    - Search by filename
    - Sort by date or status

**Information Shown:**

- ✅ XX inserted
- ❌ YY rejected (verified drivers)
- 🆕 ZZ new drivers
- ⚠️ EE errors

## 8.3 Frequently Asked Questions (FAQ)

### General Questions

**Q: Who can use this system?**

A: Two types of users:

- **Staff:** Can upload files, search drivers, verify drivers, and process payments
- **Admin:** Can do everything staff can do, plus manage user accounts

**Q: How do I get login credentials?**

A: Contact your system administrator. Only admins can create new user accounts.

**Q: Can I change my password?**

A: Yes! Go to your profile page and click "Change Password". You'll need to enter your current password.

**Q: What browsers are supported?**

A: Chrome, Firefox, Safari, and Edge (latest versions recommended).

**Q: Can I use this on mobile?**

A: Yes, the interface is responsive and works on tablets and phones, though desktop is recommended for best experience.

### Excel Upload Questions

**Q: What format should my Excel file be in?**

A: Your Excel file must:

- Have exactly one sheet
- Contain these columns: ID, Full name, Phone number, Date, Net payout
- Column names must match exactly (case-insensitive)
- Net payout values must be numbers

**Q: Why does my file upload fail with "multiple sheets" error?**

A: The system only accepts Excel files with one sheet. Delete extra sheets or save only the data sheet you need.

**Q: What if column names are spelled differently?**

A: Column names must match exactly. "Phone" is not the same as "Phone number". Check the spelling carefully.

**Q: Can I upload the same file twice?**

A: The system prevents duplicate bonuses for the same driver in the same week. You'll get an error if you try.

**Q: What happens to verified drivers in my Excel file?**

A: Their rows are automatically skipped and appear in the "rejected" count. This prevents double-payment.

**Q: How do I know if the upload was successful?**

A: You'll see a summary showing:

- How many records were imported
- How many were skipped (verified drivers)
- How many new drivers were created
- Any errors that occurred

### Driver Verification Questions

**Q: Why do I need to enter my password to verify a driver?**

A: This is a security measure. Verification is permanent and affects payments, so we require password confirmation.

**Q: Can I un-verify a driver?**

A: No, verification is a one-way action and cannot be undone. Make sure you're verifying the correct driver.

**Q: What happens after I verify a driver?**

A:

- The driver stops accumulating bonuses in the system
- Future Excel imports will skip this driver
- The driver receives weekly payments directly (outside this system)

**Q: Can I see who verified a driver?**

A: Yes, the driver details page shows who verified the driver and when.

### Payment Questions

**Q: When should I record a payment?**

A: After you've verified a driver and processed their accumulated bonus payment through your payment system.

**Q: Does recording a payment actually transfer money?**

A: No, this system only tracks payment records. You must transfer money separately through your bank or payment system.

**Q: Can I edit a payment record after submitting?**

A: Only admins can modify payment records. Contact your administrator if you need to make changes.

**Q: Where can I see all payment history?**

A: Go to "Payment History" page. You can filter by driver, date range, or payment method.

### Troubleshooting Questions

**Q: I'm logged out frequently. Why?**

A: Your session token expires after 24 hours of inactivity. You'll need to log in again.

**Q: I see "Unauthorized" error. What does this mean?**

A: Your session has expired or you don't have permission. Try logging in again.

**Q: The search isn't finding a driver I know exists. Why?**

A:

- Check spelling of driver name
- Try searching by driver ID instead
- Driver might not be imported yet

**Q: I get "Invalid password" when verifying a driver. Help!**

A: You must enter YOUR login password, not the driver's information. This confirms your identity.

## 8.4 Troubleshooting Guide

### Upload Issues

<aside>
⚠️

**Problem:** File validation fails

</aside>

**Symptom:** Red X marks appear on validation checklist

**Solutions:**

| Error Message | Cause | Solution |
| --- | --- | --- |
| "Multiple sheets detected" | Excel file has 2+ sheets | Delete extra sheets, keep only data sheet |
| "Required column missing" | Column name misspelled or missing | Check spelling: "ID", "Full name", "Net payout", "Date" |
| "Invalid numeric value" | Non-number in Net payout column | Replace text values (like "TBD") with actual numbers |
| "File is not readable" | Corrupted or wrong format | Re-save file as .xlsx format |
| "File is empty" | No data rows | Add data rows below header row |

<aside>
⚠️

**Problem:** Upload succeeds but shows many "rejected" records

</aside>

**Symptom:** High number of skipped/rejected drivers in import summary

**Possible Causes:**

1. **Verified Drivers:** These drivers were already verified, so system skips them (this is normal)
2. **Check rejected details:** Review the list of skipped drivers to confirm they're all verified

**Solution:**

- If rejected drivers should be verified: No action needed (working as designed)
- If rejected drivers should NOT be verified: Contact admin to check driver verification status

<aside>
⚠️

**Problem:** "Duplicate entry" error

</aside>

**Symptom:** Error message about duplicate driver + week combination

**Cause:** You're trying to import bonuses for a driver + week that already exists in database

**Solution:**

- Check import history to see if this file was already uploaded
- If this is a correction, admin must delete the old entry first
- Make sure you're uploading the correct week's file

### Search & Display Issues

<aside>
⚠️

**Problem:** Can't find a driver in search

</aside>

**Symptom:** Search returns no results for a driver you know exists

**Solutions:**

1. **Check spelling:** Make sure name is spelled correctly
2. **Try driver ID:** Search by the long hash ID instead
3. **Check if imported:** Go to Import History to verify driver was in uploaded files
4. **Try partial name:** Search for just first name or last name
5. **Clear search and try again:** Sometimes helps refresh results

<aside>
⚠️

**Problem:** Bonus total doesn't match expectations

</aside>

**Symptom:** Total accumulated bonus seems wrong

**Solutions:**

1. **Review weekly breakdown:** Check each week's bonus amount
2. **Check import history:** Verify all expected weeks were imported
3. **Look for duplicates:** Make sure no week appears twice
4. **Verify calculation:** Manually add up weekly amounts to confirm

### Login & Access Issues

<aside>
⚠️

**Problem:** "Invalid email or password" error

</aside>

**Symptom:** Cannot log in even with correct credentials

**Solutions:**

1. **Check email:** Make sure email is spelled correctly
2. **Check password:** Passwords are case-sensitive
3. **Check caps lock:** Make sure Caps Lock is off
4. **Reset password:** Contact admin to reset your password
5. **Account status:** Confirm your account is active (ask admin)

<aside>
⚠️

**Problem:** "Forbidden" or "Unauthorized" errors

</aside>

**Symptom:** Can't access certain features or pages

**Solutions:**

1. **Session expired:** Log out and log in again
2. **Permission issue:** You might need admin privileges for that feature
3. **Check role:** Confirm your user role (staff vs admin) with administrator

### Verification Issues

<aside>
⚠️

**Problem:** "Invalid password" when verifying driver

</aside>

**Symptom:** Error message when trying to mark driver as verified

**Cause:** The password you entered doesn't match your login password

**Solution:**

1. **Enter YOUR password:** Use the same password you use to log in
2. **Check caps lock:** Passwords are case-sensitive
3. **Recent password change:** If you recently changed password, use the new one
4. **Reset if forgotten:** Contact admin to reset your password

<aside>
⚠️

**Problem:** Accidentally verified wrong driver

</aside>

**Symptom:** Verified the wrong driver by mistake

**Solution:**

- **Contact admin immediately:** Only admins can fix this
- **Verification cannot be undone:** Admin must manually update database
- **Double-check before confirming:** Always verify driver details before confirmation

## 8.5 Best Practices

### For Weekly Imports

✅ **DO:**

- Upload files every Monday consistently
- Check validation results before uploading
- Review import summary after each upload
- Keep Excel files organized by week/date
- Verify column names match exactly
- Keep only one sheet in Excel file

❌ **DON'T:**

- Upload the same file twice
- Edit Excel file while uploading
- Skip validation step
- Upload files with multiple sheets
- Modify column names
- Include non-numeric values in Net payout column

### For Driver Verification

✅ **DO:**

- Double-check driver identity before verifying
- Note the total bonus amount before verification
- Have your password ready
- Record verification date accurately
- Process payment shortly after verification

❌ **DON'T:**

- Verify before confirming driver documents are approved
- Rush through verification without checking details
- Verify multiple drivers at once (check each one carefully)
- Forget to record payment after verification

### For Data Accuracy

✅ **DO:**

- Review import summaries carefully
- Check for unexpected "rejected" counts
- Verify bonus calculations manually for important drivers
- Keep original Excel files as backup
- Report any discrepancies to admin immediately

❌ **DON'T:**

- Ignore error messages
- Assume everything is correct without checking
- Delete original Excel files after import
- Wait to report problems

## 8.6 Keyboard Shortcuts

<aside>
⌨️

**Speed up your workflow with these shortcuts!**

</aside>

| Action | Shortcut | Description |
| --- | --- | --- |
| Focus search | `Ctrl/Cmd + K` | Jump to search box |
| Navigate back | `Ctrl/Cmd + [` | Go to previous page |
| Navigate forward | `Ctrl/Cmd + ]` | Go to next page |
| Refresh | `F5` | Reload current page |
| Open upload | `Ctrl/Cmd + U` | Go to upload page |
| Logout | `Ctrl/Cmd + Shift + Q` | Log out quickly |

## 8.7 Glossary of Terms

**Accumulated Bonus:** The total amount of bonuses a driver has earned but not yet been paid.

**Bonus Period:** The date range of weeks included in a payment (e.g., Nov 1 - Nov 30).

**Driver ID:** Unique hash identifier from Yango system (e.g., `85fb80236ffa474db93fdccd0cdab66b`).

**Import Log:** A record of an Excel file upload, including statistics and results.

**Net Payout:** The bonus amount a driver earned for a specific week.

**Pending Bonus:** Bonuses that have been imported but not yet paid to driver.

**Rejected/Skipped:** Import rows that were not processed because driver is verified.

**Unverified Driver:** A driver who is still in the bonus accumulation phase.

**Verification:** The process of marking a driver as approved, stopping bonus accumulation.

**Verified Driver:** A driver who has been approved and receives direct weekly payments.

**Week Date:** The date representing a specific week's bonus period.

## 8.8 Video Tutorials

<aside>
🎥

**Coming Soon:** Video tutorials will be added here to help you learn the system visually.

</aside>

**Planned Tutorials:**

1. ▶️ Getting Started - First Login and Dashboard Overview (5 min)
2. ▶️ Uploading Your First Excel File (3 min)
3. ▶️ Searching for Drivers and Viewing Bonuses (4 min)
4. ▶️ Verifying a Driver - Step by Step (3 min)
5. ▶️ Recording Payments and Viewing History (5 min)
6. ▶️ Troubleshooting Common Issues (10 min)

## 8.9 Getting Help

<aside>
💬

**Need more help?** Here's how to get support:

</aside>

### Self-Help Resources

1. **Check this Help Guide:** Most questions are answered here
2. **Review FAQ Section:** Common questions and solutions
3. **Try Troubleshooting Guide:** Step-by-step problem solving

### Contact Support

**For Technical Issues:**

- Email: [support@yourcompany.com](mailto:support@yourcompany.com)
- Phone: +251-XXX-XXX-XXX
- Hours: Monday-Friday, 9AM-5PM

**For Admin Tasks:**

- Contact your system administrator
- They can help with:
    - Creating new user accounts
    - Resetting passwords
    - Fixing verification errors
    - Modifying payment records
    - Database corrections

**For Training:**

- Request a training session with your team lead
- Schedule a one-on-one walkthrough with admin
- Watch video tutorials (when available)

### Reporting Bugs or Issues

**When reporting a problem, include:**

1. What you were trying to do
2. What you expected to happen
3. What actually happened
4. Error message (if any)
5. Screenshot (if possible)
6. Date and time of issue
7. Your username (not password!)

**Example:**

```
I was trying to: Upload bonuses_week1_dec.xlsx
Expected: File would upload successfully
Actual: Got "Invalid column" error
Error message: "Required column 'ID' not found"
Screenshot: [attached]
Date/Time: Dec 23, 2025 at 2:30 PM
Username: [john.doe@company.com](mailto:john.doe@company.com)
```

---

# 9. Success Metrics

## 8.1 Performance Criteria

<aside>
🎯

**The platform will be considered successful when:**

✓ Excel files can be imported in under 30 seconds
✓ Driver bonus lookup takes less than 2 seconds
✓ Zero calculation errors in bonus accumulation
✓ Staff can process a driver payment in under 1 minute
✓ System handles 500+ drivers without performance issues
✓ 90% reduction in manual work time
✓ All staff members comfortable using the system

</aside>

## 8.2 Business Impact Goals

**Operational Efficiency:**

- Reduce administrative time from 3-8 hours/week to less than 30 minutes/week
- Eliminate calculation errors
- Process payments within 24 hours of verification

**Driver Satisfaction:**

- Reduce payment delays
- Provide transparency into bonus accumulation
- Improve driver retention rates

**Scalability:**

- Support 500+ drivers without performance degradation
- Enable growth without proportional increase in administrative overhead

---

# 10. Appendices

## 10.1 Future Enhancements

<aside>
💭

These features can be added after the MVP is complete and tested.

</aside>

**Priority 2 Features:**

- [ ]  **Email notifications** - Notify drivers when verified or paid
- [ ]  **Excel export** - Export payment reports
- [ ]  **Batch operations** - Verify/pay multiple drivers at once
- [ ]  **Driver portal** - Drivers can view their own bonus status
- [ ]  **Charts & graphs** - Visual analytics for bonus trends

**Priority 3 Features:**

- [ ]  **API documentation** - Swagger/OpenAPI docs
- [ ]  **Mobile app** - Native mobile application
- [ ]  **SMS notifications** - Text drivers about bonuses
- [ ]  **Advanced analytics** - Predictive analytics and reporting
- [ ]  **Integration APIs** - Connect with external payment systems

## 10.2 Contact Information

**System Administrator:**

- Name: [Your Admin Name]
- Email: [admin@yourcompany.com](mailto:admin@yourcompany.com)
- Phone: +251-XXX-XXX-XXX

**Technical Support:**

- Email: [support@yourcompany.com](mailto:support@yourcompany.com)
- Phone: +251-XXX-XXX-XXX
- Hours: Monday-Friday, 9AM-5PM EAT

**Emergency Contact:**

- After-hours support: +251-XXX-XXX-XXX
- Use only for critical system outages

---

<aside>
🎉

**Document Version:** 2.0
**Last Updated:** 2025-12-23
**Maintained By:** Development Team

</aside>

**Driver ID:** Unique hash identifier from Yango system (e.g., `85fb80236ffa474db93fdccd0cdab66b`)

**Net Payout:** The bonus amount earned by a driver for a specific week

**Verification:** The process of document submission and approval before a driver can receive payments

**Accumulation Mode:** State where an unverified driver's bonuses are collected but not yet paid

**Direct Payment Mode:** State where a verified driver receives weekly payments directly (outside this system)

**Import Log:** Audit record of an Excel file upload, including success/error counts

**Bonus Period:** Date range of bonuses included in a payment transaction

---

<aside>
🎉

**Document Version:** 1.0
**Last Updated:** 2025-12-19
**Maintained By:** Development Team

</aside>