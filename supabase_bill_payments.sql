-- Track individual payment transactions per customer
CREATE TABLE IF NOT EXISTS bill_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  customer_name text NOT NULL,
  amount numeric NOT NULL,
  payment_mode text,
  notes text,
  paid_at date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bill_payments"
  ON bill_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert bill_payments"
  ON bill_payments FOR INSERT TO authenticated WITH CHECK (true);
