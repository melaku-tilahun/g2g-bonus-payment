-- Admin Features Database Migration
-- Created: 2026-01-09
-- Purpose: Add tables for analytics, notifications, reports, and system health monitoring

USE g2g_bonus_db;

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
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

-- Report Schedules Table
CREATE TABLE IF NOT EXISTS report_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  report_type ENUM('financial', 'compliance', 'user_activity', 'driver_performance', 'debt') NOT NULL,
  frequency ENUM('daily', 'weekly', 'monthly') NOT NULL,
  recipients JSON NOT NULL COMMENT 'Array of email addresses',
  parameters JSON COMMENT 'Report-specific parameters (date ranges, filters, etc)',
  last_run TIMESTAMP NULL,
  next_run TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_active_next_run (is_active, next_run)
);

-- System Metrics Table
CREATE TABLE IF NOT EXISTS system_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  metric_type VARCHAR(50) NOT NULL COMMENT 'api_response, db_query, error_rate, storage',
  metric_name VARCHAR(100) NOT NULL,
  value DECIMAL(15,2),
  metadata JSON COMMENT 'Additional metric details',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type_time (metric_type, recorded_at),
  INDEX idx_name_time (metric_name, recorded_at)
);

-- User Activity Summary Table (for performance optimization)
CREATE TABLE IF NOT EXISTS user_activity_summary (
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

-- Saved Searches Table
CREATE TABLE IF NOT EXISTS saved_searches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  name VARCHAR(255) NOT NULL,
  search_type ENUM('driver', 'payment', 'audit', 'import') NOT NULL,
  filters JSON NOT NULL COMMENT 'Search criteria and filters',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_type (user_id, search_type)
);
