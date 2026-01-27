-- Clean all test data from database (preserve users table for login)
-- Generated: 2026-01-27
-- Environment: Development Only

SET FOREIGN_KEY_CHECKS = 0;

-- Clear all tables except users
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE bonus_deductions;
TRUNCATE TABLE bonuses;
TRUNCATE TABLE driver_debts;
TRUNCATE TABLE driver_phones;
TRUNCATE TABLE drivers;
TRUNCATE TABLE import_logs;
TRUNCATE TABLE notifications;
TRUNCATE TABLE payment_batches;
TRUNCATE TABLE payments;
TRUNCATE TABLE report_schedules;
TRUNCATE TABLE saved_searches;
TRUNCATE TABLE system_metrics;
TRUNCATE TABLE user_activity_summary;

-- Note: users table is NOT truncated to preserve login credentials

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Database cleaned successfully! Users table preserved.' as Status;
