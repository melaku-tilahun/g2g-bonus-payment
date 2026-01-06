CREATE DATABASE IF NOT EXISTS g2g_bonus_db;
USE g2g_bonus_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
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

-- Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id VARCHAR(64) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  email VARCHAR(255),
  verified BOOLEAN DEFAULT FALSE,
  verified_date DATE NULL,
  verified_by INT NULL,
  -- TIN Verification Fields
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
  INDEX idx_name (full_name),
  INDEX idx_tin (tin),
  FOREIGN KEY (verified_by) REFERENCES users(id)
);

-- Import Logs Table
CREATE TABLE IF NOT EXISTS import_logs (
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
  status ENUM('success', 'partial', 'failed') DEFAULT 'success',
  error_message TEXT,
  FOREIGN KEY (imported_by) REFERENCES users(id),
  INDEX idx_week_date (week_date)
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id VARCHAR(50) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  batch_id VARCHAR(50) NULL,
  status ENUM('pending', 'processing', 'paid') DEFAULT 'pending',
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

-- Payment Batches Table for Isolation & Re-download
CREATE TABLE IF NOT EXISTS payment_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL UNIQUE,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  driver_count INT DEFAULT 0,
  status ENUM('processing', 'paid') DEFAULT 'processing',
  exported_by INT,
  exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exported_by) REFERENCES users(id),
  INDEX idx_batch_id (batch_id),
  INDEX idx_exported_at (exported_at)
);

-- Bonuses Table
CREATE TABLE IF NOT EXISTS bonuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id VARCHAR(64) NOT NULL,
  week_date DATE NOT NULL,
  net_payout DECIMAL(10, 2) NOT NULL,
  work_terms VARCHAR(255) NULL,
  status VARCHAR(50) NULL,
  balance DECIMAL(10, 2) NULL,
  payout DECIMAL(10, 2) NULL,
  bank_fee DECIMAL(10, 2) NULL,
  gross_payout DECIMAL(10, 2) NULL,
  withholding_tax DECIMAL(10, 2) NULL,
  final_payout DECIMAL(10, 2) NULL,
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

-- Driver Debts Table (Loans, Insurance, etc.)
CREATE TABLE IF NOT EXISTS driver_debts (
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

-- Bonus Deductions Log (Transaction History)
CREATE TABLE IF NOT EXISTS bonus_deductions (
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

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
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
