'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

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
  amount: string
  notes: string
  submitting: boolean
}

export default function EmployeeUnpaidBalancePage() {
  const supabase = createClient()
  const { selectedOrg } = useOrganization()
  const { profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [bills, setBills] = useState<UnpaidBillRow[]>([])
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

  useEffect(() => {
    fetchBills()
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
  ).sort((a, b) => b.total - a.total)

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const openPaymentModal = (customer: CustomerGroup, e: React.MouseEvent) => {
    e.stopPropagation()
    setPayment({ customer, amount: '', notes: '', submitting: false })
  }

  const handlePaymentSubmit = async () => {
    if (!payment) return
    const amt = parseFloat(payment.amount)
    if (!amt || amt <= 0) {
      toast.error('Enter a valid payment amount')
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
          // Fully covers this bill — delete it
          const { error } = await supabase.from('unpaid_bills').delete().eq('id', bill.id)
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

  return (
    <ProtectedRoute allowedRoles={['employee']}>
      <DashboardLayout>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Client Balances</h1>
          <p className="text-gray-500">Clients with unpaid bills from daily reports</p>
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
            <p className="text-3xl font-bold text-gray-900">{customerGroups.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Total Bills</p>
            <p className="text-3xl font-bold text-gray-900">{filtered.length}</p>
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

              return (
                <div key={customer.name} className="card overflow-hidden">
                  {/* Customer row */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setExpandedCustomer(isExpanded ? null : customer.name)}
                      className="flex items-center gap-4 text-left flex-1 min-w-0"
                    >
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 font-bold text-white text-sm">
                        {getInitials(customer.name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{customer.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {customer.bills.length} unpaid bill{customer.bills.length !== 1 ? 's' : ''}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold font-mono text-amber-600">
                          {customer.total.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400">UGX owed</p>
                      </div>

                      <svg
                        className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Record Payment button */}
                    <button
                      onClick={(e) => openPaymentModal(customer, e)}
                      className="shrink-0 ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: 'rgba(16,185,129,.1)', color: '#059669', border: '1px solid rgba(16,185,129,.3)' }}
                    >
                      Record Payment
                    </button>
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
                              <td className="py-2 text-right font-medium font-mono text-amber-600">
                                {Number(bill.amount).toLocaleString()}
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

                      <button
                        onClick={(e) => openPaymentModal(customer, e)}
                        className="mt-4 w-full py-2 rounded-lg text-sm font-semibold transition-all"
                        style={{ background: 'rgba(16,185,129,.1)', color: '#059669', border: '1px solid rgba(16,185,129,.25)' }}
                      >
                        Record Payment for {customer.name}
                      </button>
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              {/* Modal header */}
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-white text-sm shrink-0">
                    {getInitials(payment.customer.name)}
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg leading-tight">Record Payment</h2>
                    <p className="text-sm text-gray-500">{payment.customer.name}</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Balance summary */}
                <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)' }}>
                  <p className="text-xs text-amber-700 mb-1">Total Outstanding Balance</p>
                  <p className="text-3xl font-bold font-mono text-amber-600">
                    {payment.customer.total.toLocaleString()} <span className="text-base font-normal">UGX</span>
                  </p>
                  <p className="text-xs text-amber-600 mt-1 opacity-70">
                    {payment.customer.bills.length} bill{payment.customer.bills.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Payment amount */}
                <div>
                  <label className="label">Payment Amount (UGX)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={payment.amount}
                      onChange={e => setPayment(p => p ? { ...p, amount: e.target.value } : null)}
                      placeholder=""
                      className="input-field flex-1"
                      autoFocus
                      onWheel={e => e.currentTarget.blur()}
                    />
                    <button
                      type="button"
                      onClick={() => setPayment(p => p ? { ...p, amount: String(p.customer.total) } : null)}
                      className="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold"
                      style={{ background: 'rgba(16,185,129,.1)', color: '#059669', border: '1px solid rgba(16,185,129,.3)' }}
                    >
                      Pay in Full
                    </button>
                  </div>

                  {/* Remaining after payment preview */}
                  {payment.amount && parseFloat(payment.amount) > 0 && (
                    <div className="mt-2 text-sm">
                      {parseFloat(payment.amount) >= payment.customer.total ? (
                        <p className="text-green-600 font-medium">Balance will be fully cleared</p>
                      ) : (
                        <p className="text-gray-500">
                          Remaining after payment:{' '}
                          <span className="font-semibold text-amber-600">
                            {(payment.customer.total - parseFloat(payment.amount)).toLocaleString()} UGX
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="label">Notes (optional)</label>
                  <input
                    type="text"
                    value={payment.notes}
                    onChange={e => setPayment(p => p ? { ...p, notes: e.target.value } : null)}
                    placeholder="e.g. Cash payment, bank transfer..."
                    className="input-field"
                  />
                </div>
              </div>

              {/* Modal footer */}
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
                  disabled={payment.submitting || !payment.amount || parseFloat(payment.amount) <= 0}
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
