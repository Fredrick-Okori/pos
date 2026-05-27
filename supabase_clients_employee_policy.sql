-- =============================================
-- Clients: employee insert policy + phone_number as mandatory unique identifier
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Add phone_number and notes columns (safe if already exist)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30) DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- 2. Remove duplicate phone numbers — keep the oldest record per number, delete the rest
DELETE FROM clients
WHERE id NOT IN (
  SELECT DISTINCT ON (phone_number) id
  FROM clients
  WHERE phone_number IS NOT NULL
  ORDER BY phone_number, created_at ASC
);

-- 3. Unique constraint on phone_number so no two clients share a number
DO $$ BEGIN
  ALTER TABLE clients ADD CONSTRAINT clients_phone_number_unique UNIQUE (phone_number);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Allow employees and admins to INSERT clients
DO $$ BEGIN
  CREATE POLICY "Employees can create clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('employee', 'superadmin')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
