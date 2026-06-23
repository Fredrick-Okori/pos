-- Allow all org members (employees + admins) to read clients in their organization.
-- Run this in your Supabase SQL Editor.

CREATE POLICY "Org members can read clients"
ON clients FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);
