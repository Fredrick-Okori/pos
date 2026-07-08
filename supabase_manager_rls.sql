-- Grant manager role read access to the tables used in the manager dashboard.
-- Run this in your Supabase SQL Editor.
-- Managers are scoped to their assigned organization.

-- ── daily_reports ────────────────────────────────────────────────────────────
-- Drop any existing policy that might block managers, then recreate.
DROP POLICY IF EXISTS "Org members can read daily_reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Managers can read org daily_reports" ON public.daily_reports;

CREATE POLICY "Org members can read daily_reports"
  ON public.daily_reports FOR SELECT TO authenticated
  USING (
    -- superadmins see all
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
    OR
    -- employees and managers see only their org
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ── unpaid_bills ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org members can read unpaid_bills" ON public.unpaid_bills;
DROP POLICY IF EXISTS "Managers can read org unpaid_bills" ON public.unpaid_bills;

CREATE POLICY "Org members can read unpaid_bills"
  ON public.unpaid_bills FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
    OR
    report_id IN (
      SELECT id FROM public.daily_reports
      WHERE organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- ── expenses ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org members can read expenses" ON public.expenses;
DROP POLICY IF EXISTS "Managers can read org expenses" ON public.expenses;

CREATE POLICY "Org members can read expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
    OR
    report_id IN (
      SELECT id FROM public.daily_reports
      WHERE organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- ── profiles (for employee names on reports) ──────────────────────────────────
DROP POLICY IF EXISTS "Org members can read org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can read org profiles" ON public.profiles;

CREATE POLICY "Org members can read org profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
    OR
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );
