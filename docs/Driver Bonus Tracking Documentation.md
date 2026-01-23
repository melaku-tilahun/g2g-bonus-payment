# Driver Bonus Tracking Platform (V4.0)

# 1. Overview

## 1.1 Executive Summary

The Driver Bonus Tracking Platform is a centralized web application designed to automate the accumulation, tracking, and payment processing of driver performance bonuses for Yango ride service providers. The system integrates **TIN Verification**, **Automated Telebirr Payout Reconciliation**, and **Audit Logging** to ensure 100% financial accuracy and regulatory compliance.

**Platform Type:** Web Application
**Target Users:** Administrative staff and managers
**Primary Goal:** Streamline bonus verification, calculation, and payout for newly verified drivers.

## 1.2 Problem Statement

<aside>
🎯 **Business Context**
We operate a driver bonus compensation system where drivers earn weekly performance-based bonuses. However, payment is contingent upon successful verification (documents + TIN check).
</aside>

### The Core Problem
Unverified drivers accumulate unpaid bonuses for 2-4 weeks. Once verified, staff previously had to manually search multiple Excel files, calculate sums, apply 3% withholding tax, and manually match Telebirr reports. This was slow and error-prone.

### Key Pain Points
- **Manual Search**: Tedious searching across multiple weekly Excel files.
- **TIN Fraud**: Risk of verifying drivers without valid tax credentials.
- **Tax Complexity**: Manual calculation of 3% withholding tax for payouts over 3,000 ETB.
- **Reconciliation Nightmare**: Manually matching bank/Telebirr success reports back to the database.

## 1.3 Solution Overview

<aside>
✨ **Vision:** A robust, audited system that handles the entire lifecycle: from Excel import to TIN verification, through to automated payout reconciliation.
</aside>

**Core Functionality:**
- **Automated Import**: Intelligent Excel parsing with column detection, phone format cleaning, and automatic debt deduction.
- **TIN Verification**: Real-time lookup of driver business details via external TIN services.
- **Smart Payouts**: Automatic calculation of Gross amounts, 3% Withholding Tax, and 30% additional tax for unverified drivers.
- **Debt Management**: Track driver debts (loans, insurance) with automatic deduction from bonuses.
- **Batch Reconciliation**: Export batches for Telebirr Bulk Pay, followed by automated "Paid" status updates via report import.
- **Analytics Dashboard**: Financial overview, revenue trends, tax analytics, and driver performance metrics.
- **Scheduled Reports**: Automated report generation (daily/weekly/monthly) with email delivery.
- **System Health Monitoring**: Real-time CPU, memory, storage, and database metrics.
- **Compliance Reporting**: Withholding tax reports, TIN verification logs, and driver statements.
- **Audit Logging**: Every action (verify, export, reconcile) is logged with user timestamp and IP address.

---

# 2. System Architecture

## 2.1 Architecture Diagram

```mermaid
graph TD
    A[Web Browser - Vanilla JS] <--> B[Node.js API - Express]
    B <--> C[MySQL Database]
    B --> D[TIN Verification Service]
    B --> E[Audit Logger]
    B --> F[public/Imports/driver_photos]
    B --> G[ExcelJS Parser]
```

## 2.2 System Components

### Presentation Layer (Frontend)
- Vanilla JavaScript SPA (Single Page Application) logic.
- Responsive CSS3 with custom data-grid components.
- Secure session handling via JWT.

### Application Layer (Backend)
- **Express.js API**: Handles routing and business logic.
- **TIN Service**: Connects to tax verification APIs.
- **Reconciliation Engine**: Matches Telebirr MSISDN reports to internal Payment IDs.
- **Storage**: Photos stored on disk (`/Imports/driver_photos`) for performance; metadata in MySQL.

### Data Layer (Database)
- **MySQL 8.0**: Relational storage with optimized indexing.
- **Audit Trail**: Dedicated `audit_logs` table for all financial transitions.

---

# 3. Functional Requirements

## 3.1 System Use Cases

### System Overview Diagram

```mermaid
graph TD
    User((Staff))
    Admin((Admin))
    Director((Director))
    Manager((Manager))
    Auditor((Auditor))

    subgraph "Driver Management"
        Verify[Verify Driver]
        TINLookup[TIN Lookup]
        Block[Block/Unblock Driver]
        ViewDetails[View Driver Details]
    end

    subgraph "Financial Operations"
        Import[Import Weekly Bonus]
        Export[Export Batch Payment]
        Reconcile[Reconcile Payment]
        PartialPay[Authorize 70% Payout]
        ManageDebt[Manage Debts]
    end

    subgraph "Reporting & Compliance"
        ViewRep[View Reports]
        SchedRep[Schedule Reports]
        AuditLog[View Audit Logs]
        AdvSearch[Advanced Search]
    end

    User --> Verify
    User --> TINLookup
    User --> Import
    User --> Export
    User --> ViewDetails

    Manager --> Block
    Manager --> PartialPay
    Manager --> AdvSearch
    Manager --> ViewRep

    Director --> AuditLog
    Director --> PartialPay
    Director --> Reconcile

    Auditor --> ViewRep
    Auditor --> AuditLog
    Auditor --> AdvSearch

    Admin --> ManageDebt
    Admin --> SchedRep
    Admin --> AuditLog
    Admin --> Block
```

## 3.2 User Roles and Permissions

The system implements Role-Based Access Control (RBAC) with five distinct user roles arranged in a hierarchy.

### Role Hierarchy
1. **Admin**: Superuser with full system access.
2. **Director**: High-level strategic access, financial controls, and audit visibility.
3. **Manager**: Operational oversight, driver management, and reporting.
4. **Auditor**: Compliance monitoring, reporting, and read-only access to specific records.
5. **Staff**: Basic operational access (driver verification input).

### Permissions Matrix

#### Driver Management
| Feature | Admin | Director | Manager | Auditor | Staff |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Driver List | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Driver Details | ✅ | ✅ | ✅ | ✅ | ✅ |
| Verify Driver (Standard) | ✅ | ✅ | ✅ | ❌ | ✅ |
| Admin Override (No TIN) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Block/Unblock Driver | ✅ | ✅ | ✅ | ❌ | ❌ |
| Generate Statements | ✅ | ✅ | ✅ | ✅ | ✅ |
| Add Debt | ✅ | ❌ | ❌ | ❌ | ❌ |

