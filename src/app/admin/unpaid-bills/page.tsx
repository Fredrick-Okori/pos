'use client'

import { useState, useEffect, Fragment } from 'react'
import { createClient } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import { AccountIcon } from '@/lib/accounts'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import Money, { MoneyToggle } from '@/components/Money'

interface UnpaidBillWithDetails {
  id: string
  customer_name: string
  amount: number
  original_amount: number
  notes: string | null
  created_at: string
  daily_reports: {
    report_date: string
    organization_id: string | null
    profiles: { full_name: string } | null
  }
}

interface PaymentRecord {
  id: string
  customer_name: string
  amount: number
  payment_mode: string | null
  notes: string | null
  paid_at: string
  organization_id: string | null
}

type AccountPeriod = 'all' | 'this_month' | 'last_month' | 'custom'

const ACCOUNT_MODES: { key: string; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'airtel_money', label: 'Airtel Money' },
  { key: 'mtn_money', label: 'MTN Money' },
  { key: 'visa_card', label: 'Visa Card' },
]

function nameToSlug(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}


export default function AdminUnpaidBills() {
  const supabase = createClient()
  const { selectedOrg } = useOrganization()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [bills, setBills] = useState<UnpaidBillWithDetails[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())

  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [accountPeriod, setAccountPeriod] = useState<AccountPeriod>('all')
  const [accountCustomFrom, setAccountCustomFrom] = useState('')
  const [accountCustomTo, setAccountCustomTo] = useState('')

  // Period filter for bills (by report date)
  const [billsPeriod, setBillsPeriod] = useState<AccountPeriod>('all')
  const [billsCustomFrom, setBillsCustomFrom] = useState('')
  const [billsCustomTo, setBillsCustomTo] = useState('')

  const MODE_LABELS: Record<string, string> = {
    cash: 'Cash', airtel_money: 'Airtel Money', mtn_money: 'MTN Money',
    visa_card: 'Visa Card', stanbic: 'Stanbic',
  }

  const fetchUnpaidBills = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('unpaid_bills')
        .select(`
          *,
          daily_reports!inner (
            report_date,
            organization_id,
            profiles!user_id (full_name)
          )
        `)
        .order('created_at', { ascending: false })

      if (selectedOrg) query = query.eq('daily_reports.organization_id', selectedOrg.id)

      const { data, error } = await query
      if (error) throw error
      setBills(data || [])
    } catch (error) {
      console.error('Error fetching unpaid bills:', error)
      toast.error('Failed to fetch unpaid bills')
    } finally {
      setLoading(false)
    }
  }

  const fetchPayments = async () => {
    setLoadingPayments(true)
    try {
      let query = supabase
        .from('bill_payments')
        .select('*')
        .order('paid_at', { ascending: false })

      if (selectedOrg) query = query.eq('organization_id', selectedOrg.id)

      const { data, error } = await query
      if (error) throw error
      setPayments(data || [])
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoadingPayments(false)
    }
  }

  useEffect(() => {
    if (!selectedOrg) return
    fetchUnpaidBills()
    fetchPayments()
  }, [selectedOrg?.id])

  // Only count payments for customers who still have invoice records in the system.
  // If a report is deleted (removing its unpaid_bills), payments for customers whose
  // only bills came from that report are excluded from the account totals.
  const activeCustomerNames = new Set(bills.map(b => b.customer_name.toLowerCase()))

  // Filter payments by active customers + period
  const filteredPayments = payments.filter(p => {
    if (!activeCustomerNames.has((p.customer_name || '').toLowerCase())) return false
    if (accountPeriod === 'all') return true
    const today = new Date()
    let from: Date, to: Date
    if (accountPeriod === 'this_month') {
      from = startOfMonth(today)
      to = endOfMonth(today)
    } else if (accountPeriod === 'last_month') {
      const last = subMonths(today, 1)
      from = startOfMonth(last)
      to = endOfMonth(last)
    } else {
      // custom range
      if (!accountCustomFrom && !accountCustomTo) return true
      const d = new Date(p.paid_at)
      if (accountCustomFrom && d < new Date(accountCustomFrom)) return false
      if (accountCustomTo && d > new Date(accountCustomTo)) return false
      return true
    }
    const d = new Date(p.paid_at)
    return d >= from && d <= to
  })

  // Aggregate by payment mode
  const accountTotals = ACCOUNT_MODES.map(mode => {
    const modePayments = filteredPayments.filter(p => p.payment_mode === mode.key)
    return {
      ...mode,
      total: modePayments.reduce((s, p) => s + Number(p.amount), 0),
      count: modePayments.length,
    }
  })

  const totalAllAccounts = accountTotals.reduce((s, a) => s + a.total, 0)

  const periodFilteredBills = bills.filter(bill => {
    if (billsPeriod === 'all') return true
    const today = new Date()
    const reportDate = new Date(bill.daily_reports.report_date)
    if (billsPeriod === 'this_month') {
      return reportDate >= startOfMonth(today) && reportDate <= endOfMonth(today)
    } else if (billsPeriod === 'last_month') {
      const last = subMonths(today, 1)
      return reportDate >= startOfMonth(last) && reportDate <= endOfMonth(last)
    } else {
      if (billsCustomFrom && reportDate < new Date(billsCustomFrom)) return false
      if (billsCustomTo && reportDate > new Date(billsCustomTo + 'T23:59:59')) return false
      return true
    }
  })

  const filteredBills = periodFilteredBills.filter(bill =>
    bill.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalUnpaid = filteredBills.reduce((sum, bill) => sum + Number(bill.amount), 0)

  const customerGroups = Object.values(
    filteredBills.reduce((acc, bill) => {
      const key = bill.customer_name.toLowerCase()
      if (!acc[key]) acc[key] = { name: bill.customer_name, bills: [], total: 0 }
      acc[key].bills.push(bill)
      acc[key].total += Number(bill.amount)
      return acc
    }, {} as Record<string, { name: string; bills: UnpaidBillWithDetails[]; total: number }>)
  ).sort((a, b) => {
    if (a.total === 0 && b.total > 0) return 1
    if (a.total > 0 && b.total === 0) return -1
    return b.total - a.total
  })

  const owingCount = customerGroups.filter(c => c.total > 0).length
  const clearedCount = customerGroups.filter(c => c.total === 0).length
  const partialCount = customerGroups.filter(c =>
    c.total > 0 && c.bills.some(b => Number(b.original_amount) > Number(b.amount))
  ).length
  const totalCollected = filteredBills.reduce((s, b) => s + Math.max(0, Number(b.original_amount || 0) - Number(b.amount)), 0)

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

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

  const billsCustomRangeLabel =
    billsCustomFrom && billsCustomTo
      ? `${billsCustomFrom} – ${billsCustomTo}`
      : billsCustomFrom
      ? `From ${billsCustomFrom}`
      : billsCustomTo
      ? `Until ${billsCustomTo}`
      : 'Custom Range'

  const billsPeriodLabel: Record<AccountPeriod, string> = {
    all: 'All Time',
    this_month: format(new Date(), 'MMMM yyyy'),
    last_month: format(subMonths(new Date(), 1), 'MMMM yyyy'),
    custom: billsCustomRangeLabel,
  }

  const exportPDF = () => {
    const date = new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })
    const rows = customerGroups.map(c => {
      const isCleared = c.total === 0
      const isPartial = !isCleared && c.bills.some(b => Number(b.original_amount) > Number(b.amount))
      const statusLabel = isCleared ? 'Cleared' : isPartial ? 'Partial' : 'Owing'
      const statusColor = isCleared ? '#059669' : isPartial ? '#7c3aed' : '#d97706'
      return `<tr>
        <td>${c.name}</td>
        <td style="text-align:center">${c.bills.length}</td>
        <td style="text-align:right;font-weight:700;color:${isCleared ? '#059669' : '#d97706'}">${isCleared ? '0' : c.total.toLocaleString()}</td>
        <td style="text-align:center;font-size:10px;font-weight:700;color:${statusColor}">${statusLabel}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Invoices – ${selectedOrg?.name ?? 'Finance'}</title>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#111;padding:32px;max-width:900px;margin:0 auto}
  h1{font-size:22px;color:#0C2340;margin-bottom:4px;font-weight:700}
  .sub{font-size:11px;color:#666;margin-bottom:20px}
  .cards{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}
  .card{background:#f4f8ff;border-radius:8px;padding:10px 16px;min-width:140px;border:1px solid #e2e8f0}
  .card-label{font-size:9px;color:#666;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em}
  .card-val{font-size:18px;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{text-align:left;padding:7px 8px;background:#0C2340;color:#fff;font-size:10px;font-weight:600}
  th.r{text-align:right}th.c{text-align:center}
  td{padding:6px 8px;border-bottom:1px solid #eee}
  tr:last-child td{border-bottom:none}
  tr:nth-child(even) td{background:#fafafa}
  .footer{margin-top:24px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px;text-align:center}
  .print-btn{display:inline-flex;align-items:center;gap:8px;margin-bottom:20px;padding:9px 20px;background:#0C2340;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  @media print{.print-btn{display:none!important}body{padding:12px}@page{margin:10mm}}
</style></head>
<body>
<button class="print-btn" onclick="window.print()">&#128438; Save as PDF / Print</button>
<h1>Invoices — ${selectedOrg?.name ?? 'Finance'}</h1>
<div class="sub">Outstanding Client Balances &middot; ${billsPeriodLabel[billsPeriod]} &middot; Generated ${date}</div>
<div class="cards">
  <div class="card"><div class="card-label">Total Outstanding</div><div class="card-val" style="color:#b45309">${totalUnpaid.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Clients Owing</div><div class="card-val">${owingCount}</div></div>
  <div class="card"><div class="card-label">Clients Cleared</div><div class="card-val" style="color:#059669">${clearedCount}</div></div>
  <div class="card"><div class="card-label">Partially Cleared</div><div class="card-val" style="color:#7c3aed">${partialCount}</div></div>
  <div class="card"><div class="card-label">Total Collected</div><div class="card-val" style="color:#2563eb">${totalCollected.toLocaleString()} UGX</div></div>
</div>
<table>
  <thead>
    <tr><th>Client</th><th class="c">Bills</th><th class="r">Balance (UGX)</th><th class="c">Status</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">${selectedOrg?.name ?? 'Finance'} &middot; This is a system-generated report.</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});</script>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'width=900,height=700')
    if (!win) { toast.error('Allow popups to export PDF'); URL.revokeObjectURL(url); return }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  return (
    <ProtectedRoute allowedRoles={['superadmin', 'manager']}>
      <DashboardLayout>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
            <p className="text-gray-500">Track and manage all outstanding client balances</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: '#0C2340', color: '#fff' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export PDF
            </button>
            <MoneyToggle />
          </div>
        </div>

        {/* Summary stats */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Outstanding Balances · {billsPeriodLabel[billsPeriod]}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'this_month', 'last_month', 'custom'] as AccountPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setBillsPeriod(p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={billsPeriod === p
                    ? { background: '#0C2340', color: '#fff' }
                    : { background: 'rgba(12,35,64,.06)', color: '#475569', border: '1px solid rgba(12,35,64,.12)' }
                  }
                >
                  {p === 'all' ? 'All Time' : p === 'this_month' ? 'This Month' : p === 'last_month' ? 'Last Month' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {billsPeriod === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 mb-3 p-3 rounded-xl" style={{ background: 'rgba(12,35,64,.04)', border: '1px solid rgba(12,35,64,.1)' }}>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">From</label>
                <input
                  type="date"
                  value={billsCustomFrom}
                  max={billsCustomTo || undefined}
                  onChange={e => setBillsCustomFrom(e.target.value)}
                  className="input-field py-1.5 text-sm"
                  style={{ width: '150px' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">To</label>
                <input
                  type="date"
                  value={billsCustomTo}
                  min={billsCustomFrom || undefined}
                  onChange={e => setBillsCustomTo(e.target.value)}
                  className="input-field py-1.5 text-sm"
                  style={{ width: '150px' }}
                />
              </div>
              {(billsCustomFrom || billsCustomTo) && (
                <button
                  onClick={() => { setBillsCustomFrom(''); setBillsCustomTo('') }}
                  className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <div className="card" style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.25)' }}>
            <p className="text-sm" style={{ color: '#92400e' }}>Total Outstanding</p>
            <p className="text-3xl font-bold font-mono" style={{ color: '#b45309' }}><Money value={totalUnpaid} /></p>
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
          <div className="card" style={{ background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.2)' }}>
            <p className="text-sm" style={{ color: '#5b21b6' }}>Partially Cleared</p>
            <p className="text-3xl font-bold" style={{ color: '#7c3aed' }}>{partialCount}</p>
            <p className="text-xs mt-1" style={{ color: '#7c3aed', opacity: 0.6 }}>paid some, still owing</p>
          </div>
          <div className="card" style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)' }}>
            <p className="text-sm" style={{ color: '#1e40af' }}>Total Collected</p>
            <p className="text-3xl font-bold font-mono" style={{ color: '#2563eb' }}><Money value={totalCollected} /></p>
            <p className="text-xs mt-1" style={{ color: '#2563eb', opacity: 0.6 }}>UGX paid by clients</p>
          </div>
        </div>

        {/* Accounts Dashboard */}
        <div className="card mb-8">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Payment Collections by Account</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Total collected via each payment channel · {periodLabel[accountPeriod]}
              </p>
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
              {/* Total collected banner */}
              <div className="flex items-center justify-between px-5 py-4 rounded-2xl mb-5"
                style={{ background: 'linear-gradient(135deg,#0C2340,#1E4A7A)', color: '#fff' }}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-1">Total Collected · {periodLabel[accountPeriod]}</p>
                  <p className="text-3xl font-bold font-mono"><Money value={totalAllAccounts} /></p>
                  <p className="text-xs opacity-50 mt-0.5">UGX · {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}</p>
                </div>
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>

              {/* Account cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {accountTotals.map(account => (
                  <div
                    key={account.key}
                    className="rounded-2xl p-5 flex items-center gap-4"
                    style={{ background: '#f0f0f0', border: '1px solid rgba(0,0,0,.1)' }}
                  >
                    <div className="shrink-0 flex items-center justify-center w-14 h-14 rounded-xl bg-white shadow-sm">
                      <AccountIcon type={account.key as any} size={44} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-500 leading-tight">{account.label}</p>
                      <Money value={account.total} className="text-2xl font-black text-gray-900 leading-tight mt-0.5 block" />
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

        {/* Search */}
        <div className="card mb-6">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by customer name or notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input-field pl-12"
            />
          </div>
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
                  const isPartial = !isCleared && customer.bills.some(b => Number(b.original_amount) > Number(b.amount))
                  const isExpanded = expandedClients.has(customer.name.toLowerCase())
                  const clientPayments = payments
                    .filter(p => p.customer_name.toLowerCase() === customer.name.toLowerCase())
                    .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())

                  const toggleExpand = (e: React.MouseEvent) => {
                    e.stopPropagation()
                    setExpandedClients(prev => {
                      const next = new Set(prev)
                      if (next.has(customer.name.toLowerCase())) next.delete(customer.name.toLowerCase())
                      else next.add(customer.name.toLowerCase())
                      return next
                    })
                  }

                  return (
                    <Fragment key={customer.name}>
                      <tr
                        onClick={() => router.push(`/admin/unpaid-bills/${nameToSlug(customer.name)}`)}
                        className={`cursor-pointer transition-colors hover:bg-amber-50/60 ${isCleared ? 'opacity-60' : ''}`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-xs ${isCleared ? 'bg-gradient-to-br from-green-400 to-emerald-500' : isPartial ? 'bg-gradient-to-br from-violet-400 to-purple-500' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}>
                              {getInitials(customer.name)}
                            </div>
                            <p className="font-semibold text-gray-900 text-sm">{customer.name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="text-sm text-gray-600 font-medium">{customer.bills.length}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`font-bold font-mono text-sm ${isCleared ? 'text-green-600' : 'text-amber-600'}`}>
                            {isCleared ? '0' : <Money value={customer.total} />}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {isCleared ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Cleared</span>
                          ) : isPartial ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">Partial</span>
                          ) : (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Owing</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {isPartial && clientPayments.length > 0 && (
                              <button
                                onClick={toggleExpand}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ background: 'rgba(139,92,246,.08)', color: '#7c3aed', border: '1px solid rgba(139,92,246,.2)' }}
                                title={isExpanded ? 'Hide payments' : 'Show payments'}
                              >
                                <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => router.push(`/admin/unpaid-bills/${nameToSlug(customer.name)}`)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                              style={{ background: 'rgba(12,35,64,.06)', color: '#0C2340', border: '1px solid rgba(12,35,64,.15)' }}
                            >
                              View
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded payment rows for partially cleared clients */}
                      {isPartial && isExpanded && (
                        <tr>
                          <td colSpan={5} className="px-0 py-0">
                            <div style={{ background: 'rgba(139,92,246,.04)', borderTop: '1px solid rgba(139,92,246,.12)', borderBottom: '1px solid rgba(139,92,246,.12)' }}>
                              <div className="px-5 py-2 flex items-center gap-2 border-b border-violet-100/60">
                                <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">
                                  {clientPayments.length} payment{clientPayments.length !== 1 ? 's' : ''} recorded
                                </span>
                              </div>
                              <table className="w-full">
                                <thead>
                                  <tr style={{ borderBottom: '1px solid rgba(139,92,246,.1)' }}>
                                    <th className="px-5 py-2 text-left text-xs font-semibold text-violet-400 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-violet-400 uppercase tracking-wider">Mode</th>
                                    <th className="px-5 py-2 text-right text-xs font-semibold text-violet-400 uppercase tracking-wider">Amount (UGX)</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-violet-400 uppercase tracking-wider">Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {clientPayments.map(pay => (
                                    <tr key={pay.id} style={{ borderBottom: '1px solid rgba(139,92,246,.06)' }}>
                                      <td className="px-5 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                                        {format(new Date(pay.paid_at), 'MMM dd, yyyy')}
                                      </td>
                                      <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
                                          {MODE_LABELS[pay.payment_mode || ''] || pay.payment_mode || '—'}
                                        </span>
                                      </td>
                                      <td className="px-5 py-2.5 text-right text-xs font-bold font-mono text-violet-700 whitespace-nowrap">
                                        <Money value={Number(pay.amount)} />
                                      </td>
                                      <td className="px-4 py-2.5 text-xs text-gray-400">
                                        {pay.notes || <span className="text-gray-300">—</span>}
                                      </td>
                                    </tr>
                                  ))}
                                  <tr>
                                    <td colSpan={2} className="px-5 py-2 text-xs font-semibold text-violet-600">Total paid</td>
                                    <td className="px-5 py-2 text-right text-xs font-bold font-mono text-violet-700">
                                      <Money value={clientPayments.reduce((s, p) => s + Number(p.amount), 0)} />
                                    </td>
                                    <td />
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
