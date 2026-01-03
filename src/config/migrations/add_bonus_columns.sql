ALTER TABLE bonuses
ADD COLUMN work_terms VARCHAR(255) NULL AFTER net_payout,
ADD COLUMN status VARCHAR(50) NULL AFTER work_terms,
ADD COLUMN balance DECIMAL(10, 2) NULL AFTER status,
ADD COLUMN payout DECIMAL(10, 2) NULL AFTER balance,
ADD COLUMN bank_fee DECIMAL(10, 2) NULL AFTER payout,
ADD COLUMN gross_payout DECIMAL(10, 2) NULL AFTER bank_fee,
ADD COLUMN withholding_tax DECIMAL(10, 2) NULL AFTER gross_payout;

-- Update existing records to have consistent values if needed (optional)
-- UPDATE bonuses SET gross_payout = net_payout / 0.97 WHERE gross_payout IS NULL;
