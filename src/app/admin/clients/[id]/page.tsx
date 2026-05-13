'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Client, ClientCharge, ClientPayment } from '@/types'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

// A unified transaction row for the statement table
interface TransactionRow {
  id: string
  date: string
  type: 'CHARGE' | 'PAYMENT'
  description: string
  charged: number
  paid: number
  // computed running balance (set after sort)
  runningBalance: number
}

// Payment form state
interface PaymentFormState {
  date: string
  amount: string
  note: string
  linked_charge_id: string
}

const emptyPaymentForm: PaymentFormState = {
  date: format(new Date(), 'yyyy-MM-dd'),
  amount: '',
  note: '',
  linked_charge_id: ''
}

export default function ClientStatementPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const { selectedOrg } = useOrganization()
  const { profile } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [charges, setCharges] = useState<ClientCharge[]>([])
  const [payments, setPayments] = useState<ClientPayment[]>([])

  // Payment modal
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(emptyPaymentForm)
  const [savingPayment, setSavingPayment] = useState(false)

  const fetchClient = async () => {
    setLoading(true)
    try {
      // Fetch client record
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single()
      if (clientError) throw clientError
      setClient(clientData)

      // Fetch charges
      const { data: chargesData, error: chargesError } = await supabase
        .from('client_charges')
        .select('*')
        .eq('client_id', id)
        .order('date', { ascending: true })
      if (chargesError) throw chargesError
      setCharges(chargesData || [])

      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('client_payments')
        .select('*')
        .eq('client_id', id)
        .order('date', { ascending: true })
      if (paymentsError) throw paymentsError
      setPayments(paymentsData || [])
    } catch (err) {
      console.error('Error fetching client:', err)
      toast.error('Failed to load client data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchClient()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Computed summary values
  const totalCharged = charges.reduce((s, c) => s + Number(c.amount), 0)
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)
  const balance = totalCharged - totalPaid
  const isSettled = balance <= 0

  // Build sorted transaction history with running balance
  const transactions: TransactionRow[] = [
    ...charges.map((c): TransactionRow => ({
      id: c.id,
      date: c.date,
      type: 'CHARGE',
      description: c.note || 'Charge',
      charged: Number(c.amount),
      paid: 0,
      runningBalance: 0
    })),
    ...payments.map((p): TransactionRow => ({
      id: p.id,
      date: p.date,
      type: 'PAYMENT',
      description: p.note || 'Payment',
      charged: 0,
      paid: Number(p.amount),
      runningBalance: 0
    }))
  ].sort((a, b) => {
    // Sort by date asc, then charges before payments on same day
    if (a.date < b.date) return -1
    if (a.date > b.date) return 1
    if (a.type === 'CHARGE' && b.type === 'PAYMENT') return -1
    if (a.type === 'PAYMENT' && b.type === 'CHARGE') return 1
    return 0
  })

  // Compute running balance
  let running = 0
  transactions.forEach((row) => {
    running += row.charged - row.paid
    row.runningBalance = running
  })

  const handleRecordPayment = async () => {
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }
    setSavingPayment(true)
    try {
      const orgId = selectedOrg?.id || profile?.organization_id || null
      const { error } = await supabase
        .from('client_payments')
        .insert({
          client_id: id,
          organization_id: orgId,
          date: paymentForm.date,
          amount: Number(paymentForm.amount),
          note: paymentForm.note.trim(),
          linked_charge_id: paymentForm.linked_charge_id || null,
          added_by: profile?.id || null
        })
      if (error) throw error
      toast.success('Payment recorded successfully')
      setShowPaymentForm(false)
      setPaymentForm(emptyPaymentForm)
      fetchClient()
    } catch (err: any) {
      console.error('Error recording payment:', err)
      toast.error(err.message || 'Failed to record payment')
    } finally {
      setSavingPayment(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['superadmin']}>
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!client) {
    return (
      <ProtectedRoute allowedRoles={['superadmin']}>
        <DashboardLayout>
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">Client not found.</p>
            <Link href="/admin/clients" className="btn-primary">Back to Client Ledger</Link>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <DashboardLayout>
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin/clients"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Client Ledger
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              <p className="text-gray-500 text-sm">
                Client since {format(new Date(client.created_at), 'MMM dd, yyyy')}
              </p>
            </div>
            <button
              onClick={() => setShowPaymentForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Record Payment
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Charged</p>
            <p className="text-2xl font-bold text-gray-900">{totalCharged.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">{totalPaid.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Balance Due</p>
            <p className={`text-2xl font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {balance.toLocaleString()}
            </p>
          </div>
          <div className={`card ${isSettled ? 'bg-green-50 border border-green-200-green-800' : 'bg-red-50 border border-red-200-red-800'}`}>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Status</p>
            <p className={`text-2xl font-bold ${isSettled ? 'text-green-700' : 'text-red-700'}`}>
              {isSettled ? 'SETTLED' : 'OUTSTANDING'}
            </p>
          </div>
        </div>

        {/* Transaction history table */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">
            Transaction History ({transactions.length})
          </h2>

          {transactions.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">
              No transactions yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Charged (UGX)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Paid (UGX)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {transactions.map((row) => (
                    <tr key={`${row.type}-${row.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {format(new Date(row.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                          row.type === 'CHARGE'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                        {row.description}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono text-red-600">
                        {row.charged > 0 ? row.charged.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono text-green-600">
                        {row.paid > 0 ? row.paid.toLocaleString() : '-'}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold font-mono ${
                        row.runningBalance > 0
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}>
                        {row.runningBalance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Record Payment Modal */}
        {showPaymentForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
                <button
                  onClick={() => { setShowPaymentForm(false); setPaymentForm(emptyPaymentForm) }}
                  className="p-1 text-gray-400 hover:text-gray-500 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Date</label>
                  <input
                    type="date"
                    value={paymentForm.date}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, date: e.target.value }))}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="label">Amount (UGX)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="label">Note (optional)</label>
                  <input
                    type="text"
                    value={paymentForm.note}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, note: e.target.value }))}
                    className="input-field"
                    placeholder="e.g. Cash payment at front desk"
                  />
                </div>

                {charges.length > 0 && (
                  <div>
                    <label className="label">Link to Charge (optional)</label>
                    <select
                      value={paymentForm.linked_charge_id}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, linked_charge_id: e.target.value }))}
                      className="input-field"
                    >
                      <option value="">— Not linked —</option>
                      {charges.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {format(new Date(ch.date), 'MMM dd, yyyy')} — {Number(ch.amount).toLocaleString()} UGX{ch.note ? ` (${ch.note})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowPaymentForm(false); setPaymentForm(emptyPaymentForm) }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRecordPayment}
                  disabled={savingPayment}
                  className="btn-primary flex-1"
                >
                  {savingPayment ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
