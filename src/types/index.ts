export type UserRole = 'employee' | 'superadmin'

export interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  organization_id: string | null
  created_at: string
  updated_at: string
}

export interface DailyReport {
  id: string
  user_id: string
  organization_id: string | null
  report_date: string
  total_sales: number
  airtel_money: number
  mtn_money: number
  visa_card: number
  cash: number
  complementaries: number
  discounts: number
  cash_at_hand: number
  admin_comment: string | null
  is_edited: boolean
  edited_by: string | null
  edited_at: string | null
  created_at: string
  updated_at: string
  // New payment / sales fields
  usd_amount: number
  exchange_rate: number
  bar_sales: number
  kitchen_sales: number
  shisha_sales: number
  // Reconciliation fields
  recon_status: 'RECONCILED' | 'SHORTAGE' | 'EXCESS' | null
  recon_diff: number
  // Locking fields
  is_locked: boolean
  locked_by: string | null
  locked_at: string | null
  notes: string | null
  // Joined data
  profiles?: Profile
  expenses?: Expense[]
  unpaid_bills?: UnpaidBill[]
}

export type AccountType = 'airtel_money' | 'mtn_money' | 'visa_card' | 'cash'

export interface AccountConfig {
  key: AccountType
  label: string
  color: string
  bgColor: string
  iconColor: string
}

export interface Expense {
  id: string
  report_id: string
  description: string
  amount: number
  paid_from: AccountType
  created_at: string
}

export interface UnpaidBill {
  id: string
  report_id: string
  customer_name: string
  amount: number
  notes: string | null
  created_at: string
}

export interface ReportFormData {
  report_date: string
  total_sales: number
  airtel_money: number
  mtn_money: number
  visa_card: number
  cash: number
  complementaries: number
  discounts: number
  // New payment / sales breakdown fields
  usd_amount: number
  exchange_rate: number
  bar_sales: number
  kitchen_sales: number
  shisha_sales: number
  notes: string
  expenses: { description: string; amount: number; paid_from: AccountType }[]
  unpaid_bills: { customer_name: string; amount: number; notes: string }[]
}

export interface Client {
  id: string
  organization_id: string | null
  name: string
  phone_number: string | null
  email: string | null
  notes: string | null
  created_at: string
  // computed from joins
  charges?: ClientCharge[]
  payments?: ClientPayment[]
}

export interface ClientCharge {
  id: string
  client_id: string
  organization_id: string | null
  date: string
  amount: number
  note: string
  report_id: string | null
  created_at: string
}

export type PaymentMode = 'cash' | 'airtel_money' | 'mtn_money' | 'visa_card'

export interface ClientPayment {
  id: string
  client_id: string
  organization_id: string | null
  date: string
  amount: number
  note: string
  payment_mode: PaymentMode | null
  linked_charge_id: string | null
  added_by: string | null
  created_at: string
}
