-- Fix bill_payments RLS — run this in your Supabase SQL Editor.

-- ---------------------------------------------------------------
-- STEP 1: Backfill organization_id via customer_name → unpaid_bills → daily_reports
-- ---------------------------------------------------------------
UPDATE bill_payments bp
SET organization_id = dr.organization_id
FROM unpaid_bills ub
JOIN daily_reports dr ON dr.id = ub.report_id
WHERE bp.organization_id IS NULL
  AND lower(bp.customer_name) = lower(ub.customer_name)
  AND dr.organization_id IS NOT NULL;

-- ---------------------------------------------------------------
-- STEP 2: For any bill_payments still NULL, assign them to the
-- single organization in the system (safe for single-org setups).
-- ---------------------------------------------------------------
UPDATE bill_payments
SET organization_id = (SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1)
WHERE organization_id IS NULL;

-- ---------------------------------------------------------------
-- STEP 3: Drop all existing policies and recreate them properly.
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read bill_payments"   ON bill_payments;
DROP POLICY IF EXISTS "Authenticated users can insert bill_payments" ON bill_payments;
DROP POLICY IF EXISTS "Users can read own org bill_payments"          ON bill_payments;
DROP POLICY IF EXISTS "Users can insert own org bill_payments"        ON bill_payments;

-- SELECT:
--   superadmins see every row (they manage all data)
--   employees see only their organization's rows
CREATE POLICY "Users can read own org bill_payments"
  ON bill_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
    OR organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- INSERT: superadmins can insert for any org; employees only for their own org
CREATE POLICY "Users can insert own org bill_payments"
  ON bill_payments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
    OR organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
