'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'
import CurrencyInput from '@/components/CurrencyInput'

type PaymentMode = 'cash' | 'airtel_money' | 'mtn_money' | 'visa_card' | 'stanbic'

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

interface PaymentState {
  date: string
  amount: number
  payment_mode: PaymentMode | ''
  notes: string
  submitting: boolean
}

interface ClientRecord {
  id: string
  phone: string | null
  email: string | null
}

interface PaymentRecord {
  id: string
  customer_name: string
  amount: number
  payment_mode: string | null
  notes: string | null
  paid_at: string
}

type LedgerEntry =
  | { kind: 'bill'; id: string; date: string; notes: string | null; original: number; remaining: number }
  | { kind: 'payment'; id: string; date: string; notes: string | null; amount: number; payment_mode: string | null }

const MODE_LABELS: Record<string, string> = {
  cash: 'Cash', airtel_money: 'Airtel Money', mtn_money: 'MTN Money',
  visa_card: 'Visa Card', stanbic: 'Stanbic',
}

function nameToSlug(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function clientPhoneSlug(phone: string | null, id: string) {
  return phone ? phone.replace(/[^0-9]/g, '') : id
}

type DateFilter = 'all' | 'this_week' | 'last_week' | 'last_month' | 'custom'

export default function UnpaidBalanceDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { selectedOrg } = useOrganization()
  const { profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [bills, setBills] = useState<UnpaidBillRow[]>([])
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [clientRecord, setClientRecord] = useState<ClientRecord | null>(null)
  const [payment, setPayment] = useState<PaymentState | null>(null)
  const [allCustomers, setAllCustomers] = useState<{ name: string; total: number }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [payments, setPayments] = useState<PaymentRecord[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      const orgId = selectedOrg?.id || profile?.organization_id || null

      let query = supabase
        .from('unpaid_bills')
        .select(`*, daily_reports!inner(report_date, organization_id)`)
        .order('created_at', { ascending: false })

      if (orgId) query = query.eq('daily_reports.organization_id', orgId)

      const { data, error } = await query
      if (error) throw error

      const allBills: UnpaidBillRow[] = data || []

      // Build customer list for search
      const grouped = allBills.reduce((acc, b) => {
        const key = b.customer_name.toLowerCase()
        if (!acc[key]) acc[key] = { name: b.customer_name, total: 0 }
        acc[key].total += Number(b.amount)
        return acc
      }, {} as Record<string, { name: string; total: number }>)
      setAllCustomers(Object.values(grouped).sort((a, b) => b.total - a.total))

      // Find the customer whose name slug matches the URL slug
      const match = allBills.find(b => nameToSlug(b.customer_name) === slug)
      if (!match) {
        setLoading(false)
        return
      }

      const name = match.customer_name
      setCustomerName(name)
      setBills(allBills.filter(b => b.customer_name.toLowerCase() === name.toLowerCase()))

      // Look up client record
      let clientQuery = supabase
        .from('clients')
        .select('id, phone_number, email')
        .ilike('name', name)
        .limit(1)
      if (orgId) clientQuery = clientQuery.eq('organization_id', orgId)
      const { data: clientData } = await clientQuery
      if (clientData && clientData.length > 0) {
        setClientRecord({ id: clientData[0].id, phone: clientData[0].phone_number, email: clientData[0].email })
      }

      // Fetch payment history for this customer
      // Include rows belonging to this org OR rows with no org set (legacy records before org_id was required)
      let payQuery = supabase
        .from('bill_payments')
        .select('*')
        .ilike('customer_name', name)
        .order('paid_at', { ascending: false })
      if (orgId) payQuery = payQuery.or(`organization_id.eq.${orgId},organization_id.is.null`)
      const { data: payData } = await payQuery
      setPayments(payData || [])
    } catch (err) {
      console.error('Error loading client bills:', err)
      toast.error('Failed to load bill details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setSearchQuery('')
    setSearchOpen(false)
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, selectedOrg?.id, profile?.organization_id])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const total = bills.reduce((s, b) => s + Number(b.amount), 0)
  const isCleared = total === 0
  const totalCollected = bills.reduce((s, b) => s + Math.max(0, Number(b.original_amount || 0) - Number(b.amount)), 0)

  const ledger: LedgerEntry[] = [
    ...bills.map(b => ({
      kind: 'bill' as const,
      id: b.id,
      date: b.daily_reports.report_date,
      notes: b.notes,
      original: Number(b.original_amount) || Number(b.amount),
      remaining: Number(b.amount),
    })),
    ...payments.map(p => ({
      kind: 'payment' as const,
      id: p.id,
      date: p.paid_at,
      notes: p.notes,
      amount: Number(p.amount),
      payment_mode: p.payment_mode,
    })),
  ]

  const filteredLedger: LedgerEntry[] = (() => {
    if (dateFilter === 'all') return ledger
    let from: Date, to: Date
    const today = new Date()
    if (dateFilter === 'this_week') {
      from = startOfWeek(today, { weekStartsOn: 1 })
      to = endOfWeek(today, { weekStartsOn: 1 })
    } else if (dateFilter === 'last_week') {
      const prev = subWeeks(today, 1)
      from = startOfWeek(prev, { weekStartsOn: 1 })
      to = endOfWeek(prev, { weekStartsOn: 1 })
    } else if (dateFilter === 'last_month') {
      const prev = subMonths(today, 1)
      from = startOfMonth(prev)
      to = endOfMonth(prev)
    } else {
      if (!customFrom || !customTo) return ledger
      from = new Date(customFrom)
      to = new Date(customTo + 'T23:59:59')
    }
    return ledger.filter(e => {
      const d = new Date(e.date)
      return d >= from && d <= to
    })
  })()

  const filteredLedgerBilled = filteredLedger
    .filter((e): e is Extract<LedgerEntry, { kind: 'bill' }> => e.kind === 'bill')
    .reduce((s, e) => s + e.original, 0)
  const filteredLedgerPaid = filteredLedger
    .filter((e): e is Extract<LedgerEntry, { kind: 'payment' }> => e.kind === 'payment')
    .reduce((s, e) => s + e.amount, 0)

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const searchResults = searchQuery.trim().length > 0
    ? allCustomers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        nameToSlug(c.name) !== slug
      )
    : allCustomers.filter(c => nameToSlug(c.name) !== slug)

  const exportPDF = () => {
    if (!customerName) return
    const filterLabel: Record<DateFilter, string> = {
      all: 'All Time', this_week: 'This Week', last_week: 'Last Week',
      last_month: 'Last Month', custom: customFrom && customTo ? `${customFrom} – ${customTo}` : 'Custom',
    }
    const rows = [...filteredLedger]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(entry => {
        if (entry.kind === 'bill') {
          return `<tr>
            <td>${format(new Date(entry.date), 'MMM dd, yyyy')}</td>
            <td>${entry.notes || '—'}</td>
            <td style="text-align:right;font-weight:600">${entry.original.toLocaleString()}</td>
            <td style="text-align:right;color:#999">—</td>
            <td style="text-align:center"><span style="padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#fef3c7;color:#92400e">Bill</span></td>
          </tr>`
        } else {
          const modeLabel = entry.payment_mode ? (MODE_LABELS[entry.payment_mode] ?? entry.payment_mode) : ''
          const desc = entry.notes ? `${entry.notes}${modeLabel ? ` · ${modeLabel}` : ''}` : (modeLabel || '—')
          return `<tr style="background:#f0fdf4">
            <td>${format(new Date(entry.date), 'MMM dd, yyyy')}</td>
            <td>${desc}</td>
            <td style="text-align:right;color:#999">—</td>
            <td style="text-align:right;color:#16a34a;font-weight:700">${entry.amount.toLocaleString()}</td>
            <td style="text-align:center"><span style="padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#dcfce7;color:#166534">Payment</span></td>
          </tr>`
        }
      }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Bill Statement – ${customerName}</title>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#111;padding:40px;max-width:860px;margin:0 auto}
  h1{font-size:22px;color:#0C2340;margin-bottom:4px;font-weight:700}
  .sub{font-size:11px;color:#666;margin-bottom:4px}
  .period{display:inline-block;font-size:11px;font-weight:700;color:#0C2340;background:#f0f4ff;border:1px solid #c7d7f5;border-radius:6px;padding:2px 10px;margin-bottom:20px}
  .cards{display:flex;gap:14px;margin-bottom:24px;flex-wrap:wrap}
  .card{background:#f8faff;border-radius:8px;padding:12px 18px;min-width:130px;border:1px solid #e2e8f0}
  .card-label{font-size:10px;color:#666;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em}
  .card-val{font-size:19px;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;padding:8px 10px;background:#0C2340;color:#fff;font-size:11px;font-weight:600}
  td{padding:8px 10px;border-bottom:1px solid #eee}
  tr:last-child td{border-bottom:none}
  tfoot td{background:#f1f5f9;font-weight:700;border-top:2px solid #e2e8f0}
  .footer{margin-top:28px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px;text-align:center}
  .print-btn{display:inline-flex;align-items:center;gap:8px;margin-bottom:20px;padding:9px 20px;background:#0C2340;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  .print-btn:hover{background:#1E4A7A}
  @media print{.print-btn{display:none!important}body{padding:20px}@page{margin:15mm}}
</style></head>
<body>
<button class="print-btn" onclick="window.print()">&#128438; Save as PDF / Print</button>
<h1>Bill Statement – ${customerName}</h1>
<div class="sub">SEIV Point of Sale &nbsp;·&nbsp; Generated ${format(new Date(), 'MMM dd, yyyy')}</div>
<div class="period">Period: ${filterLabel[dateFilter]}</div>
<div class="cards">
  <div class="card"><div class="card-label">Total Billed</div><div class="card-val" style="color:#0C2340">${filteredLedgerBilled.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Total Paid</div><div class="card-val" style="color:#2563eb">${filteredLedgerPaid.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Outstanding</div><div class="card-val" style="color:${isCleared ? '#16a34a' : '#b45309'}">${total.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Status</div><div class="card-val" style="color:${isCleared ? '#16a34a' : '#b45309'}">${isCleared ? 'CLEARED' : 'OWING'}</div></div>
</div>
<table>
  <thead><tr><th>Date</th><th>Description</th><th style="text-align:right">Billed (UGX)</th><th style="text-align:right">Paid (UGX)</th><th style="text-align:center">Type</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <td colspan="2">Totals</td>
    <td style="text-align:right">${filteredLedgerBilled.toLocaleString()}</td>
    <td style="text-align:right;color:#16a34a">${filteredLedgerPaid > 0 ? filteredLedgerPaid.toLocaleString() : '—'}</td>
    <td></td>
  </tr></tfoot>
</table>
<div class="footer">SEIV &nbsp;·&nbsp; This is a system-generated statement.</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});</script>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'width=960,height=720')
    if (!win) { toast.error('Allow popups to export PDF'); URL.revokeObjectURL(url); return }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const handlePaymentSubmit = async () => {
    if (!payment || !customerName) return
    const amt = payment.amount
    if (!amt || amt <= 0) { toast.error('Enter a valid payment amount'); return }
    if (!payment.payment_mode) { toast.error('Please select a payment mode'); return }
    if (amt > total) { toast.error('Payment exceeds total balance'); return }

    setPayment(p => p ? { ...p, submitting: true } : null)

    try {
      const sorted = [...bills].sort(
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

      // Record the payment transaction
      const orgId = selectedOrg?.id || profile?.organization_id || null
      await supabase.from('bill_payments').insert({
        organization_id: orgId,
        customer_name: customerName,
        amount: amt,
        payment_mode: payment.payment_mode,
        notes: payment.notes || null,
        paid_at: payment.date,
      })

      fetch('/api/email/payment-cleared', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: customerName,
          amountPaid: amt,
          remainingBalance: Math.max(0, total - amt),
          paymentMode: payment.payment_mode,
          date: payment.date,
        }),
      }).catch(() => {})

      const isFullPayment = amt >= total
      toast.success(isFullPayment ? `${customerName}'s balance fully cleared` : `Payment of UGX ${amt.toLocaleString()} recorded`)
      setPayment(null)
      await fetchData()
    } catch (err) {
      console.error('Payment error:', err)
      toast.error('Failed to record payment')
      setPayment(p => p ? { ...p, submitting: false } : null)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['employee']}>
      <DashboardLayout>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : !customerName ? (
          <div className="card text-center py-16">
            <p className="text-gray-400 mb-4">Client not found.</p>
            <button onClick={() => router.back()} className="btn-secondary text-sm">Go back</button>
          </div>
        ) : (
          <>
            {/* Client search */}
            <div ref={searchRef} className="relative mb-6">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Jump to another client..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }}
                  onFocus={() => setSearchOpen(true)}
                  className="input-field pl-11 pr-4"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setSearchOpen(false) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {searchOpen && searchResults.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                  {searchResults.map(c => {
                    const cleared = c.total === 0
                    return (
                      <button
                        key={c.name}
                        onMouseDown={() => {
                          router.push(`/employee/unpaid-balance/${nameToSlug(c.name)}`)
                          setSearchQuery('')
                          setSearchOpen(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50/70 transition-colors text-left border-b border-gray-50 last:border-0"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-xs ${cleared ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}>
                          {getInitials(c.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {cleared ? (
                            <span className="text-xs font-semibold text-green-600">Cleared</span>
                          ) : (
                            <span className="text-xs font-semibold font-mono text-amber-600">{c.total.toLocaleString()} UGX</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {searchOpen && searchQuery.trim().length > 0 && searchResults.length === 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white rounded-xl border border-gray-200 shadow-xl px-4 py-4 text-sm text-gray-400 text-center">
                  No clients match &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>

            {/* Back + header */}
            <div className="mb-6">
              <button
                onClick={() => router.push('/employee/unpaid-balance')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Client Balances
              </button>

              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-white text-lg shrink-0 ${isCleared ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}>
                  {getInitials(customerName)}
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900">{customerName}</h1>
                  <p className="text-gray-400 text-sm mt-0.5">
                    {bills.length} bill{bills.length !== 1 ? 's' : ''}{clientRecord ? ' · Registered client' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {clientRecord && (
                    <button
                      onClick={() => router.push(`/employee/clients/${clientPhoneSlug(clientRecord.phone, clientRecord.id)}`)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                      style={{ background: 'rgba(12,35,64,.07)', color: '#0C2340', border: '1px solid rgba(12,35,64,.15)' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Full Profile
                    </button>
                  )}
                  <button
                    onClick={exportPDF}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                    style={{ background: 'rgba(12,35,64,.07)', color: '#0C2340', border: '1px solid rgba(12,35,64,.15)' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    Export PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div
                className="rounded-2xl px-6 py-5 flex items-center justify-between"
                style={isCleared
                  ? { background: 'rgba(16,185,129,.07)', border: '1px solid rgba(16,185,129,.22)' }
                  : { background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.22)' }}
              >
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${isCleared ? 'text-green-700' : 'text-amber-700'}`}>
                    {isCleared ? 'Balance Cleared' : 'Outstanding Balance'}
                  </p>
                  <p className={`text-3xl font-bold font-mono ${isCleared ? 'text-green-600' : 'text-amber-600'}`}>
                    UGX {total.toLocaleString()}
                  </p>
                </div>
                {isCleared ? (
                  <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <button
                    onClick={() => setPayment({ date: format(new Date(), 'yyyy-MM-dd'), amount: 0, payment_mode: '', notes: '', submitting: false })}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{ background: '#059669' }}
                  >
                    Record Payment
                  </button>
                )}
              </div>
              <div
                className="rounded-2xl px-6 py-5"
                style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-blue-700">Total Collected</p>
                <p className="text-3xl font-bold font-mono text-blue-600">UGX {totalCollected.toLocaleString()}</p>
                <p className="text-xs mt-1 text-blue-600 opacity-60">paid by this client</p>
              </div>
            </div>

            {/* Date filter */}
            <div className="mb-4">
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { value: 'all', label: 'All Time' },
                  { value: 'this_week', label: 'This Week' },
                  { value: 'last_week', label: 'Last Week' },
                  { value: 'last_month', label: 'Last Month' },
                  { value: 'custom', label: 'Custom' },
                ] as { value: DateFilter; label: string }[]).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setDateFilter(value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={dateFilter === value
                      ? { background: '#0C2340', color: '#fff' }
                      : { background: 'rgba(12,35,64,.06)', color: '#475569', border: '1px solid rgba(12,35,64,.12)' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    className="input-field"
                  />
                  <span className="text-gray-400 text-sm font-medium">to</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    className="input-field"
                  />
                </div>
              )}
            </div>

            {/* Bills table */}
            <div className="card overflow-hidden p-0">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">
                  Transaction History
                  {dateFilter !== 'all' && (
                    <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                      {filteredLedger.length} of {ledger.length}
                    </span>
                  )}
                </h2>
              </div>
              <table className="min-w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Billed (UGX)</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Paid (UGX)</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLedger.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">No transactions found for this period.</td></tr>
                  ) : [...filteredLedger]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(entry => entry.kind === 'bill' ? (() => {
                      const billCleared = entry.remaining === 0
                      return (
                        <tr key={entry.id} className={billCleared ? 'hover:bg-green-50/40' : 'hover:bg-gray-50/60'}
                          style={billCleared ? { background: 'rgba(240,253,244,.4)' } : {}}>
                          <td className="px-5 py-3.5 text-sm font-medium text-gray-800 whitespace-nowrap">
                            {format(new Date(entry.date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-500">
                            {entry.notes || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right text-sm font-semibold font-mono text-gray-700">
                            {entry.original.toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right text-sm text-gray-300">—</td>
                          <td className="px-4 py-3.5 text-center">
                            {billCleared ? (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Cleared</span>
                            ) : (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Bill</span>
                            )}
                          </td>
                        </tr>
                      )
                    })() : (
                      <tr key={entry.id} className="hover:bg-green-50/40" style={{ background: 'rgba(240,253,244,.5)' }}>
                        <td className="px-5 py-3.5 text-sm font-medium text-gray-800 whitespace-nowrap">
                          {format(new Date(entry.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-500">
                          {entry.notes
                            ? <>{entry.notes}{entry.payment_mode && <span className="ml-1 text-gray-400">· {MODE_LABELS[entry.payment_mode] ?? entry.payment_mode}</span>}</>
                            : <span className="text-gray-400">{entry.payment_mode ? (MODE_LABELS[entry.payment_mode] ?? entry.payment_mode) : '—'}</span>
                          }
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm text-gray-300">—</td>
                        <td className="px-5 py-3.5 text-right text-sm font-semibold font-mono text-green-600">
                          {entry.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Payment</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50">
                    <td colSpan={2} className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wide">Totals</td>
                    <td className="px-5 py-4 text-right font-bold font-mono text-gray-700">
                      {filteredLedgerBilled.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right font-bold font-mono text-green-600">
                      {filteredLedgerPaid > 0 ? filteredLedgerPaid.toLocaleString() : '—'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {!isCleared && (
              <div className="mt-6">
                <button
                  onClick={() => setPayment({ date: format(new Date(), 'yyyy-MM-dd'), amount: 0, payment_mode: '', notes: '', submitting: false })}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: '#059669' }}
                >
                  Record Payment for {customerName}
                </button>
              </div>
            )}
          </>
        )}

        {/* Payment Modal */}
        {payment && customerName && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

              <div className="px-6 pt-6 pb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-white text-sm shrink-0">
                    {getInitials(customerName)}
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg leading-tight">Record Payment</h2>
                    <p className="text-sm text-gray-500">{customerName}</p>
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

              <div className="mx-6 mb-5 rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.22)' }}>
                <div>
                  <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Outstanding Balance</p>
                  <p className="text-2xl font-bold font-mono text-amber-600 mt-0.5">
                    {total.toLocaleString()} <span className="text-sm font-normal">UGX</span>
                  </p>
                </div>
                <span className="text-xs text-amber-600 opacity-70">
                  {bills.filter(b => Number(b.amount) > 0).length} bill{bills.filter(b => Number(b.amount) > 0).length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="px-6 pb-5 space-y-4">
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
                      onClick={() => setPayment(p => p ? { ...p, amount: total } : null)}
                      className="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
                      style={{ background: 'rgba(16,185,129,.1)', color: '#059669', border: '1px solid rgba(16,185,129,.3)' }}
                    >
                      Pay in Full
                    </button>
                  </div>
                  {payment.amount > 0 && (
                    <p className={`mt-1.5 text-sm font-medium ${payment.amount >= total ? 'text-green-600' : 'text-amber-600'}`}>
                      {payment.amount >= total
                        ? 'Balance will be fully cleared'
                        : `Remaining: UGX ${(total - payment.amount).toLocaleString()}`}
                    </p>
                  )}
                </div>

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
