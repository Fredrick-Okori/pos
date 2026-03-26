-- =============================================
-- EXPENSES: ADD paid_from ACCOUNT FIELD
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Add paid_from column to expenses (defaults to 'cash' for existing rows)
DO $$ BEGIN
    ALTER TABLE public.expenses ADD COLUMN paid_from TEXT DEFAULT 'cash' NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Add a check constraint to ensure valid account types
DO $$ BEGIN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_paid_from_check
        CHECK (paid_from IN ('airtel_money', 'mtn_money', 'visa_card', 'cash'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create index for querying expenses by account
CREATE INDEX IF NOT EXISTS idx_expenses_paid_from ON public.expenses(paid_from);
