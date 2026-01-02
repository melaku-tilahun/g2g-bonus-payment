-- Migration script to add TIN verification columns to existing drivers table
-- Run this if the database already exists

ALTER TABLE drivers 
ADD COLUMN tin VARCHAR(50) NULL AFTER verified_by,
ADD COLUMN business_name VARCHAR(255) NULL AFTER tin,
ADD COLUMN licence_number VARCHAR(100) NULL AFTER business_name,
ADD COLUMN manager_name VARCHAR(255) NULL AFTER licence_number,
ADD COLUMN manager_photo TEXT NULL AFTER manager_name,
ADD COLUMN tin_verified_at TIMESTAMP NULL AFTER manager_photo,
ADD INDEX idx_tin (tin);
