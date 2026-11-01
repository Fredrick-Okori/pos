-- =============================================
-- SYSTEM NOTIFICATIONS MIGRATION
-- Safe to re-run (idempotent)
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),
    sender_email TEXT NOT NULL,
    target_role TEXT NOT NULL DEFAULT 'manager',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 250000,
    currency TEXT NOT NULL DEFAULT 'UGX',
    billing_month TEXT NOT NULL,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'paid', 'cancelled')),
    payment_instructions TEXT,
    notes TEXT,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES public.profiles(id),
    acknowledged_by_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON public.notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_billing_month ON public.notifications(billing_month);

-- 3. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Drop old policies if any
DROP POLICY IF EXISTS "Superadmins can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Superadmins can manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "Managers can view notifications for their organization" ON public.notifications;
DROP POLICY IF EXISTS "Managers can update notifications for their organization" ON public.notifications;

-- 5. Policies
CREATE POLICY "Superadmins can view all notifications" ON public.notifications
    FOR SELECT USING (public.is_superadmin());

CREATE POLICY "Superadmins can manage notifications" ON public.notifications
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Managers can view notifications for their organization" ON public.notifications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.organization_id = notifications.organization_id
                OR notifications.organization_id IS NULL
            )
            AND profiles.role IN ('manager', 'superadmin')
        )
    );

CREATE POLICY "Managers can update notifications for their organization" ON public.notifications
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.organization_id = notifications.organization_id
                OR notifications.organization_id IS NULL
            )
            AND profiles.role IN ('manager', 'superadmin')
        )
    );

