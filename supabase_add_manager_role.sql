-- Add 'manager' to the allowed roles in the profiles table.
-- Run this in your Supabase SQL Editor (use the postgres role if you get a permissions error).

-- Step 1: Drop the existing role check constraint (name may vary — find it first)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- Step 2: Re-add the constraint with 'manager' included
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('employee', 'superadmin', 'manager'));
