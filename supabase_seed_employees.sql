-- =============================================
-- SEED TEST EMPLOYEES FOR EACH BAR
-- Run this in your Supabase SQL Editor
-- Default password for all: "password123"
-- =============================================

-- Create employee for Krug
INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, aud, role
) VALUES (
    uuid_generate_v4(), '00000000-0000-0000-0000-000000000000',
    'employee@krug.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
        'full_name', 'Krug Employee',
        'role', 'employee',
        'organization_id', (SELECT id FROM public.organizations WHERE slug = 'krug')
    ),
    NOW(), NOW(), '', 'authenticated', 'authenticated'
);

-- Create employee for Thrones
INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, aud, role
) VALUES (
    uuid_generate_v4(), '00000000-0000-0000-0000-000000000000',
    'employee@thrones.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
        'full_name', 'Thrones Employee',
        'role', 'employee',
        'organization_id', (SELECT id FROM public.organizations WHERE slug = 'thrones')
    ),
    NOW(), NOW(), '', 'authenticated', 'authenticated'
);

-- Create employee for Nomads
INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, aud, role
) VALUES (
    uuid_generate_v4(), '00000000-0000-0000-0000-000000000000',
    'employee@nomads.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
        'full_name', 'Nomads Employee',
        'role', 'employee',
        'organization_id', (SELECT id FROM public.organizations WHERE slug = 'nomads')
    ),
    NOW(), NOW(), '', 'authenticated', 'authenticated'
);
