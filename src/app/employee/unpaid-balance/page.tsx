'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import CurrencyInput from '@/components/CurrencyInput'

type PaymentMode = 'cash' | 'airtel_money' | 'mtn_money' | 'visa_card' | 'stanbic'

const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: 'Cash',
  airtel_money: 'Airtel Money',
  mtn_money: 'MTN Money',
  visa_card: 'Visa Card',
  stanbic: 'Stanbic',
}

interface UnpaidBillRow {
  id: string
  customer_name: string
  amount: number
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
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [payment, setPayment] = useState<PaymentState | null>(null)

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

  const clientSlug = (entry: { id: string; phone: string | null }): string =>
    entry.phone ? entry.phone.replace(/[^0-9]/g, '') : entry.id

  useEffect(() => {
    fetchBills()
    fetchClientsMap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg?.id, profile?.organization_id])

  const filtered = bills.filter(b =>
    b.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

        if (remaining >= billAmt) {
          // Fully covers this bill — zero it out (keep record so customer stays visible)
          const { error } = await supabase.from('unpaid_bills').update({ amount: 0 }).eq('id', bill.id)
          if (error) throw error
          remaining -= billAmt
        } else {
          // Partially covers this bill — reduce the amount
          const { error } = await supabase
            .from('unpaid_bills')
            .update({ amount: billAmt - remaining })
            .eq('id', bill.id)
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
<title>Outstanding Balances – Krug Ten Eleven</title>
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
<div class="sub">Krug Ten Eleven Bar &amp; Restaurant &middot; SEIV System &middot; Generated ${date}</div>
<div class="cards">
  <div class="card"><div class="card-label">Total Outstanding</div><div class="card-val" style="color:#dc2626">${totalOutstanding.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Clients Owing</div><div class="card-val" style="color:#0C2340">${customerGroups.length}</div></div>
  <div class="card"><div class="card-label">Total Bills</div><div class="card-val" style="color:#0C2340">${filtered.length}</div></div>
</div>
<table>
  <thead><tr><th>Date</th><th>Notes</th><th style="text-align:right">Amount (UGX)</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">SEIV &middot; Krug Ten Eleven Bar &amp; Restaurant &middot; This is a system-generated report.</div>
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
    const subject = encodeURIComponent('Outstanding Balances · Krug Ten Eleven')
    const body = encodeURIComponent(
      `Outstanding Balances – Krug Ten Eleven Bar & Restaurant\n` +
      `Generated: ${new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
      `Total Outstanding: UGX ${totalOutstanding.toLocaleString()}\n` +
      `Clients Owing:     ${customerGroups.length}\n` +
      `Total Bills:       ${filtered.length}\n\n` +
      `Breakdown:\n${list}\n\n` +
      `Powered by SEIV · Krug Ten Eleven Bar & Restaurant`
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
            <p className="text-gray-500">Clients with unpaid bills from daily reports</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
        </div>

        {/* Search */}
        <div className="card mb-6">
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
        </div>

        {/* Client groups */}
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
            <p className="text-gray-400">{searchTerm ? 'No clients match your search.' : 'No unpaid bills found.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customerGroups.map(customer => {
              const isExpanded = expandedCustomer === customer.name
              const isCleared = customer.total === 0
              const clientEntry = clientsMap[customer.name.toLowerCase()]

              return (
                <div key={customer.name} className={`card overflow-hidden ${isCleared ? 'opacity-75' : ''}`}>
                  {/* Customer row */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setExpandedCustomer(isExpanded ? null : customer.name)}
                      className="flex items-center gap-4 text-left flex-1 min-w-0"
                    >
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-sm ${isCleared ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}>
                        {getInitials(customer.name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{customer.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {customer.bills.length} bill{customer.bills.length !== 1 ? 's' : ''}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        {isCleared ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            ✓ Cleared
                          </span>
                        ) : (
                          <>
                            <p className="text-xl font-bold font-mono text-amber-600">
                              {customer.total.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-400">UGX owed</p>
                          </>
                        )}
                      </div>

                      <svg
                        className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* View Details button — only for registered clients */}
                    {clientEntry && (
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/employee/clients/${clientSlug(clientEntry)}`) }}
                        className="shrink-0 ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                        style={{ background: 'rgba(12,35,64,.06)', color: '#0C2340', border: '1px solid rgba(12,35,64,.15)' }}
                      >
                        View Details
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}

                    {/* Record Payment button — hidden for cleared clients */}
                    {!isCleared && (
                      <button
                        onClick={(e) => openPaymentModal(customer, e)}
                        className="shrink-0 ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: 'rgba(16,185,129,.1)', color: '#059669', border: '1px solid rgba(16,185,129,.3)' }}
                      >
                        Record Payment
                      </button>
                    )}
                  </div>

                  {/* Bill breakdown */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 uppercase">
                            <th className="text-left pb-2">Date</th>
                            <th className="text-left pb-2">Notes</th>
                            <th className="text-right pb-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {customer.bills.map(bill => (
                            <tr key={bill.id}>
                              <td className="py-2 text-gray-700 whitespace-nowrap">
                                {format(new Date(bill.daily_reports.report_date), 'MMM dd, yyyy')}
                              </td>
                              <td className="py-2 text-gray-500">
                                {bill.notes || '–'}
                              </td>
                              <td className={`py-2 text-right font-medium font-mono ${Number(bill.amount) === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                                {Number(bill.amount) === 0 ? 'PAID' : Number(bill.amount).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200">
                            <td colSpan={2} className="pt-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</td>
                            <td className="pt-3 text-right font-bold font-mono text-amber-700">
                              {customer.total.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>

                      {!isCleared && (
                        <button
                          onClick={(e) => openPaymentModal(customer, e)}
                          className="mt-4 w-full py-2 rounded-lg text-sm font-semibold transition-all"
                          style={{ background: 'rgba(16,185,129,.1)', color: '#059669', border: '1px solid rgba(16,185,129,.25)' }}
                        >
                          Record Payment for {customer.name}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
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
