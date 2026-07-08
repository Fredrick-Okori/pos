-- Revert supabase_manager_rls.sql
-- Drops the 4 policies that were created.
-- Run this in your Supabase SQL Editor.

DROP POLICY IF EXISTS "Org members can read daily_reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Org members can read unpaid_bills"  ON public.unpaid_bills;
DROP POLICY IF EXISTS "Org members can read expenses"      ON public.expenses;
DROP POLICY IF EXISTS "Org members can read org profiles"  ON public.profiles;