#### Financial & Payments
| Feature | Admin | Director | Manager | Auditor | Staff |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Pending Payments | ✅ | ✅ | ✅ | ✅ | ❌ |
| Export Payment List | ✅ | ✅ | ✅ | ❌ | ❌ |
| Reconcile Payments | ✅ | ✅ | ✅ | ❌ | ❌ |
| 70% Partial Payout | ✅ | ✅ | ❌ | ❌ | ❌ |
| Batch Management (View) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Mark Batch Paid | ✅ | ✅ | ❌ | ❌ | ❌ |

#### Reporting & Compliance
| Feature | Admin | Director | Manager | Auditor | Staff |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Advanced Search | ✅ | ✅ | ✅ | ✅ | ❌ |
| Compliance Reports | ✅ | ✅ | ✅ | ✅ | ❌ |
| Tax Reports | ✅ | ✅ | ✅ | ✅ | ❌ |
| Analytics Dashboard | ✅ | ✅ | ✅ | ❌ | ❌ |
| Debt Analytics | ✅ | ✅ | ✅ | ❌ | ❌ |

#### System Administration
| Feature | Admin | Director | Manager | Auditor | Staff |
| :--- | :---: | :---: | :---: | :---: | :---: |
| User Management | ✅ | ✅ | ❌ | ❌ | ❌ |
| Audit Trail / Logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| System Health | ✅ | ❌ | ❌ | ❌ | ❌ |
| File Imports | ✅ | ✅ | ✅ | ❌ | ❌ |

### Role-Specific Details

**Director Access:**
- Full access to Audit Trail (User Activity, Security Events, Heatmaps)
- Can use "Admin Override" to verify drivers without TIN validation
- Can authorize "Partial Payouts" (70%) for unverified drivers
- Can view batches AND mark them as "Paid"

**Manager Access:**
- Full access to "Advanced Search" including user filtering
- Can use "Admin Override" to verify drivers without TIN
- Can view batches but **cannot** mark them as "Paid" (read-only)
- Can block and unblock drivers

**Auditor Access:**
- Restored access to "Regulatory & Compliance" page for tax reporting
- Can generate PDF statements for any driver from the Driver Detail page
- Can use "Advanced Search" to find drivers
- Strictly blocked from "Imports", "Exporting Payments", and "Reconciling"

## 3.2 Core Features

### Feature 1: Driver Verification (TIN & Business Data)
- **TIN Lookup**: Real-time business name and manager name discovery via TIN.
- **Admin Override**: Directors and Managers can verify drivers without TIN validation when necessary.
- **Driver Blocking**: Block/unblock drivers to prevent payment processing.
- **Verification History**: Identity of the staff member who performed the verification.
- **Photo Storage**: Driver photos saved to disk storage (`/imports/driver_photos`) for performance.

### Feature 2: Smart Excel Import
- **Chronological Validation**: Blocks imports for verified drivers.
- **Phone Cleansing**: Automatically strips non-digits and ensures 9-digit MSISDN format.
- **Mismatch Warnings**: Highlighting when the Excel phone number differs from the database phone.
- **Automatic Debt Deduction**: Debts are automatically deducted from bonuses during import.
- **Fleet Integration**: Supports fleet-specific Excel columns (work_terms, status, balance, payout, bank_fee).

### Feature 3: Payment Batch Processing
- **Batch Export**: Generates Excel files compatible with Telebirr Bulk Pay with unique Batch ID.
- **Batch Isolation**: Each export creates an isolated batch for tracking and re-download.
- **Status Tracking**: Payments move from `pending` -> `processing` (exported) -> `paid` (reconciled).
- **Batch Re-download**: Re-download any previous batch Excel file for payment processing.
- **Manual Completion**: Directors can manually mark batches as "Paid" when reconciliation file unavailable.

### Feature 4: Debt Management
- **Create Debts**: Record driver debts (loans, insurance, advances) with reason and notes.
- **Automatic Deduction**: Debts are automatically deducted from bonuses during import (FIFO order).
- **Deduction History**: Complete transaction history of all deductions per debt.
- **Debt Status Tracking**: Track active vs. paid debts with remaining balances.
- **One Active Debt Rule**: System enforces one active debt per driver at a time.

### Feature 5: Analytics Dashboard
- **Financial Overview**: Total revenue, tax collected, active drivers with period comparisons.
- **Revenue Trends**: Daily, weekly, or monthly revenue visualization.
- **Tax Analytics**: Tax breakdown by category and monthly tax trends.
- **Payout Velocity**: Average days from bonus import to payment.
- **Driver Performance**: Top performers and most consistent drivers.
- **Driver Segmentation**: Categorize drivers by average earnings.
- **Earnings Distribution**: Histogram of driver earnings.

### Feature 6: Scheduled Reports
- **Automated Generation**: Schedule reports to run daily, weekly, or monthly.
- **Email Delivery**: Reports automatically emailed to configured recipients.
- **Report Types**: Withholding tax, debt status, and compliance summary reports.
- **Schedule Management**: Create, update, activate/deactivate, and delete schedules.

### Feature 7: Advanced Search
- **Multi-Field Search**: Search across drivers, payments, and audit logs.
- **Filter Options**: Status, date range, amount range, and more.
- **Saved Searches**: Save frequently used search criteria for quick access.
- **Export Results**: Export search results to Excel.

### Feature 8: System Health Monitoring
- **System Metrics**: Real-time CPU, memory, and storage usage.
- **Database Statistics**: Driver count, payment count, audit log count.
- **Performance Metrics**: Database latency and API health status.
- **Error Tracking**: Error rates by date for system reliability monitoring.

### Feature 9: Compliance Reporting
- **Withholding Tax Reports**: Detailed tax reports by driver with export to Excel.
- **TIN Verification Logs**: Audit trail of all TIN verification events.
- **Driver Statements**: Generate PDF statements for individual drivers.
- **Compliance Summary**: KPIs for verification rates and pending verifications.

### Feature 10: User Activity Tracking
- **Activity Reports**: View all system actions with user, date, and action filters.
- **User Summary**: Breakdown of actions by user (verifications, imports, exports, etc.).
- **Activity Heatmap**: Visualize activity patterns by day and hour.
- **Security Events**: Monitor login attempts, password changes, and user deactivations.

