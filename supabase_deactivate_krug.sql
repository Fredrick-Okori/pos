-- =============================================
-- DEACTIVATE KRUG ORGANIZATION
-- Safe to re-run (idempotent)
-- =============================================

-- Mark Krug as inactive so it does not appear in the application organization list
UPDATE public.organizations
SET is_active = false,
    updated_at = NOW()
WHERE slug = 'krug';

