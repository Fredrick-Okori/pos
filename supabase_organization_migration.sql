-- =============================================
-- ORGANIZATION MULTI-TENANCY MIGRATION
-- Safe to re-run (idempotent)
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Create organizations table (skip if exists)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add organization_id to profiles (skip if exists)
DO $$ BEGIN
    ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Add organization_id to daily_reports (skip if exists)
DO $$ BEGIN
    ALTER TABLE public.daily_reports ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 4. Create indexes (skip if exist)
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_organization_id ON public.daily_reports(organization_id);

-- 5. Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts, then recreate
DROP POLICY IF EXISTS "Superadmins can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Superadmins can manage organizations" ON public.organizations;
DROP POLICY IF EXISTS "Employees can view their organization" ON public.organizations;

CREATE POLICY "Superadmins can view all organizations" ON public.organizations
    FOR SELECT USING (public.is_superadmin());

CREATE POLICY "Superadmins can manage organizations" ON public.organizations
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Employees can view their organization" ON public.organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.organization_id = organizations.id
        )
    );

-- 6. Insert bar organizations (skip duplicates)
INSERT INTO public.organizations (name, slug, description)
VALUES
  ('Krug', 'krug', 'Krug Bar'),
  ('Thrones', 'thrones', 'Thrones Bar'),
  ('Nomads', 'nomads', 'Nomads Bar')
ON CONFLICT (slug) DO NOTHING;

-- 7. Assign all existing profiles to Krug (only those without an org)
UPDATE public.profiles
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'krug')
WHERE organization_id IS NULL;

-- 8. Assign all existing reports to Krug
UPDATE public.daily_reports
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'krug')
WHERE organization_id IS NULL;

-- 9. Update handle_new_user to include organization_id from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, organization_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
        (NEW.raw_user_meta_data->>'organization_id')::UUID
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
