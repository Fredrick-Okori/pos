'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
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
    profiles: { full_name: string } | null
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

function nameToSlug(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function clientPhoneSlug(phone: string | null, id: string) {
  return phone ? phone.replace(/[^0-9]/g, '') : id
}

export default function AdminUnpaidBillDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { selectedOrg } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [bills, setBills] = useState<UnpaidBillRow[]>([])
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [clientRecord, setClientRecord] = useState<ClientRecord | null>(null)
  const [payment, setPayment] = useState<PaymentState | null>(null)
  const [allCustomers, setAllCustomers] = useState<{ name: string; total: number }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('unpaid_bills')
        .select(`*, daily_reports!inner(report_date, organization_id, profiles!user_id(full_name))`)
        .order('created_at', { ascending: false })

      if (selectedOrg) query = query.eq('daily_reports.organization_id', selectedOrg.id)

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

      const match = allBills.find(b => nameToSlug(b.customer_name) === slug)
      if (!match) { setLoading(false); return }

      const name = match.customer_name
      setCustomerName(name)
      setBills(allBills.filter(b => b.customer_name.toLowerCase() === name.toLowerCase()))

      let clientQuery = supabase.from('clients').select('id, phone_number, email').ilike('name', name).limit(1)
      if (selectedOrg) clientQuery = clientQuery.eq('organization_id', selectedOrg.id)
      const { data: clientData } = await clientQuery
      if (clientData && clientData.length > 0) {
        setClientRecord({ id: clientData[0].id, phone: clientData[0].phone_number, email: clientData[0].email })
      }
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
  }, [slug, selectedOrg?.id])

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

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const searchResults = searchQuery.trim().length > 0
    ? allCustomers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) && nameToSlug(c.name) !== slug)
    : allCustomers.filter(c => nameToSlug(c.name) !== slug)

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

      toast.success(amt >= total ? `${customerName}'s balance fully cleared` : `Payment of UGX ${amt.toLocaleString()} recorded`)
      setPayment(null)
      await fetchData()
    } catch (err) {
      console.error('Payment error:', err)
      toast.error('Failed to record payment')
      setPayment(p => p ? { ...p, submitting: false } : null)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
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
                          router.push(`/admin/unpaid-bills/${nameToSlug(c.name)}`)
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
                        <span className={`text-xs font-semibold font-mono shrink-0 ${cleared ? 'text-green-600' : 'text-amber-600'}`}>
                          {cleared ? 'Cleared' : `${c.total.toLocaleString()} UGX`}
                        </span>
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
                onClick={() => router.push('/admin/unpaid-bills')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Unpaid Bills
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
              </div>
            </div>

            {/* Balance banner */}
            <div
              className="rounded-2xl px-6 py-5 flex items-center justify-between mb-8"
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

            {/* Bills table */}
            <div className="card overflow-hidden p-0">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Bill Breakdown</h2>
              </div>
              <table className="min-w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Recorded By</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Notes</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount (UGX)</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...bills]
                    .sort((a, b) => new Date(b.daily_reports.report_date).getTime() - new Date(a.daily_reports.report_date).getTime())
                    .map(bill => {
                      const paid = Number(bill.amount) === 0
                      return (
                        <tr key={bill.id} className="hover:bg-gray-50/60">
                          <td className="px-5 py-3.5 text-sm font-medium text-gray-800 whitespace-nowrap">
                            {format(new Date(bill.daily_reports.report_date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-500">
                            {bill.daily_reports.profiles?.full_name ?? '—'}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-500">
                            {bill.notes || <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-5 py-3.5 text-right text-sm font-semibold font-mono ${paid ? 'text-green-600' : 'text-amber-600'}`}>
                            {paid ? '0' : Number(bill.amount).toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {paid ? (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Paid</span>
                            ) : (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Owing</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50">
                    <td colSpan={3} className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wide">Total Outstanding</td>
                    <td className={`px-5 py-4 text-right font-bold font-mono ${isCleared ? 'text-green-600' : 'text-amber-700'}`}>
                      {total.toLocaleString()}
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