### Feature 11: Notification System
- **System Notifications**: In-app notifications for important events.
- **Notification Types**: Payment, verification, reconciliation, system, debt, and batch notifications.
- **Read Status**: Track read/unread notifications per user.

### Feature 12: Audit Trail
- Every financial change (verification, payment, export, reconcile) is recorded with:
  - User ID and name
  - Action type and description
  - Entity type and ID
  - Detailed JSON data
  - IP address and timestamp

---

# 4. Business Logic & Rules

## 4.1 Bonus Calculation Logic

The system automatically derives Gross Payout and Tax from the "Net Payout" provided in Excel:

1. **Gross Payout**: `Net Payout / 0.97` (Reversing the 3% Withholding Tax).
2. **Withholding Tax**:
   - If **Gross > 3,000 ETB**: `Gross - Net`.
   - If **Gross ≤ 3,000 ETB**: `0` (Tax exempt).
3. **Rounding**: All values are rounded to 2 decimal places.

## 4.2 Unverified Driver Payout (70% Rule)

When an unverified driver requests a payout before completing verification:

1. **Standard 3% Tax**: Applied to the gross payout amount.
2. **Additional 27% Tax**: Unverified drivers pay an additional 27% withholding tax (30% total).
3. **Net Payout Formula**:
   ```
   Final Payout = Gross Amount × 0.70
   ```
4. **Example Calculation**:
   - Gross Payout: 10,000 ETB
   - Standard Tax (3%): 300 ETB
   - Additional Tax (27%): 2,700 ETB
   - **Final Payout to Driver: 7,000 ETB (70%)**

> **Note**: This rule requires Admin or Director authorization via the "Release 70% Payout" feature.

## 4.3 Debt Deduction Logic

Debts are automatically deducted from driver bonuses during import:

1. **FIFO Processing**: Oldest debts are paid first.
2. **Automatic During Import**: When bonuses are imported, active debts are swept.
3. **Deduction Calculation**:
   ```
   Available Amount = Calculated Net Payout (after any prior deductions)
   Deduction = MIN(Available Amount, Remaining Debt)
   Final Payout = Available Amount - Deduction
   ```
4. **Transaction Logging**: Every deduction is recorded in `bonus_deductions` table.
5. **Debt Status Update**: When remaining balance reaches 0, debt status changes to "paid".
6. **One Active Debt**: System enforces one active debt per driver at a time.

## 4.4 Import Logic & Chronology

### The "Verified" Block
Once a driver is marked **Verified**, they are in "Direct Payment Mode". 
- **Rule**: The system will **reject** any new Excel bonus rows for verified drivers.
- **Why**: Prevents double-counting once the driver has moved to direct weekly payments.

### Unverified Payout Override
- **Rule**: Bonuses with `is_unverified_payout = TRUE` can be processed even for unverified drivers.
- **Use Case**: Early payouts for drivers who have completed partial verification.

### Phone Number Validation
- All imports **require** a phone number.
- If the MSISDN in the Excel file differs from the MSISDN in the `drivers` table:
  - System shows a **Warning**.
  - User can **Cancel** or **Proceed Anyway** (which updates the database with the new phone).

## 4.5 Batch Reconciliation Flow

1. **Export**: Staff clicks "Export Pending". System:
   - Creates a new `payment_batch` record with unique Batch ID
   - Creates `payment` records for each driver
   - Links bonuses to payments via `payment_id`
   - Marks payments as `processing`
   - Generates Excel file for Telebirr Bulk Pay

2. **Payment Date**: The `payment_date` defaults to the export date initially.

3. **Reconcile Options**:
   - **Option A - Import Report**: Import the bank's "Success Report". System matches by MSISDN, sets status to `paid`, and updates `payment_date`.
   - **Option B - Manual Completion**: Directors can mark entire batch as "Paid" when reconciliation file is unavailable.

4. **Batch Re-download**: Any batch can be re-downloaded for payment re-processing.

## 4.6 System Workflows (Sequence Diagrams)

### 4.6.1 Excel Import & Debt Deduction

```mermaid
sequenceDiagram
    participant Staff
    participant ImportController
    participant Validator
    participant DebtService
    participant Database

    Staff->>ImportController: Upload Excel File
    ImportController->>Validator: Validate Columns & Phones
    Validator-->>ImportController: Validation Result (Valid/Invalid)
    
    loop For Each Row
        ImportController->>Database: Check Driver Status
        Database-->>ImportController: (Verified/Unverified)
        
        alt Driver Verified
            ImportController->>ImportController: Skip Row (Reject)
        else Driver Unverified
            ImportController->>DebtService: Check Active Debts
            DebtService-->>ImportController: Debt Amount / Remaining
            
            ImportController->>ImportController: Calculate Gross & Tax
            ImportController->>ImportController: Apply Debt Deduction
            ImportController->>Database: Insert Bonus
            ImportController->>Database: Insert BonusDeduction
        end
    end
    
    ImportController-->>Staff: Return Import Summary (Success/Skipped)
```

### 4.6.2 Driver Verification Process

```mermaid
sequenceDiagram
    participant Staff
    participant DriverController
    participant TINService
    participant Database
    participant AuditService

    Staff->>DriverController: Request TIN Lookup (tin_number)
    DriverController->>TINService: Fetch Business Details
    TINService-->>DriverController: Business Name, Manager Name
    DriverController-->>Staff: Show Details for Confirmation

    Staff->>DriverController: Confirm Verification (Password + Photo)
    DriverController->>Database: Validate User Password
    Database-->>DriverController: Valid
    
    DriverController->>Database: Update Driver (Verified=True)
    DriverController->>AuditService: Log Verification Event
    AuditService->>Database: Insert Audit Log
    
    DriverController-->>Staff: Verification Success
```

### 4.6.3 Telebirr Payment Cycle

```mermaid
sequenceDiagram
    participant Admin
    participant PaymentController
    participant BatchService
    participant Database
    participant Telebirr

    Admin->>PaymentController: Request Payment Export
    PaymentController->>BatchService: Create New Batch
    BatchService->>Database: Create Batch Record
    BatchService->>Database: Update Payments (Status=Processing)
    PaymentController-->>Admin: Download Excel File

    Admin->>Telebirr: Upload Batch File
    Telebirr->>Telebirr: Process Payments
    Telebirr-->>Admin: Download Success Report

    Admin->>PaymentController: Upload Success Report (Reconcile)
    PaymentController->>Database: Match MSISDNs
    PaymentController->>Database: Update Payments (Status=Paid)
    PaymentController->>Database: Update Batch (Status=Paid)
    PaymentController-->>Admin: Reconciliation Complete
```

