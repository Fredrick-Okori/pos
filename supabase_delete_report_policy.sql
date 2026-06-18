-- =============================================
-- DELETE REPORT RLS POLICIES
-- Run this in your Supabase SQL Editor to allow
-- superadmins to delete daily sales reports.
-- =============================================

-- Allow superadmins to delete any daily report
CREATE POLICY "Superadmins can delete all reports" ON public.daily_reports
    FOR DELETE USING (public.is_superadmin());

-- Allow superadmins to delete expenses (needed as a fallback in case
-- cascade does not fire under RLS for the authenticated session)
CREATE POLICY "Superadmins can delete all expenses" ON public.expenses
    FOR DELETE USING (public.is_superadmin());

-- Allow superadmins to delete unpaid bills (same reason as above)
CREATE POLICY "Superadmins can delete all unpaid bills" ON public.unpaid_bills
    FOR DELETE USING (public.is_superadmin());
