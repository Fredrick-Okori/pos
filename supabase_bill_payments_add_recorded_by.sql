-- Add recorded_by_name to bill_payments so each payment shows who recorded it.
-- Run this in your Supabase SQL Editor.

ALTER TABLE bill_payments
  ADD COLUMN IF NOT EXISTS recorded_by_name TEXT;