### 4.6.4 70% Partial Payout Request

```mermaid
sequenceDiagram
    participant Director
    participant PayoutController
    participant DebtService
    participant Database

    Director->>PayoutController: Request 70% Payout (DriverID)
    PayoutController->>Database: Get Accumulated Bonuses
    PayoutController->>DebtService: Deduct Active Debts
    
    PayoutController->>PayoutController: Calculate Gross (Remaining)
    PayoutController->>PayoutController: Apply 3% Standard Tax
    PayoutController->>PayoutController: Apply 27% Penalty Tax
    PayoutController->>PayoutController: Net = Gross * 0.70

    PayoutController->>Database: specific Payment Record
    PayoutController->>Database: Clear Bonuses (Mark Paid)
    PayoutController->>Database: Log Audit Event
    
    PayoutController-->>Director: Success Message
```

### 4.6.5 Debt Creation Flow

```mermaid
sequenceDiagram
    participant Admin
    participant DebtController
    participant Database
    participant NotificationService

    Admin->>DebtController: Create Debt (Driver, Amount, Reason)
    DebtController->>Database: Check Active Debts
    
    alt Has Active Debt
        Database-->>DebtController: True
        DebtController-->>Admin: Error: Active Debt Exists
    else No Active Debt
        DebtController->>Database: Insert Debt Record
        Database-->>DebtController: ID: 123
        DebtController->>NotificationService: Notify System
        DebtController-->>Admin: Debt Created Successfully
    end
```

---

# 5. Technical Specification

## 5.1 Database Schema (v4.0)

The system uses 14 tables organized into core entities, tracking tables, and support tables.

### 5.1.1 users table
Stores user accounts with role-based access control.

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff', 'director', 'manager', 'auditor') NOT NULL DEFAULT 'staff',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT NULL,
  otp_code VARCHAR(10) NULL,
  otp_expires_at TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_role (role),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### 5.1.2 drivers table
Stores driver profile, tax identity, verification status, and blocking status.

```sql
CREATE TABLE drivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id VARCHAR(64) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  email VARCHAR(255),
  verified BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  verified_date DATE NULL,
  verified_by INT NULL,
  tin VARCHAR(50) NULL,
  business_name VARCHAR(255) NULL,
  licence_number VARCHAR(100) NULL,
  manager_name VARCHAR(255) NULL,
  manager_photo TEXT NULL,
  tin_verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_driver_id (driver_id),
  INDEX idx_verified (verified),
  INDEX idx_is_blocked (is_blocked),
  INDEX idx_name (full_name),
  INDEX idx_tin (tin),
  FOREIGN KEY (verified_by) REFERENCES users(id)
);
```

### 5.1.3 import_logs table
Records each Excel file import with statistics.

```sql
CREATE TABLE import_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NULL,
  week_date DATE NOT NULL,
  total_records INT NOT NULL,
  success_count INT NOT NULL,
  skipped_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  new_drivers_count INT DEFAULT 0,
  existing_drivers_count INT DEFAULT 0,
  rejected_verified_count INT DEFAULT 0,
  skipped_details JSON,
  imported_by INT,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('success', 'partial', 'failed', 'processing') DEFAULT 'success',
  error_message TEXT,
  FOREIGN KEY (imported_by) REFERENCES users(id),
  INDEX idx_week_date (week_date)
);
```

### 5.1.4 bonuses table
Stores weekly performance entries with fleet integration and debt deduction support.

```sql
CREATE TABLE bonuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id VARCHAR(64) NOT NULL,
  week_date DATE NOT NULL,
  net_payout DECIMAL(10, 2) NOT NULL,
  fleet_net_payout DECIMAL(10, 2) DEFAULT NULL COMMENT 'Original Net Payout from fleet Excel',
  work_terms VARCHAR(255) NULL,
  status VARCHAR(50) NULL,
  payment_status VARCHAR(50) DEFAULT 'Pending',
  balance DECIMAL(10, 2) NULL,
  payout DECIMAL(10, 2) NULL,
  bank_fee DECIMAL(10, 2) NULL,
  gross_payout DECIMAL(10, 2) NULL,
  withholding_tax DECIMAL(10, 2) NULL,
  final_payout DECIMAL(10, 2) NULL,
  is_unverified_payout BOOLEAN DEFAULT FALSE,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  import_log_id INT,
  payment_id INT,
  FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
  FOREIGN KEY (import_log_id) REFERENCES import_logs(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  INDEX idx_driver_week (driver_id, week_date),
  INDEX idx_week_date (week_date),
  INDEX idx_payment_id (payment_id),
  UNIQUE KEY unique_driver_week (driver_id, week_date)
);
```

### 5.1.5 payments table
Handles individual payment records linked to batches.

```sql
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id VARCHAR(50) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('processing', 'paid') DEFAULT 'processing',
  payment_date DATETIME NOT NULL,
  payment_method VARCHAR(50),
  bonus_period_start DATE,
  bonus_period_end DATE,
  processed_by INT,
  notes TEXT,
  batch_id VARCHAR(64),
  batch_internal_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
  FOREIGN KEY (processed_by) REFERENCES users(id),
  INDEX idx_driver_id (driver_id),
  INDEX idx_payment_date (payment_date),
  INDEX idx_status (status),
  INDEX idx_batch_id (batch_id),
  INDEX idx_batch_internal_id (batch_internal_id)
);
```

### 5.1.6 payment_batches table
Manages batch exports for Telebirr Bulk Pay with isolation and re-download capability.

```sql
CREATE TABLE payment_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL UNIQUE,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  driver_count INT DEFAULT 0,
  status ENUM('processing', 'paid') DEFAULT 'processing',
  exported_by INT,
  exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (exported_by) REFERENCES users(id),
  INDEX idx_batch_id (batch_id),
  INDEX idx_exported_at (exported_at)
);
```

### 5.1.7 driver_debts table
Tracks driver debts (loans, insurance, advances) with automatic deduction support.

```sql
CREATE TABLE driver_debts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id VARCHAR(64) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  remaining_amount DECIMAL(15, 2) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  notes TEXT,
  status ENUM('active', 'paid') DEFAULT 'active',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_driver_status (driver_id, status)
);
```

