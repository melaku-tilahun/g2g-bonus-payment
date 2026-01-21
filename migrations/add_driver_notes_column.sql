-- Migration: Add notes column to drivers table
-- Date: 2026-01-21
-- Purpose: Enable admins to add timestamped notes to driver profiles

ALTER TABLE drivers ADD COLUMN notes JSON DEFAULT NULL COMMENT 'Array of notes with timestamp and author info';

-- Example note structure:
-- [
--   {
--     "text": "Driver contacted about phone verification",
--     "created_at": "2026-01-21T14:30:00Z",
--     "created_by": 5,
--     "created_by_name": "Admin User"
--   }
-- ]
