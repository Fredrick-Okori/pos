-- Revert supabase_manager_read_policies.sql
-- Run this in your Supabase SQL Editor.

DROP POLICY IF EXISTS "Managers can read org daily_reports"   ON public.daily_reports;
DROP POLICY IF EXISTS "Managers can insert org daily_reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Managers can update org daily_reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Managers can delete org daily_reports" ON public.daily_reports;

DROP POLICY IF EXISTS "Managers can read org expenses"   ON public.expenses;
DROP POLICY IF EXISTS "Managers can insert org expenses" ON public.expenses;
DROP POLICY IF EXISTS "Managers can update org expenses" ON public.expenses;
DROP POLICY IF EXISTS "Managers can delete org expenses" ON public.expenses;

DROP POLICY IF EXISTS "Managers can read org unpaid_bills"   ON public.unpaid_bills;
DROP POLICY IF EXISTS "Managers can insert org unpaid_bills" ON public.unpaid_bills;
DROP POLICY IF EXISTS "Managers can update org unpaid_bills" ON public.unpaid_bills;
DROP POLICY IF EXISTS "Managers can delete org unpaid_bills" ON public.unpaid_bills;

DROP POLICY IF EXISTS "Managers can read org bill_payments"   ON public.bill_payments;
DROP POLICY IF EXISTS "Managers can insert org bill_payments" ON public.bill_payments;
DROP POLICY IF EXISTS "Managers can update org bill_payments" ON public.bill_payments;
DROP POLICY IF EXISTS "Managers can delete org bill_payments" ON public.bill_payments;

DROP POLICY IF EXISTS "Managers can read org clients"   ON public.clients;
DROP POLICY IF EXISTS "Managers can insert org clients" ON public.clients;
DROP POLICY IF EXISTS "Managers can update org clients" ON public.clients;
DROP POLICY IF EXISTS "Managers can delete org clients" ON public.clients;

DROP POLICY IF EXISTS "Managers can read org profiles"        ON public.profiles;
DROP POLICY IF EXISTS "Managers can read their organization"  ON public.organizations;

DROP FUNCTION IF EXISTS public.is_manager();
DROP FUNCTION IF EXISTS public.my_organization_id();