### 5.1.8 bonus_deductions table
Transaction log for debt deductions from bonuses.

```sql
CREATE TABLE bonus_deductions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bonus_id INT NOT NULL,
  debt_id INT NOT NULL,
  amount_deducted DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bonus_id) REFERENCES bonuses(id) ON DELETE CASCADE,
  FOREIGN KEY (debt_id) REFERENCES driver_debts(id),
  INDEX idx_bonus_id (bonus_id),
  INDEX idx_debt_id (debt_id)
);
```

### 5.1.9 notifications table
In-app notifications with type categorization.

```sql
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  type ENUM('payment', 'verification', 'reconciliation', 'system', 'debt', 'batch') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSON,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_created_at (created_at)
);
```

### 5.1.10 report_schedules table
Configures automated scheduled reports with email delivery.

```sql
CREATE TABLE report_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  report_type ENUM('financial', 'compliance', 'user_activity', 'driver_performance', 'debt') NOT NULL,
  frequency ENUM('daily', 'weekly', 'monthly') NOT NULL,
  recipients JSON NOT NULL COMMENT 'Array of email addresses',
  parameters JSON COMMENT 'Report-specific parameters',
  last_run TIMESTAMP NULL,
  next_run TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_active_next_run (is_active, next_run)
);
```

### 5.1.11 system_metrics table
Stores performance monitoring data.

```sql
CREATE TABLE system_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  metric_type VARCHAR(50) NOT NULL COMMENT 'api_response, db_query, error_rate, storage',
  metric_name VARCHAR(100) NOT NULL,
  value DECIMAL(15,2),
  metadata JSON COMMENT 'Additional metric details',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type_time (metric_type, recorded_at),
  INDEX idx_name_time (metric_name, recorded_at)
);
```

### 5.1.12 user_activity_summary table
Aggregated user activity for performance optimization.

```sql
CREATE TABLE user_activity_summary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  date DATE NOT NULL,
  total_actions INT DEFAULT 0,
  verifications_count INT DEFAULT 0,
  imports_count INT DEFAULT 0,
  exports_count INT DEFAULT 0,
  reconciliations_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_date (user_id, date),
  INDEX idx_date (date),
  INDEX idx_user_date (user_id, date)
);
```

### 5.1.13 saved_searches table
User-saved search criteria for quick access.

```sql
CREATE TABLE saved_searches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  name VARCHAR(255) NOT NULL,
  search_type ENUM('driver', 'payment', 'audit', 'import') NOT NULL,
  filters JSON NOT NULL COMMENT 'Search criteria and filters',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_type (user_id, search_type)
);
```

### 5.1.14 audit_logs table
Comprehensive audit trail for all system actions.

```sql
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(64),
  details JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);
```

### 5.1.15 Entity State Diagrams

#### Payment Lifecycle
```mermaid
stateDiagram-v2
    [*] --> Pending: Bonus Imported
    Pending --> Processing: Batch Export
    Processing --> Paid: Reconciliation Success
    Processing --> Failed: Reconciliation Error
    Paid --> [*]
    Failed --> Processing: Retry Export
```

#### Driver Verification Lifecycle
```mermaid
stateDiagram-v2
    [*] --> Unverified: Registered
    Unverified --> Verified: Verification Complete
    Verified --> Blocked: Admin Block
    Blocked --> Verified: Admin Unblock
    Verified --> [*]
```

#### Debt Lifecycle
```mermaid
stateDiagram-v2
    [*] --> Active: Debt Created
    Active --> Active: Partial Deduction
    Active --> Paid: Full Repayment
    Paid --> [*]
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

### 5.2.1 User Management (Admin Only)

- **GET /api/users**: List all accounts.
- **POST /api/users**: Create Staff/Admin account.
- **PUT /api/users/:id**: Update permissions or status.

### 5.2.2 Driver & TIN Endpoints

- **GET /api/drivers**: Paginated list of drivers.
- **GET /api/drivers/search?q=...**: Fuzzy search by ID/Name/Phone.
- **GET /api/tin/lookup/:tin**: Real-time tax data lookup.
- **PUT /api/drivers/:id/verify**: Finalizes document & TIN verification.
  - Requires: `tin_number`, `business_name`, `manager_name`, `manager_photo` (base64) and `password`.

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

### 5.2.3 Payment & Reconciliation (v3.0)

- **GET /api/payments/pending**: List all unverified drivers with bonuses.
- **GET /api/payments/export**: Batch export to Telebirr Bulk Pay format.
- **POST /api/payments/reconcile**: Import Telebirr report to mark as `paid`.
- **GET /api/payments/history**: Searchable history of all past payouts.

### 5.2.4 Import & Excel Management

- **POST /api/imports/validate**: Dry-run validation of a bonus file.
- **POST /api/imports/excel**: Final import of bonus rows.
- **GET /api/imports/history**: Audit log of all file imports.

### 5.2.5 Debt Management Endpoints

**POST /api/debts**

**Description:** Create a new debt for a driver

**Access:** Admin only

**Request:**
```json
POST /api/debts
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "driverId": "85fb80236ffa474db93fdccd0cdab66b",
  "amount": 5000.00,
  "reason": "Vehicle Insurance",
  "notes": "Annual premium payment"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Debt created successfully.",
  "debtId": 42,
  "remaining": 3500.00,
  "deducted_retroactively": 1500.00
}
```

**GET /api/debts/search**

**Description:** Search debts with filters

**Access:** Admin, Director, Manager

**Query Parameters:**
- `q` - Search term (driver name/ID)
- `status` - Filter by status (active/paid)
- `page` - Page number
- `limit` - Results per page

**GET /api/debts/driver/:driverId**

**Description:** Get all debts for a specific driver

**Access:** Admin, Director, Manager

**GET /api/debts/overview**

**Description:** Get debt statistics overview

**Access:** Admin, Director, Manager

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_debt_issued": 150000.00,
    "total_outstanding": 45000.00,
    "actively_in_debt_count": 12,
    "breakdown_by_reason": [...],
    "top_debtors": [...]
  }
}
```

**GET /api/debts/aging**

**Description:** Get debt aging report

**Access:** Admin, Director, Manager

**Response:**
```json
{
  "success": true,
  "aging": {
    "period_0_30": 15000.00,
    "period_30_60": 8000.00,
    "period_60_90": 12000.00,
    "period_90_plus": 10000.00
  }
}
```

