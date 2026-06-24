'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useAuth } from '@/contexts/AuthContext'
import { AccountIcon } from '@/lib/accounts'
import toast from 'react-hot-toast'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { useRouter } from 'next/navigation'
import CurrencyInput from '@/components/CurrencyInput'

type PaymentMode = 'cash' | 'airtel_money' | 'mtn_money' | 'visa_card' | 'stanbic'
type DateFilter = 'all' | 'this_week' | 'last_week' | 'last_month' | 'custom'
type AccountPeriod = 'all' | 'this_month' | 'last_month' | 'custom'

const ACCOUNT_MODES: { key: string; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'airtel_money', label: 'Airtel Money' },
  { key: 'mtn_money', label: 'MTN Money' },
  { key: 'visa_card', label: 'Visa Card' },
]


interface UnpaidBillRow {
  id: string
  customer_name: string
  amount: number
  original_amount: number
  notes: string | null
  created_at: string
  daily_reports: {
    report_date: string
    organization_id: string | null
  }
}

interface CustomerGroup {
  name: string
  total: number
  bills: UnpaidBillRow[]
}

interface PaymentState {
  customer: CustomerGroup
  date: string
  amount: number
  payment_mode: PaymentMode | ''
  notes: string
  submitting: boolean
}

export default function EmployeeUnpaidBalancePage() {
  const supabase = createClient()
  const { selectedOrg } = useOrganization()
  const { profile } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [bills, setBills] = useState<UnpaidBillRow[]>([])
  const [clientsMap, setClientsMap] = useState<Record<string, { id: string; phone: string | null; email: string | null }>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [payment, setPayment] = useState<PaymentState | null>(null)

  const [payments, setPayments] = useState<{ amount: number; payment_mode: string | null; paid_at: string; customer_name: string }[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [accountPeriod, setAccountPeriod] = useState<AccountPeriod>('all')
  const [accountCustomFrom, setAccountCustomFrom] = useState('')
  const [accountCustomTo, setAccountCustomTo] = useState('')

  const isInDateRange = (reportDate: string, filter: DateFilter): boolean => {
    if (filter === 'all') return true

    if (filter === 'custom') {
      if (!customFrom && !customTo) return true
      const d = new Date(reportDate)
      if (customFrom && d < new Date(customFrom)) return false
      if (customTo && d > new Date(customTo)) return false
      return true
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayOfWeek = today.getDay()
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

    let start: Date, end: Date
    if (filter === 'this_week') {
      start = new Date(today)
      start.setDate(today.getDate() + daysToMonday)
      end = new Date(start)
      end.setDate(start.getDate() + 6)
    } else if (filter === 'last_week') {
      const thisMonday = new Date(today)
      thisMonday.setDate(today.getDate() + daysToMonday)
      start = new Date(thisMonday)
      start.setDate(thisMonday.getDate() - 7)
      end = new Date(thisMonday)
      end.setDate(thisMonday.getDate() - 1)
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      end = new Date(now.getFullYear(), now.getMonth(), 0)
    }

    const d = new Date(reportDate)
    return d >= start && d <= end
  }

  const fetchBills = async () => {
    setLoading(true)
    try {
      const orgId = selectedOrg?.id || profile?.organization_id || null

      let query = supabase
        .from('unpaid_bills')
        .select(`
          *,
          daily_reports!inner (
            report_date,
            organization_id
          )
        `)
        .order('created_at', { ascending: false })

      if (orgId) {
        query = query.eq('daily_reports.organization_id', orgId)
      }

      const { data, error } = await query
      if (error) {
        console.error('Supabase error:', JSON.stringify(error))
        throw error
      }
      setBills(data || [])
    } catch (err) {
      console.error('Error fetching unpaid bills:', err)
      toast.error('Failed to load unpaid bills')
    } finally {
      setLoading(false)
    }
  }

  const fetchClientsMap = async () => {
    try {
      const orgId = selectedOrg?.id || profile?.organization_id || null
      let q = supabase.from('clients').select('id, name, phone_number, email')
      if (orgId) q = q.eq('organization_id', orgId)
      const { data } = await q
      if (data) {
        const map: Record<string, { id: string; phone: string | null; email: string | null }> = {}
        ;(data as any[]).forEach(c => { map[c.name.toLowerCase()] = { id: c.id, phone: c.phone_number, email: c.email } })
        setClientsMap(map)
      }
    } catch {
      // non-critical
    }
  }

  const fetchPayments = async () => {
    setLoadingPayments(true)
    try {
      const orgId = selectedOrg?.id || profile?.organization_id || null
      if (!orgId) return
      let q = supabase.from('bill_payments').select('amount,payment_mode,paid_at,customer_name').eq('organization_id', orgId)
      const { data } = await q
      setPayments(data || [])
    } catch {
      // non-critical
    } finally {
      setLoadingPayments(false)
    }
  }

  const clientSlug = (entry: { id: string; phone: string | null }): string =>
    entry.phone ? entry.phone.replace(/[^0-9]/g, '') : entry.id

  useEffect(() => {
    fetchBills()
    fetchClientsMap()
    fetchPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg?.id, profile?.organization_id])

  const uniqueCustomers = Array.from(new Set(bills.map(b => b.customer_name))).sort()

  // Account totals — only count payments for customers who still have bill records
  const activeCustomerNames = new Set(bills.map(b => b.customer_name.toLowerCase()))

  const customRangeLabel =
    accountCustomFrom && accountCustomTo
      ? `${accountCustomFrom} – ${accountCustomTo}`
      : accountCustomFrom
      ? `From ${accountCustomFrom}`
      : accountCustomTo
      ? `Until ${accountCustomTo}`
      : 'Custom Range'

  const periodLabel: Record<AccountPeriod, string> = {
    all: 'All Time',
    this_month: format(new Date(), 'MMMM yyyy'),
    last_month: format(subMonths(new Date(), 1), 'MMMM yyyy'),
    custom: customRangeLabel,
  }

  const filteredPayments = payments.filter(p => {
    if (!activeCustomerNames.has((p.customer_name || '').toLowerCase())) return false
    if (accountPeriod === 'all') return true
    const today = new Date()
    if (accountPeriod === 'this_month') {
      const d = new Date(p.paid_at)
      return d >= startOfMonth(today) && d <= endOfMonth(today)
    }
    if (accountPeriod === 'last_month') {
      const last = subMonths(today, 1)
      const d = new Date(p.paid_at)
      return d >= startOfMonth(last) && d <= endOfMonth(last)
    }
    // custom range
    if (!accountCustomFrom && !accountCustomTo) return true
    const d = new Date(p.paid_at)
    if (accountCustomFrom && d < new Date(accountCustomFrom)) return false
    if (accountCustomTo && d > new Date(accountCustomTo)) return false
    return true
  })
  const accountTotals = ACCOUNT_MODES.map(mode => {
    const modePayments = filteredPayments.filter(p => p.payment_mode === mode.key)
    return { ...mode, total: modePayments.reduce((s, p) => s + Number(p.amount), 0), count: modePayments.length }
  })
  const totalAllAccounts = accountTotals.reduce((s, a) => s + a.total, 0)

  const filtered = bills.filter(b => {
    const matchesSearch =
      b.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDate = isInDateRange(b.daily_reports.report_date, dateFilter)
    const matchesCustomer = !customerFilter || b.customer_name === customerFilter
    return matchesSearch && matchesDate && matchesCustomer
  })

  const totalOutstanding = filtered.reduce((s, b) => s + Number(b.amount), 0)

  const customerGroups: CustomerGroup[] = Object.values(
    filtered.reduce((acc, bill) => {
      const key = bill.customer_name.toLowerCase()
      if (!acc[key]) acc[key] = { name: bill.customer_name, total: 0, bills: [] }
      acc[key].bills.push(bill)
      acc[key].total += Number(bill.amount)
      return acc
    }, {} as Record<string, CustomerGroup>)
  ).sort((a, b) => {
    // Outstanding customers first, cleared (total=0) at the bottom
    if (a.total === 0 && b.total > 0) return 1
    if (a.total > 0 && b.total === 0) return -1
    return b.total - a.total
  })

  const owingCount = customerGroups.filter(cg => cg.total > 0).length
  const clearedCount = customerGroups.filter(cg => cg.total === 0).length
  const totalCollected = filtered.reduce((s, b) => s + Math.max(0, Number(b.original_amount || 0) - Number(b.amount)), 0)

  const nameToSlug = (name: string) =>
    name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const openPaymentModal = (customer: CustomerGroup, e: React.MouseEvent) => {
    e.stopPropagation()
    setPayment({ customer, date: format(new Date(), 'yyyy-MM-dd'), amount: 0, payment_mode: '', notes: '', submitting: false })
  }

  const handlePaymentSubmit = async () => {
    if (!payment) return
    const amt = payment.amount
    if (!amt || amt <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }
    if (!payment.payment_mode) {
      toast.error('Please select a payment mode')
      return
    }
    if (amt > payment.customer.total) {
      toast.error('Payment exceeds total balance')
      return
    }

    setPayment(p => p ? { ...p, submitting: true } : null)

    try {
      // Sort bills oldest first so we clear the earliest debt first
      const sorted = [...payment.customer.bills].sort(
        (a, b) => new Date(a.daily_reports.report_date).getTime() - new Date(b.daily_reports.report_date).getTime()
      )

      let remaining = amt

      for (const bill of sorted) {
        if (remaining <= 0) break
        const billAmt = Number(bill.amount)
        const originalAmt = Number(bill.original_amount) || billAmt

        if (remaining >= billAmt) {
          const { error } = await supabase.from('unpaid_bills').update({ amount: 0, original_amount: originalAmt }).eq('id', bill.id)
          if (error) throw error
          remaining -= billAmt
        } else {
          const { error } = await supabase.from('unpaid_bills').update({ amount: billAmt - remaining, original_amount: originalAmt }).eq('id', bill.id)
          if (error) throw error
          remaining = 0
        }
      }

      const isFullPayment = amt >= payment.customer.total

      fetch('/api/email/payment-cleared', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: payment.customer.name,
          amountPaid: amt,
          remainingBalance: Math.max(0, payment.customer.total - amt),
          paymentMode: payment.payment_mode,
          date: payment.date,
        }),
      }).catch(() => {})

      toast.success(
        isFullPayment
          ? `${payment.customer.name}'s balance fully cleared`
          : `Payment of ${amt.toLocaleString()} UGX recorded`
      )
      setPayment(null)
      await fetchBills()
    } catch (err) {
      console.error('Payment error:', err)
      toast.error('Failed to record payment')
      setPayment(p => p ? { ...p, submitting: false } : null)
    }
  }

  const exportBalances = () => {
    const date = new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })
    const rows = customerGroups.map(cg => {
      const billRows = cg.bills.map(b => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${b.daily_reports.report_date}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;color:#666">${b.notes || '–'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:right;color:#dc2626;font-weight:600">${Number(b.amount).toLocaleString()}</td>
        </tr>`).join('')
      return `
        <tr style="background:#f8f9fa">
          <td colspan="3" style="padding:10px 10px 6px;font-weight:700;font-size:14px;color:#0C2340;border-top:2px solid #e2e8f0">
            ${cg.name}
            <span style="margin-left:8px;font-size:11px;font-weight:400;color:#888">${cg.bills.length} bill${cg.bills.length !== 1 ? 's' : ''}</span>
            <span style="float:right;color:#d97706;font-weight:700;font-size:15px">${cg.total.toLocaleString()} UGX</span>
          </td>
        </tr>
        ${billRows}`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Outstanding Balances – SEIV</title>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#111;padding:40px;max-width:800px;margin:0 auto}
  h1{font-size:22px;color:#0C2340;margin-bottom:4px;font-weight:700}
  .sub{font-size:11px;color:#666;margin-bottom:24px}
  .cards{display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap}
  .card{background:#f4f8ff;border-radius:8px;padding:12px 18px;min-width:120px;border:1px solid #e2e8f0}
  .card-label{font-size:10px;color:#666;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em}
  .card-val{font-size:19px;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;padding:8px 10px;background:#0C2340;color:#fff;font-size:11px;font-weight:600}
  th:last-child{text-align:right}
  .footer{margin-top:32px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:12px;text-align:center}
  .print-btn{display:inline-flex;align-items:center;gap:8px;margin-bottom:24px;padding:9px 20px;background:#0C2340;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  .print-btn:hover{background:#1E4A7A}
  @media print{.print-btn{display:none!important}body{padding:20px}@page{margin:15mm}}
</style></head>
<body>
<button class="print-btn" onclick="window.print()">&#128438; Save as PDF / Print</button>
<h1>Outstanding Balances</h1>
<div class="sub">SEIV Point of Sale &middot; Generated ${date}</div>
<div class="cards">
  <div class="card"><div class="card-label">Total Outstanding</div><div class="card-val" style="color:#dc2626">${totalOutstanding.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Clients Owing</div><div class="card-val" style="color:#0C2340">${customerGroups.length}</div></div>
  <div class="card"><div class="card-label">Total Bills</div><div class="card-val" style="color:#0C2340">${filtered.length}</div></div>
</div>
<table>
  <thead><tr><th>Date</th><th>Notes</th><th style="text-align:right">Amount (UGX)</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">SEIV &middot; This is a system-generated report.</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});</script>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'width=900,height=700')
    if (!win) { toast.error('Allow popups to export PDF'); URL.revokeObjectURL(url); return }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const emailBalances = () => {
    const list = customerGroups
      .slice(0, 20)
      .map(cg => `  ${cg.name}: UGX ${cg.total.toLocaleString()} (${cg.bills.length} bill${cg.bills.length !== 1 ? 's' : ''})`)
      .join('\n')
    const subject = encodeURIComponent('Outstanding Balances · SEIV')
    const body = encodeURIComponent(
      `Outstanding Balances – SEIV Bar & Restaurant\n` +
      `Generated: ${new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
      `Total Outstanding: UGX ${totalOutstanding.toLocaleString()}\n` +
      `Clients Owing:     ${customerGroups.length}\n` +
      `Total Bills:       ${filtered.length}\n\n` +
      `Breakdown:\n${list}\n\n` +
      `Powered by SEIV · SEIV`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  return (
    <ProtectedRoute allowedRoles={['employee']}>
      <DashboardLayout>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Balances</h1>
            <p className="text-gray-500">Clients with invoices from daily reports</p>
          </div>
          {customerGroups.length > 0 && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={emailBalances}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors"
                style={{ borderColor: 'rgba(12,35,64,.2)', color: '#0C2340' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </button>
              <button
                onClick={exportBalances}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors"
                style={{ borderColor: 'rgba(12,35,64,.2)', color: '#0C2340' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export PDF
              </button>
            </div>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card" style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.25)' }}>
            <p className="text-sm" style={{ color: '#92400e' }}>Total Outstanding</p>
            <p className="text-3xl font-bold font-mono" style={{ color: '#b45309' }}>
              {totalOutstanding.toLocaleString()}
            </p>
            <p className="text-xs mt-1" style={{ color: '#b45309', opacity: 0.6 }}>UGX across all clients</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Clients Owing</p>
            <p className="text-3xl font-bold text-gray-900">{owingCount}</p>
          </div>
          <div className="card" style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)' }}>
            <p className="text-sm" style={{ color: '#065f46' }}>Clients Cleared</p>
            <p className="text-3xl font-bold" style={{ color: '#059669' }}>{clearedCount}</p>
          </div>
          <div className="card" style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)' }}>
            <p className="text-sm" style={{ color: '#1e40af' }}>Total Collected</p>
            <p className="text-3xl font-bold font-mono" style={{ color: '#2563eb' }}>{totalCollected.toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: '#2563eb', opacity: 0.6 }}>UGX paid by clients</p>
          </div>
        </div>

        {/* Payment Collections by Account */}
        <div className="card mb-8">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Payment Collections by Account</h2>
              <p className="text-xs text-gray-400 mt-0.5">Total collected via each payment channel · {periodLabel[accountPeriod]}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'this_month', 'last_month', 'custom'] as AccountPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setAccountPeriod(p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={accountPeriod === p
                    ? { background: '#0C2340', color: '#fff' }
                    : { background: 'rgba(12,35,64,.06)', color: '#475569', border: '1px solid rgba(12,35,64,.12)' }
                  }
                >
                  {p === 'all' ? 'All Time' : p === 'this_month' ? 'This Month' : p === 'last_month' ? 'Last Month' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {accountPeriod === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: 'rgba(12,35,64,.04)', border: '1px solid rgba(12,35,64,.1)' }}>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">From</label>
                <input
                  type="date"
                  value={accountCustomFrom}
                  max={accountCustomTo || undefined}
                  onChange={e => setAccountCustomFrom(e.target.value)}
                  className="input-field py-1.5 text-sm"
                  style={{ width: '150px' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">To</label>
                <input
                  type="date"
                  value={accountCustomTo}
                  min={accountCustomFrom || undefined}
                  onChange={e => setAccountCustomTo(e.target.value)}
                  className="input-field py-1.5 text-sm"
                  style={{ width: '150px' }}
                />
              </div>
              {(accountCustomFrom || accountCustomTo) && (
                <button
                  onClick={() => { setAccountCustomFrom(''); setAccountCustomTo('') }}
                  className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {loadingPayments ? (
            <div className="flex items-center gap-3 py-4 text-gray-400">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
              <span className="text-sm">Loading payments...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-4 rounded-2xl mb-5"
                style={{ background: 'linear-gradient(135deg,#0C2340,#1E4A7A)', color: '#fff' }}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-1">Total Collected · {periodLabel[accountPeriod]}</p>
                  <p className="text-3xl font-bold font-mono">{totalAllAccounts.toLocaleString()}</p>
                  <p className="text-xs opacity-50 mt-0.5">UGX · {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}</p>
                </div>
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {accountTotals.map(account => (
                  <div key={account.key} className="rounded-2xl p-5 flex items-center gap-4"
                    style={{ background: '#f0f0f0', border: '1px solid rgba(0,0,0,.1)' }}>
                    <div className="shrink-0 flex items-center justify-center w-14 h-14 rounded-xl bg-white shadow-sm">
                      <AccountIcon type={account.key as any} size={44} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-500 leading-tight">{account.label}</p>
                      <p className="text-2xl font-black text-gray-900 leading-tight mt-0.5">{account.total.toLocaleString()}</p>
                      <p className="text-xs font-semibold text-gray-400 tracking-wider">UGX</p>
                      {account.count > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          {account.count} payment{account.count !== 1 ? 's' : ''}
                          {totalAllAccounts > 0 && ` · ${Math.round((account.total / totalAllAccounts) * 100)}%`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Search + Filters */}
        <div className="card mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by client name or notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input-field pl-12"
            />
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { value: 'all', label: 'All Time' },
                { value: 'this_week', label: 'This Week' },
                { value: 'last_week', label: 'Last Week' },
                { value: 'last_month', label: 'Last Month' },
                { value: 'custom', label: 'Custom Range' },
              ] as { value: DateFilter; label: string }[]).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDateFilter(value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={
                    dateFilter === value
                      ? { background: '#0C2340', color: '#fff' }
                      : { background: 'rgba(12,35,64,.07)', color: '#0C2340' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Customer filter dropdown */}
            <div className="ml-auto">
              <select
                value={customerFilter}
                onChange={e => setCustomerFilter(e.target.value)}
                className="input-field py-1.5 text-sm"
                style={{ minWidth: '160px' }}
              >
                <option value="">All Customers</option>
                {uniqueCustomers.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom date range inputs */}
          {dateFilter === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">From</label>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="input-field py-1.5 text-sm"
                  style={{ width: '150px' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">To</label>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={e => setCustomTo(e.target.value)}
                  className="input-field py-1.5 text-sm"
                  style={{ width: '150px' }}
                />
              </div>
              {(customFrom || customTo) && (
                <button
                  onClick={() => { setCustomFrom(''); setCustomTo('') }}
                  className="text-xs font-semibold transition-colors"
                  style={{ color: '#6b7280' }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Client table */}
        {loading ? (
          <div className="card text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
            <p className="mt-3 text-gray-500">Loading...</p>
          </div>
        ) : customerGroups.length === 0 ? (
          <div className="card text-center py-14">
            <svg className="w-16 h-16 text-green-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-400">{searchTerm ? 'No clients match your search.' : 'No invoices found.'}</p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Client</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Bills</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Balance (UGX)</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customerGroups.map(customer => {
                  const isCleared = customer.total === 0
                  const clientEntry = clientsMap[customer.name.toLowerCase()]
                  return (
                    <tr
                      key={customer.name}
                      onClick={() => router.push(`/employee/unpaid-balance/${nameToSlug(customer.name)}`)}
                      className={`cursor-pointer transition-colors hover:bg-amber-50/60 ${isCleared ? 'opacity-60' : ''}`}
                    >
                      {/* Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-xs ${isCleared ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}>
                            {getInitials(customer.name)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{customer.name}</p>
                            {clientEntry && (
                              <p className="text-xs text-gray-400 mt-0.5">Registered client</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Bills count */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm text-gray-600 font-medium">{customer.bills.length}</span>
                      </td>

                      {/* Balance */}
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-bold font-mono text-sm ${isCleared ? 'text-green-600' : 'text-amber-600'}`}>
                          {isCleared ? '0' : customer.total.toLocaleString()}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3.5 text-center">
                        {isCleared ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            Cleared
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                            Owing
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {!isCleared && (
                            <button
                              onClick={(e) => openPaymentModal(customer, e)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                              style={{ background: 'rgba(16,185,129,.1)', color: '#059669', border: '1px solid rgba(16,185,129,.3)' }}
                            >
                              Pay
                            </button>
                          )}
                          {clientEntry && (
                            <button
                              onClick={() => router.push(`/employee/clients/${clientSlug(clientEntry)}`)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 whitespace-nowrap"
                              style={{ background: 'rgba(12,35,64,.06)', color: '#0C2340', border: '1px solid rgba(12,35,64,.15)' }}
                            >
                              Profile
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Payment Modal */}
        {payment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-white text-sm shrink-0">
                    {getInitials(payment.customer.name)}
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg leading-tight">Record Payment</h2>
                    <p className="text-sm text-gray-500">{payment.customer.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPayment(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Outstanding balance banner */}
              <div className="mx-6 mb-5 rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.22)' }}>
                <div>
                  <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Outstanding Balance</p>
                  <p className="text-2xl font-bold font-mono text-amber-600 mt-0.5">
                    {payment.customer.total.toLocaleString()} <span className="text-sm font-normal">UGX</span>
                  </p>
                </div>
                <span className="text-xs text-amber-600 opacity-70 text-right">
                  {payment.customer.bills.length} bill{payment.customer.bills.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="px-6 pb-5 space-y-4">

                {/* Date + Mode — side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Date</label>
                    <input
                      type="date"
                      value={payment.date}
                      onChange={e => setPayment(p => p ? { ...p, date: e.target.value } : null)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label">Mode of Payment</label>
                    <select
                      value={payment.payment_mode}
                      onChange={e => setPayment(p => p ? { ...p, payment_mode: e.target.value as PaymentMode | '' } : null)}
                      className="input-field"
                    >
                      <option value="">— Select —</option>
                      <option value="cash">Cash</option>
                      <option value="airtel_money">Airtel Money</option>
                      <option value="mtn_money">MTN Money</option>
                      <option value="visa_card">Visa Card</option>
                      <option value="stanbic">Stanbic</option>
                    </select>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="label">Amount (UGX)</label>
                  <div className="flex gap-2">
                    <CurrencyInput
                      value={payment.amount}
                      onValueChange={v => setPayment(p => p ? { ...p, amount: v } : null)}
                      className="input-field flex-1"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setPayment(p => p ? { ...p, amount: p.customer.total } : null)}
                      className="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
                      style={{ background: 'rgba(16,185,129,.1)', color: '#059669', border: '1px solid rgba(16,185,129,.3)' }}
                    >
                      Pay in Full
                    </button>
                  </div>
                  {payment.amount > 0 && (
                    <p className={`mt-1.5 text-sm font-medium ${payment.amount >= payment.customer.total ? 'text-green-600' : 'text-amber-600'}`}>
                      {payment.amount >= payment.customer.total
                        ? 'Balance will be fully cleared'
                        : `Remaining: ${(payment.customer.total - payment.amount).toLocaleString()} UGX`}
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={payment.notes}
                    onChange={e => setPayment(p => p ? { ...p, notes: e.target.value } : null)}
                    placeholder="Any additional remarks..."
                    className="input-field"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setPayment(null)}
                  disabled={payment.submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePaymentSubmit}
                  disabled={payment.submitting || payment.amount <= 0 || !payment.payment_mode}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: '#059669' }}
                >
                  {payment.submitting ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
