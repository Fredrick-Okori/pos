-- Full permissions for the manager role, scoped to their assigned organization.
-- Managers can do everything a superadmin can except switch organizations.
-- ADDITIVE — does not touch existing policies for other roles.
-- Run this in your Supabase SQL Editor.

-- ── Helper functions (SECURITY DEFINER bypasses RLS, avoids recursion) ────────

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager'
  )
$$;

CREATE OR REPLACE FUNCTION public.my_organization_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ── daily_reports ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Managers can read org daily_reports"   ON public.daily_reports;
DROP POLICY IF EXISTS "Managers can insert org daily_reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Managers can update org daily_reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Managers can delete org daily_reports" ON public.daily_reports;

CREATE POLICY "Managers can read org daily_reports"
  ON public.daily_reports FOR SELECT TO authenticated
  USING (public.is_manager() AND organization_id = public.my_organization_id());

CREATE POLICY "Managers can insert org daily_reports"
  ON public.daily_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_manager() AND organization_id = public.my_organization_id());

CREATE POLICY "Managers can update org daily_reports"
  ON public.daily_reports FOR UPDATE TO authenticated
  USING (public.is_manager() AND organization_id = public.my_organization_id());

CREATE POLICY "Managers can delete org daily_reports"
  ON public.daily_reports FOR DELETE TO authenticated
  USING (public.is_manager() AND organization_id = public.my_organization_id());

-- ── expenses ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Managers can read org expenses"   ON public.expenses;
DROP POLICY IF EXISTS "Managers can insert org expenses" ON public.expenses;
DROP POLICY IF EXISTS "Managers can update org expenses" ON public.expenses;
DROP POLICY IF EXISTS "Managers can delete org expenses" ON public.expenses;

CREATE POLICY "Managers can read org expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (
    public.is_manager()
    AND report_id IN (
      SELECT id FROM public.daily_reports WHERE organization_id = public.my_organization_id()
    )
  );

CREATE POLICY "Managers can insert org expenses"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager()
    AND report_id IN (
      SELECT id FROM public.daily_reports WHERE organization_id = public.my_organization_id()
    )
  );

CREATE POLICY "Managers can update org expenses"
  ON public.expenses FOR UPDATE TO authenticated
  USING (
    public.is_manager()
    AND report_id IN (
      SELECT id FROM public.daily_reports WHERE organization_id = public.my_organization_id()
    )
  );

CREATE POLICY "Managers can delete org expenses"
  ON public.expenses FOR DELETE TO authenticated
  USING (
    public.is_manager()
    AND report_id IN (
      SELECT id FROM public.daily_reports WHERE organization_id = public.my_organization_id()
    )
  );

-- ── unpaid_bills ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Managers can read org unpaid_bills"   ON public.unpaid_bills;
DROP POLICY IF EXISTS "Managers can insert org unpaid_bills" ON public.unpaid_bills;
DROP POLICY IF EXISTS "Managers can update org unpaid_bills" ON public.unpaid_bills;
DROP POLICY IF EXISTS "Managers can delete org unpaid_bills" ON public.unpaid_bills;

CREATE POLICY "Managers can read org unpaid_bills"
  ON public.unpaid_bills FOR SELECT TO authenticated
  USING (
    public.is_manager()
    AND report_id IN (
      SELECT id FROM public.daily_reports WHERE organization_id = public.my_organization_id()
    )
  );

CREATE POLICY "Managers can insert org unpaid_bills"
  ON public.unpaid_bills FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager()
    AND report_id IN (
      SELECT id FROM public.daily_reports WHERE organization_id = public.my_organization_id()
    )
  );

CREATE POLICY "Managers can update org unpaid_bills"
  ON public.unpaid_bills FOR UPDATE TO authenticated
  USING (
    public.is_manager()
    AND report_id IN (
      SELECT id FROM public.daily_reports WHERE organization_id = public.my_organization_id()
    )
  );

CREATE POLICY "Managers can delete org unpaid_bills"
  ON public.unpaid_bills FOR DELETE TO authenticated
  USING (
    public.is_manager()
    AND report_id IN (
      SELECT id FROM public.daily_reports WHERE organization_id = public.my_organization_id()
    )
  );

-- ── bill_payments ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Managers can read org bill_payments"   ON public.bill_payments;
DROP POLICY IF EXISTS "Managers can insert org bill_payments" ON public.bill_payments;
DROP POLICY IF EXISTS "Managers can update org bill_payments" ON public.bill_payments;
DROP POLICY IF EXISTS "Managers can delete org bill_payments" ON public.bill_payments;

CREATE POLICY "Managers can read org bill_payments"
  ON public.bill_payments FOR SELECT TO authenticated
  USING (public.is_manager() AND organization_id = public.my_organization_id());

CREATE POLICY "Managers can insert org bill_payments"
  ON public.bill_payments FOR INSERT TO authenticated
  WITH CHECK (public.is_manager() AND organization_id = public.my_organization_id());

CREATE POLICY "Managers can update org bill_payments"
  ON public.bill_payments FOR UPDATE TO authenticated
  USING (public.is_manager() AND organization_id = public.my_organization_id());

CREATE POLICY "Managers can delete org bill_payments"
  ON public.bill_payments FOR DELETE TO authenticated
  USING (public.is_manager() AND organization_id = public.my_organization_id());

-- ── clients ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Managers can read org clients"   ON public.clients;
DROP POLICY IF EXISTS "Managers can insert org clients" ON public.clients;
DROP POLICY IF EXISTS "Managers can update org clients" ON public.clients;
DROP POLICY IF EXISTS "Managers can delete org clients" ON public.clients;

CREATE POLICY "Managers can read org clients"
  ON public.clients FOR SELECT TO authenticated
  USING (public.is_manager() AND organization_id = public.my_organization_id());

CREATE POLICY "Managers can insert org clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_manager() AND organization_id = public.my_organization_id());

CREATE POLICY "Managers can update org clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (public.is_manager() AND organization_id = public.my_organization_id());

CREATE POLICY "Managers can delete org clients"
  ON public.clients FOR DELETE TO authenticated
  USING (public.is_manager() AND organization_id = public.my_organization_id());

-- ── profiles (read-only — employee management stays superadmin-only) ──────────
DROP POLICY IF EXISTS "Managers can read org profiles" ON public.profiles;
CREATE POLICY "Managers can read org profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_manager()
    AND organization_id = public.my_organization_id()
  );

-- ── organizations (read-only — managers see their own org only) ───────────────
DROP POLICY IF EXISTS "Managers can read their organization" ON public.organizations;
CREATE POLICY "Managers can read their organization"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    public.is_manager()
    AND id = public.my_organization_id()
  );