### 5.2.6 Batch Management Endpoints

**GET /api/batches**

**Description:** List all payment batches

**Access:** Admin, Director, Manager

**Query Parameters:**
- `status` - Filter by status (processing/paid)
- `page` - Page number
- `limit` - Results per page

**Response:**
```json
{
  "success": true,
  "batches": [
    {
      "id": 1,
      "batch_id": "BAT-2025-01-15-abc123",
      "total_amount": 125000.00,
      "driver_count": 45,
      "status": "processing",
      "exported_by": "John Doe",
      "exported_at": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {...}
}
```

**GET /api/batches/:batchId**

**Description:** Get batch details with payments

**Access:** Admin, Director, Manager

**GET /api/batches/:batchId/download**

**Description:** Re-download batch Excel file

**Access:** Admin, Director, Manager

**PUT /api/batches/:batchId/paid**

**Description:** Mark entire batch as paid

**Access:** Admin, Director only

**Request:**
```json
{
  "notes": "Manually marked as paid - Telebirr confirmation received via phone"
}
```

### 5.2.7 Analytics Endpoints

**GET /api/analytics/financial-overview**

**Description:** Get financial KPIs with period comparison

**Access:** Admin, Director, Manager

**Query Parameters:**
- `start_date` - Period start
- `end_date` - Period end

**Response:**
```json
{
  "success": true,
  "overview": {
    "total_revenue": "1250000.00",
    "total_tax": "37500.00",
    "active_drivers": 450,
    "avg_payout_time_days": 3.5,
    "growth": {
      "revenue": "+12.5%",
      "drivers": "+8.2%",
      "bonuses": "+15.3%"
    }
  }
}
```

**GET /api/analytics/revenue-trends**

**Description:** Get revenue trends over time

**Query Parameters:**
- `period` - daily/weekly/monthly
- `months` - Number of months to retrieve

**GET /api/analytics/tax-analytics**

**Description:** Get tax breakdown and monthly trends

**GET /api/analytics/payout-velocity**

**Description:** Get average payout timing metrics

**GET /api/analytics/driver-performance**

**Description:** Get top performers and most consistent drivers

**GET /api/analytics/driver-segmentation**

**Description:** Get driver categorization by earnings

**GET /api/analytics/earnings-distribution**

**Description:** Get histogram of driver earnings

### 5.2.8 Audit & User Activity Endpoints

**GET /api/audit/activity-report**

**Description:** Get activity logs with filters

**Access:** Admin, Director

**Query Parameters:**
- `user_id` - Filter by user
- `start_date` - Period start
- `end_date` - Period end
- `action` - Filter by action type
- `page` - Page number
- `limit` - Results per page

**Response:**
```json
{
  "success": true,
  "logs": [
    {
      "id": 123,
      "user_id": 1,
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "action": "Verify Driver",
      "entity_type": "driver",
      "entity_id": "85fb80236ffa474db93fdccd0cdab66b",
      "details": {...},
      "ip_address": "192.168.1.1",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 500,
  "page": 1,
  "limit": 50
}
```

**GET /api/audit/user-summary**

**Description:** Get activity breakdown by user

**Access:** Admin, Director

**GET /api/audit/activity-heatmap**

**Description:** Get activity patterns by day and hour

**Access:** Admin, Director

**GET /api/audit/security-events**

**Description:** Monitor login attempts and security-related events

**Access:** Admin, Director

### 5.2.9 Reports Endpoints

**GET /api/reports/withholding-tax**

**Description:** Generate withholding tax report

**Access:** Admin, Director, Manager, Auditor

**Query Parameters:**
- `start_date` - Report period start
- `end_date` - Report period end
- `format` - json/excel

**GET /api/reports/compliance-summary**

**Description:** Get compliance KPIs

**Access:** Admin, Director, Manager, Auditor

**GET /api/reports/tin-verification-log**

**Description:** Get TIN verification audit trail

**Access:** Admin, Director, Manager, Auditor

**GET /api/reports/driver-statement/:driverId**

**Description:** Generate PDF statement for a driver

**Access:** Admin, Director, Manager, Auditor, Staff

**GET /api/reports/schedules**

**Description:** List scheduled reports

**Access:** Admin, Director

**POST /api/reports/schedules**

**Description:** Create a new scheduled report

**Access:** Admin, Director

**Request:**
```json
{
  "name": "Weekly Tax Report",
  "report_type": "financial",
  "frequency": "weekly",
  "recipients": ["finance@example.com", "manager@example.com"],
  "parameters": {}
}
```

**PUT /api/reports/schedules/:id**

**Description:** Update scheduled report

**Access:** Admin, Director

**DELETE /api/reports/schedules/:id**

**Description:** Delete scheduled report

**Access:** Admin, Director

### 5.2.10 System Health Endpoints

**GET /api/system-health/dashboard**

**Description:** Get system health metrics

**Access:** Admin only

**Response:**
```json
{
  "success": true,
  "metrics": {
    "system": {
      "uptime": 86400,
      "memory": {
        "free": 4294967296,
        "total": 8589934592,
        "usage_percent": "50.0"
      },
      "cpu_load": [1.5, 1.2, 1.0],
      "cpu_usage_percent": "25.5",
      "cpu_count": 4,
      "platform": "linux",
      "arch": "x64"
    },
    "database": {
      "driver_count": 1500,
      "payment_count": 5000,
      "audit_count": 25000,
      "unread_notifications": 12
    },
    "storage": {
      "imports_size_mb": "256.50",
      "photos_size_mb": "1024.75"
    }
  }
}
```

**GET /api/system-health/performance**

**Description:** Get performance metrics (DB latency)

**Access:** Admin only

**GET /api/system-health/storage**

**Description:** Get storage usage details

**Access:** Admin only

**GET /api/system-health/errors**

**Description:** Get error rates by date

**Access:** Admin only

### 5.2.11 Advanced Search Endpoints

**POST /api/search/advanced**

**Description:** Multi-filter search across entities

**Access:** Admin, Director, Manager, Auditor

**Request:**
```json
{
  "entity": "driver",
  "filters": {
    "verified": true,
    "date_range": {
      "start": "2025-01-01",
      "end": "2025-01-31"
    },
    "min_amount": 5000
  },
  "page": 1,
  "limit": 25
}
```

**GET /api/search/saved**

**Description:** Get user's saved searches

**Access:** All authenticated users

**POST /api/search/saved**

**Description:** Save a search

**Access:** All authenticated users

**DELETE /api/search/saved/:id**

**Description:** Delete a saved search

**Access:** All authenticated users

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
• All POST/PUT requests use **Content-Type: application/json** (except file Imports which use multipart/form-data)
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

```
/public
  /css
    - styles.css (main application styles)
  /js
    - api.js (API communication layer with auth headers)
    - auth.js (authentication handling, token management)
    - ui.js (shared UI components, navigation, theming)
    - import.js (file import handling)
    - search.js (driver search & lookup)
    - driver-detail.js (driver profile and bonus management)
    - pending-payments.js (pending payment processing)
    - accumulated.js (accumulated payments view)
    - advanced-search.js (multi-filter search)
    - analytics-dashboard.js (financial analytics)
    - batch-management.js (batch export management)
    - compliance-reports.js (regulatory reports)
    - debt-analytics.js (debt management)
    - scheduled-reports.js (report scheduling)
    - system-health.js (system monitoring)
    - user-activity.js (audit trail visualization)
    - unverified-drivers.js (unverified driver list)
    - verified-drivers.js (verified driver list)
    - export-util.js (Excel export utilities)
  /pages
    - login.html (login page - public)
    - index.html (dashboard - requires auth)
    - import.html (import page - requires auth)
    - driver-detail.html (driver view - requires auth)
    - driver-management.html (driver management - requires auth)
    - payments.html (payment history - requires auth)
    - pending-payments.html (pending payments - requires auth)
    - accumulated.html (accumulated payments - requires auth)
    - unverified-drivers.html (unverified list - requires auth)
    - verified-drivers.html (verified list - requires auth)
    - advanced-search.html (advanced search - requires auth)
    - analytics-dashboard.html (analytics - requires auth)
    - batch-management.html (batches - requires auth)
    - compliance-reports.html (compliance - requires auth)
    - debt-analytics.html (debt management - admin only)
    - scheduled-reports.html (report scheduling - requires auth)
    - system-health.html (system monitoring - admin only)
    - user-activity.html (audit trail - admin/director only)
    - users.html (user management - admin only)
    - help.html (help & documentation)
  /vendor
    - xlsx.min.js (Excel parsing/generation)
    - chart.min.js (data visualization)
```

### Key Components

- **Login Page:** User authentication with email and password
- **Dashboard:** Overview of pending drivers, weekly statistics (role-based access)
- **Import Module:** Excel file import with validation, preview, and debt deduction
- **Search Module:** Real-time driver search with autocomplete
- **Advanced Search:** Multi-filter search with save functionality
- **Driver Detail View:** Complete bonus history, debt management, and verification
- **Payment Module:** Batch export and reconciliation workflow
- **Batch Management:** View, re-download, and manage payment batches
- **Debt Analytics:** Debt overview, aging reports, and repayment trends
- **Analytics Dashboard:** Financial KPIs, revenue trends, tax analytics
- **Compliance Reports:** Withholding tax, TIN verifications, driver statements
- **Scheduled Reports:** Configure automated report generation
- **System Health:** CPU, memory, storage, and error monitoring
- **User Activity:** Audit trail, activity heatmaps, security events
- **User Management:** Create, edit, and manage users (admin only)
- **Navigation:** Role-based menu with 5-tier access control

## 5.4 Performance & Scalability Analysis

<aside>
⚡

**Real-World Scenario:** Weekly Excel files with 3,000-5,000 driver records

</aside>

### Processing Time Estimates

**For a file with 5,000 driver records:**

**Breakdown by Operation:**

1. **File Import & Reading (1-3 seconds)**
    - Import 5,000 rows Excel file (~500KB - 2MB): 0.5-1s
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

1. **CPU Spike (File Import & Parsing):** 40-60% CPU for 1-3 seconds
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

# 6. User Guides (Web UI)

### 6.1 Driver Verification Workflow
1. Use the **Search** bar to find a driver by Name or ID.
2. Click **View Details**.
3. Enter the driver's **TIN** and click **Lookup**.
4. Confirm the retrieved Business/Manager name.
5. Import the **Manager's Photo**.
6. Type your account **Password** and click **Verify Driver**.

### 6.2 Telebirr Reconciliation Workflow
1. Go to **Payments > Pending**.
2. Click **Export for Telebirr**. (Result: A `.xlsx` file is downloaded, and statuses move to `processing`).
3. After the bank confirms, request the **Success Report**.
   - **Requirement:** The report MUST contain a column named **Comment** OR **Transaction Details**.
   - **Requirement:** This column must preserve the metadata string (e.g., `DriverID, BonusID...`) from the original export.
   - **Note:** Matching by Phone Number alone is **NOT** supported for security reasons.
4. Go to **Payments > Reconcile**.
5. Import the bank's **Success Report**.
6. System strictly matches by Metadata and updates statuses to `paid`.

### 6.3 Batch Management Workflow
1. Go to **Payments > Batch Management**.
2. View all exported batches with status (processing/paid).
3. To re-download a batch file, click **Download** on the batch row.
4. To manually mark as paid (Director/Admin only):
   - Click **Mark as Paid** on the batch row
   - Add a note explaining the manual completion reason
   - Confirm the action

### 6.4 Debt Management Workflow
1. Go to **Driver Detail** page for the target driver.
2. Click **Add Debt** (Admin only).
3. Enter:
   - Amount
   - Reason (Loan, Insurance, Advance, Other)
   - Notes (optional)
4. Click **Create Debt**.
5. System automatically deducts from future bonus imports.
6. View debt status and deduction history in **Debt Analytics**.

### 6.5 70% Partial Payout Workflow (Unverified Drivers)
When an unverified driver needs early payout:

1. Go to **Driver Detail** page.
2. Review the accumulated bonuses.
3. Click **Release 70% Payout** (Admin/Director only).
4. System calculates:
   - Gross Payout (after any debts)
   - Standard 3% Withholding Tax
   - Additional 27% Withholding Tax
   - Final Payout = 70% of Gross
5. Confirm with your account password.
6. Payment is exported with next batch.

### 6.6 Scheduled Reports Workflow
1. Go to **Reports > Scheduled Reports**.
2. Click **Create Schedule**.
3. Configure:
   - Report Name
   - Report Type (Financial, Compliance, User Activity, Debt)
   - Frequency (Daily, Weekly, Monthly)
   - Recipients (email addresses)
4. Click **Save**.
5. Reports are automatically generated and emailed on schedule.

### 6.7 Advanced Search Workflow
1. Go to **Advanced Search**.
2. Select entity type (Driver, Payment, Audit Log).
3. Configure filters:
   - Date range
   - Status (Verified/Unverified, Paid/Processing)
   - Amount range
   - User (for audit logs)
4. Click **Search**.
5. Optionally, click **Save Search** for quick access later.
6. Export results to Excel if needed.

---

# 7. Deployment & Maintenance

### 7.1 Production Checklist
- [ ] **SSL/HTTPS**: Ensure all API traffic is encrypted.
- [ ] **Database Backup**: Set up a daily cron job for `mysqldump`.
- [ ] **Import Permissions**: Ensure `public/imports/driver_photos` is writable.
- [ ] **Environment**: Set `NODE_ENV=production`.
- [ ] **Scheduled Reports**: Configure SMTP settings in environment variables.
- [ ] **System Health**: Verify admin access to System Health page.

### 7.2 Monitoring
- Monitor System Health page for CPU, memory, and storage metrics.
- Review Error Rates for trends in system issues.
- Check User Activity for unusual login patterns.
- Monitor Log files at `logs/` for application errors.

---

# 8. Glossary
- **MSISDN**: The driver's phone number used for Telebirr.
- **TIN**: Tax Identification Number.
- **Batch ID**: A unique string generated during Export to track a set of payments.
- **Debt**: A financial obligation (loan, insurance premium) that is automatically deducted from bonuses.
- **70% Payout**: Partial payout available to unverified drivers with 30% additional withholding tax.
- **Force Pay**: Override flag allowing bonus payment for special cases.
- **Admin Override**: Verification without TIN lookup (Director/Manager access required).
- **Batch Reconciliation**: Process of matching bank success reports to internal payments.

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
    - File Import validation
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

**Step 3: Import Your First Excel File**

1. Click "Import" in the navigation menu
2. Click "Choose File" or drag and drop your Excel file
3. Wait for validation (checklist will appear)
4. If validation passes, enter the week date
5. Click "Import" to import
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

### How to Import Weekly Bonus Files

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
2. **Import the File:**
    - Go to Import page
    - Select or drag-drop your Excel file
    - Wait for automatic validation
3. **Check Validation Results:**
    - ✅ File is readable
    - ✅ Single sheet only
    - ✅ All required columns present
    - ✅ Column names are correct
    - ✅ File contains data
    - ✅ Net payout values are numeric
4. **Complete Import:**
    - Enter week date (e.g., 2025-12-01)
    - Click "Import"
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

- **Staff:** Can Import files, search drivers, verify drivers, and process payments
- **Admin:** Can do everything staff can do, plus manage user accounts

**Q: How do I get login credentials?**

A: Contact your system administrator. Only admins can create new user accounts.

**Q: Can I change my password?**

A: Yes! Go to your profile page and click "Change Password". You'll need to enter your current password.

**Q: What browsers are supported?**

A: Chrome, Firefox, Safari, and Edge (latest versions recommended).

**Q: Can I use this on mobile?**

A: Yes, the interface is responsive and works on tablets and phones, though desktop is recommended for best experience.

### Excel Import Questions

**Q: What format should my Excel file be in?**

A: Your Excel file must:

- Have exactly one sheet
- Contain these columns: ID, Full name, Phone number, Date, Net payout
- Column names must match exactly (case-insensitive)
- Net payout values must be numbers

**Q: Why does my file Import fail with "multiple sheets" error?**

A: The system only accepts Excel files with one sheet. Delete extra sheets or save only the data sheet you need.

**Q: What if column names are spelled differently?**

A: Column names must match exactly. "Phone" is not the same as "Phone number". Check the spelling carefully.

**Q: Can I Import the same file twice?**

A: The system prevents duplicate bonuses for the same driver in the same week. You'll get an error if you try.

**Q: What happens to verified drivers in my Excel file?**

A: Their rows are automatically skipped and appear in the "rejected" count. This prevents double-payment.

**Q: How do I know if the Import was successful?**

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

### Import Issues

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

**Problem:** Import succeeds but shows many "rejected" records

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

- Check import history to see if this file was already Imported
- If this is a correction, admin must delete the old entry first
- Make sure you're Importing the correct week's file

### Search & Display Issues

<aside>
⚠️

**Problem:** Can't find a driver in search

</aside>

**Symptom:** Search returns no results for a driver you know exists

**Solutions:**

1. **Check spelling:** Make sure name is spelled correctly
2. **Try driver ID:** Search by the long hash ID instead
3. **Check if imported:** Go to Import History to verify driver was in Imported files
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

- Import files every Monday consistently
- Check validation results before Importing
- Review import summary after each Import
- Keep Excel files organized by week/date
- Verify column names match exactly
- Keep only one sheet in Excel file

❌ **DON'T:**

- Import the same file twice
- Edit Excel file while Importing
- Skip validation step
- Import files with multiple sheets
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
| Open Import | `Ctrl/Cmd + U` | Go to Import page |
| Logout | `Ctrl/Cmd + Shift + Q` | Log out quickly |

## 8.7 Glossary of Terms

**Accumulated Bonus:** The total amount of bonuses a driver has earned but not yet been paid.

**Bonus Period:** The date range of weeks included in a payment (e.g., Nov 1 - Nov 30).

**Driver ID:** Unique hash identifier from Yango system (e.g., `85fb80236ffa474db93fdccd0cdab66b`).

**Import Log:** A record of an Excel file Import, including statistics and results.

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
2. ▶️ Importing Your First Excel File (3 min)
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
I was trying to: Import bonuses_week1_dec.xlsx
Expected: File would Import successfully
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

**Document Version:** 4.0
**Last Updated:** 2026-01-16
**Maintained By:** Development Team

**Change Log:**
- v4.0 (2026-01-16): Added 5 user roles, 8 new features, 8 new database tables, 40+ API endpoints, 7 workflow guides
- v3.0 (2025-12-23): TIN verification, Telebirr reconciliation
- v2.0 (2025-12-19): Payment tracking, audit trail
- v1.0 (2025-12-01): Initial release

</aside>
