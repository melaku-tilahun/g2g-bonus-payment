-- Driver Phone History Table (Telebirr Verification)
CREATE TABLE IF NOT EXISTS driver_phones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id VARCHAR(64) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  status ENUM('active', 'inactive', 'pending', 'rejected') DEFAULT 'pending',
  is_primary BOOLEAN DEFAULT FALSE,
  
  -- Usage History
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_from TIMESTAMP NULL,
  valid_to TIMESTAMP NULL,
  
  -- Audit
  added_by_import_id INT NULL,
  approved_by INT(11) NULL,
  rejection_reason TEXT NULL,
  
  INDEX idx_driver_phone_status (driver_id, status),
  INDEX idx_phone_unique_active (phone_number, status),
  FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
