'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'
import CurrencyInput from '@/components/CurrencyInput'

type PaymentMode = 'cash' | 'airtel_money' | 'mtn_money' | 'visa_card' | 'stanbic'

const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: 'Cash',
  airtel_money: 'Airtel Money',
  mtn_money: 'MTN Money',
  visa_card: 'Visa Card',
  stanbic: 'Stanbic',
}

interface ClientRow {
  id: string
  name: string
  phone_number: string | null
  email: string | null
  notes: string | null
  created_at: string
}

interface BillRow {
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

// Derive slug from a phone number: "+256700000000" → "256700000000"
function phoneToSlug(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

type DateFilter = 'all' | 'this_week' | 'last_week' | 'last_month' | 'custom'

export default function EmployeeClientDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const supabase = createClient()
  const { selectedOrg } = useOrganization()
  const { profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<ClientRow | null>(null)
  const [bills, setBills] = useState<BillRow[]>([])
  const [payment, setPayment] = useState<PaymentState | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      // Slug is the phone number with + stripped.
      // Fall back to UUID lookup for legacy links without a phone.
      const isUUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(slug)
      const query = isUUID
        ? supabase.from('clients').select('id, name, phone_number, email, notes, created_at').eq('id', slug)
        : supabase.from('clients').select('id, name, phone_number, email, notes, created_at').eq('phone_number', '+' + slug)

      const { data: clientData, error: clientError } = await query.single()
      if (clientError) throw clientError
      setClient(clientData)

      const orgId = selectedOrg?.id || profile?.organization_id || null
      let billQuery = supabase
        .from('unpaid_bills')
        .select('*, daily_reports!inner(report_date, organization_id)')
        .ilike('customer_name', clientData.name)
        .order('created_at', { ascending: false })

      if (orgId) billQuery = billQuery.eq('daily_reports.organization_id', orgId)

      const { data: billData, error: billError } = await billQuery
      if (billError) throw billError
      setBills(billData || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load client details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (slug) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, selectedOrg?.id, profile?.organization_id])

  const totalOutstanding = bills.reduce((s, b) => s + Number(b.amount), 0)
  const totalCollected = bills.reduce((s, b) => s + Math.max(0, Number(b.original_amount || 0) - Number(b.amount)), 0)
  const paidCount = bills.filter(b => Number(b.amount) === 0).length
  const owingCount = bills.filter(b => Number(b.amount) > 0).length

  const filteredBills = (() => {
    if (dateFilter === 'all') return bills
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
      if (!customFrom || !customTo) return bills
      from = new Date(customFrom)
      to = new Date(customTo + 'T23:59:59')
    }
    return bills.filter(b => {
      const d = new Date(b.daily_reports.report_date)
      return d >= from && d <= to
    })
  })()
  const filteredOutstanding = filteredBills.reduce((s, b) => s + Number(b.amount), 0)
  const filteredCollected = filteredBills.reduce((s, b) => s + Math.max(0, Number(b.original_amount || 0) - Number(b.amount)), 0)
  const filteredOriginal = filteredBills.reduce((s, b) => s + (Number(b.original_amount) || Number(b.amount)), 0)

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const exportPDF = () => {
    if (!client) return
    const filterLabel: Record<DateFilter, string> = {
      all: 'All Time', this_week: 'This Week', last_week: 'Last Week',
      last_month: 'Last Month', custom: customFrom && customTo ? `${customFrom} – ${customTo}` : 'Custom',
    }
    const rows = filteredBills.map(bill => {
      const remaining = Number(bill.amount)
      const original = Number(bill.original_amount) || remaining
      const amtPaid = original - remaining
      const isFullyPaid = remaining === 0
      return `<tr>
        <td>${format(new Date(bill.daily_reports.report_date), 'MMM dd, yyyy')}</td>
        <td>${bill.notes || '—'}</td>
        <td style="text-align:right">${original.toLocaleString()}</td>
        <td style="text-align:right;color:${amtPaid > 0 ? '#16a34a' : '#999'}">${amtPaid > 0 ? amtPaid.toLocaleString() : '—'}</td>
        <td style="text-align:right;color:${isFullyPaid ? '#16a34a' : '#b45309'};font-weight:600">${isFullyPaid ? '0' : remaining.toLocaleString()}</td>
        <td style="text-align:center"><span style="padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${isFullyPaid ? '#dcfce7' : '#fef3c7'};color:${isFullyPaid ? '#16a34a' : '#92400e'}">${isFullyPaid ? 'Paid' : 'Owing'}</span></td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Bill Statement – ${client.name}</title>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#111;padding:40px;max-width:860px;margin:0 auto}
  h1{font-size:22px;color:#0C2340;margin-bottom:4px;font-weight:700}
  .sub{font-size:11px;color:#666;margin-bottom:4px}
  .meta{font-size:11px;color:#666;margin-bottom:6px}
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
<h1>Bill Statement – ${client.name}</h1>
<div class="sub">SEIV Point of Sale &nbsp;·&nbsp; Generated ${format(new Date(), 'MMM dd, yyyy')}</div>
${client.phone_number ? `<div class="meta">Phone: ${client.phone_number}${client.email ? ` &nbsp;·&nbsp; Email: ${client.email}` : ''}</div>` : ''}
<div class="period">Period: ${filterLabel[dateFilter]}</div>
<div class="cards">
  <div class="card"><div class="card-label">Total Billed</div><div class="card-val" style="color:#0C2340">${filteredOriginal.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Total Collected</div><div class="card-val" style="color:#2563eb">${filteredCollected.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Outstanding</div><div class="card-val" style="color:${filteredOutstanding === 0 ? '#16a34a' : '#b45309'}">${filteredOutstanding.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Status</div><div class="card-val" style="color:${filteredOutstanding === 0 ? '#16a34a' : '#b45309'}">${filteredOutstanding === 0 ? 'CLEARED' : 'OWING'}</div></div>
</div>
<table>
  <thead><tr><th>Date</th><th>Notes</th><th style="text-align:right">Original (UGX)</th><th style="text-align:right">Paid (UGX)</th><th style="text-align:right">Remaining (UGX)</th><th style="text-align:center">Status</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <td colspan="2">Totals</td>
    <td style="text-align:right">${filteredOriginal.toLocaleString()}</td>
    <td style="text-align:right;color:#16a34a">${filteredCollected > 0 ? filteredCollected.toLocaleString() : '—'}</td>
    <td style="text-align:right;color:${filteredOutstanding === 0 ? '#16a34a' : '#b45309'}">${filteredOutstanding.toLocaleString()}</td>
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

  const openPaymentModal = () => {
    setPayment({ date: format(new Date(), 'yyyy-MM-dd'), amount: 0, payment_mode: '', notes: '', submitting: false })
  }

  const handlePaymentSubmit = async () => {
    if (!payment || !client) return
    const amt = payment.amount
    if (!amt || amt <= 0) { toast.error('Enter a valid payment amount'); return }
    if (!payment.payment_mode) { toast.error('Please select a payment mode'); return }
    if (amt > totalOutstanding) { toast.error('Payment exceeds total balance'); return }

    setPayment(p => p ? { ...p, submitting: true } : null)
    try {
      const owingBills = bills
        .filter(b => Number(b.amount) > 0)
        .sort((a, b) => new Date(a.daily_reports.report_date).getTime() - new Date(b.daily_reports.report_date).getTime())

      let remaining = amt
      for (const bill of owingBills) {
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

      const isFullPayment = amt >= totalOutstanding

      fetch('/api/email/payment-cleared', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: client.name,
          amountPaid: amt,
          remainingBalance: Math.max(0, totalOutstanding - amt),
          paymentMode: payment.payment_mode,
          date: payment.date,
        }),
      }).catch(() => {})

      toast.success(isFullPayment ? `${client.name}'s balance fully cleared` : `Payment of ${amt.toLocaleString()} UGX recorded`)
      setPayment(null)
      await fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Failed to record payment')
      setPayment(p => p ? { ...p, submitting: false } : null)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['employee']}>
      <DashboardLayout>

        {/* Back */}
        <Link
          href="/employee/unpaid-balance"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Client Balances
        </Link>

        {loading ? (
          <div className="card text-center py-14">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
            <p className="mt-3 text-gray-500">Loading...</p>
          </div>
        ) : !client ? (
          <div className="card text-center py-14">
            <p className="text-gray-400">Client not found.</p>
          </div>
        ) : (
          <>
            {/* Client profile card */}
            <div className="card mb-6">
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-white text-xl shrink-0">
                  {getInitials(client.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight">{client.name}</h1>
                  {client.phone_number && (
                    <a
                      href={`tel:${client.phone_number}`}
                      className="inline-flex items-center gap-1.5 mt-1 text-sm text-blue-600 hover:underline"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {client.phone_number}
                    </a>
                  )}
                  {client.notes && (
                    <p className="mt-2 text-sm text-gray-500">{client.notes}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    Client since {format(new Date(client.created_at), 'MMMM dd, yyyy')}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
                  {totalOutstanding > 0 && (
                    <button
                      onClick={openPaymentModal}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                      style={{ background: '#059669' }}
                    >
                      Record Payment
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="card" style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.25)' }}>
                <p className="text-sm" style={{ color: '#92400e' }}>Outstanding Balance</p>
                <p className="text-3xl font-bold font-mono" style={{ color: '#b45309' }}>
                  {totalOutstanding.toLocaleString()}
                </p>
                <p className="text-xs mt-1" style={{ color: '#b45309', opacity: 0.6 }}>UGX</p>
              </div>
              <div className="card" style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)' }}>
                <p className="text-sm" style={{ color: '#1e40af' }}>Total Collected</p>
                <p className="text-3xl font-bold font-mono" style={{ color: '#2563eb' }}>{totalCollected.toLocaleString()}</p>
                <p className="text-xs mt-1" style={{ color: '#2563eb', opacity: 0.6 }}>UGX paid</p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500">Bills Owing</p>
                <p className="text-3xl font-bold text-gray-900">{owingCount}</p>
              </div>
              <div className="card" style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)' }}>
                <p className="text-sm" style={{ color: '#065f46' }}>Bills Cleared</p>
                <p className="text-3xl font-bold" style={{ color: '#059669' }}>{paidCount}</p>
              </div>
            </div>

            {/* Bills table */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Unpaid Bill History
                  {dateFilter !== 'all' && (
                    <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                      {filteredBills.length} of {bills.length}
                    </span>
                  )}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
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
                <div className="flex items-center gap-2 mb-4">
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

              {bills.length === 0 ? (
                <div className="text-center py-10">
                  <svg className="w-12 h-12 text-green-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-400">No unpaid bills found for this client.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                        <th className="text-left pb-3 font-semibold">Date</th>
                        <th className="text-left pb-3 font-semibold">Notes</th>
                        <th className="text-right pb-3 font-semibold">Original (UGX)</th>
                        <th className="text-right pb-3 font-semibold">Paid (UGX)</th>
                        <th className="text-right pb-3 font-semibold">Remaining (UGX)</th>
                        <th className="text-right pb-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredBills.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">No bills found for this period.</td></tr>
                      ) : filteredBills.map(bill => {
                        const remaining = Number(bill.amount)
                        const original = Number(bill.original_amount) || remaining
                        const amtPaid = original - remaining
                        const isFullyPaid = remaining === 0
                        return (
                          <tr key={bill.id} className={isFullyPaid ? 'opacity-70' : ''}>
                            <td className="py-3 text-gray-700 whitespace-nowrap">
                              {format(new Date(bill.daily_reports.report_date), 'MMM dd, yyyy')}
                            </td>
                            <td className="py-3 text-gray-500 max-w-xs truncate">
                              {bill.notes || <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-3 text-right font-mono font-semibold text-gray-700">
                              {original.toLocaleString()}
                            </td>
                            <td className="py-3 text-right font-mono font-semibold text-green-600">
                              {amtPaid > 0 ? amtPaid.toLocaleString() : <span className="text-gray-300">—</span>}
                            </td>
                            <td className={`py-3 text-right font-mono font-semibold ${isFullyPaid ? 'text-green-600' : 'text-amber-600'}`}>
                              {isFullyPaid ? '0' : remaining.toLocaleString()}
                            </td>
                            <td className="py-3 text-right">
                              {isFullyPaid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                  ✓ Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                  Owing
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {filteredBills.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-gray-200">
                          <td colSpan={2} className="pt-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Totals</td>
                          <td className="pt-4 text-right font-bold font-mono text-gray-700">
                            {filteredOriginal.toLocaleString()}
                          </td>
                          <td className="pt-4 text-right font-bold font-mono text-green-600">
                            {filteredCollected > 0 ? filteredCollected.toLocaleString() : '—'}
                          </td>
                          <td colSpan={2} className="pt-4 text-right font-bold font-mono text-base">
                            {filteredOutstanding > 0 ? (
                              <span className="text-amber-700">{filteredOutstanding.toLocaleString()} UGX</span>
                            ) : (
                              <span className="text-green-600">Fully Cleared</span>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {totalOutstanding > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <button
                    onClick={openPaymentModal}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{ background: '#059669' }}
                  >
                    Record Payment for {client.name}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Payment Modal */}
        {payment && client && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-white text-sm shrink-0">
                    {getInitials(client.name)}
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg leading-tight">Record Payment</h2>
                    <p className="text-sm text-gray-500">{client.name}</p>
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
                    {totalOutstanding.toLocaleString()} <span className="text-sm font-normal">UGX</span>
                  </p>
                </div>
                <span className="text-xs text-amber-600 opacity-70">
                  {owingCount} bill{owingCount !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="px-6 pb-5 space-y-4">
                {/* Date + Mode */}
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
                      {(Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map(k => (
                        <option key={k} value={k}>{PAYMENT_MODE_LABELS[k]}</option>
                      ))}
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
                      onClick={() => setPayment(p => p ? { ...p, amount: totalOutstanding } : null)}
                      className="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
                      style={{ background: 'rgba(16,185,129,.1)', color: '#059669', border: '1px solid rgba(16,185,129,.3)' }}
                    >
                      Pay in Full
                    </button>
                  </div>
                  {payment.amount > 0 && (
                    <p className={`mt-1.5 text-sm font-medium ${payment.amount >= totalOutstanding ? 'text-green-600' : 'text-amber-600'}`}>
                      {payment.amount >= totalOutstanding
                        ? 'Balance will be fully cleared'
                        : `Remaining: ${(totalOutstanding - payment.amount).toLocaleString()} UGX`}
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
