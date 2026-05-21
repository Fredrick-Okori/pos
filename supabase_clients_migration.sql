-- Add new fields to daily_reports
ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS stanbic NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usd_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 3700,
  ADD COLUMN IF NOT EXISTS bar_sales NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kitchen_sales NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shisha_sales NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recon_status VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recon_diff NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS locked_by VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ DEFAULT NULL;

-- Client ledger tables
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_charges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  note TEXT DEFAULT '',
  report_id UUID REFERENCES daily_reports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  payment_mode VARCHAR(20) DEFAULT NULL,
  note TEXT DEFAULT '',
  linked_charge_id UUID REFERENCES client_charges(id) ON DELETE SET NULL,
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already exists, add the column
ALTER TABLE client_payments ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) DEFAULT NULL;
