-- Add email column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email VARCHAR(255) DEFAULT NULL;
