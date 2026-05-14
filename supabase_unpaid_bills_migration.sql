-- =============================================
-- UNPAID BILLS TABLE MIGRATION
-- Run this in your Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS unpaid_bills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'unpaid', -- 'unpaid', 'paid', 'overdue', etc.
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup by client and status
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_client_id ON unpaid_bills(client_id);
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_status ON unpaid_bills(status);
