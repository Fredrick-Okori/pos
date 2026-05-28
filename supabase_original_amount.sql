-- Add original_amount to unpaid_bills to track what was originally owed
ALTER TABLE unpaid_bills ADD COLUMN IF NOT EXISTS original_amount NUMERIC DEFAULT 0;

-- Backfill: for bills still owing, original_amount = current amount
-- For already-zeroed bills we can't recover the value, so they stay 0
UPDATE unpaid_bills SET original_amount = amount WHERE amount > 0 AND original_amount = 0;
