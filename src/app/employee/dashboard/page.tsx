'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase'
import { DailyReport, ReportFormData, AccountType } from '@/types'
import { ACCOUNTS, AccountIcon } from '@/lib/accounts'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import CurrencyInput from '@/components/CurrencyInput'

export default function EmployeeDashboard() {
  const { user, profile } = useAuth()
  const { selectedOrg } = useOrganization()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reports, setReports] = useState<DailyReport[]>([])
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [existingReport, setExistingReport] = useState<DailyReport | null>(null)
  const [customerNames, setCustomerNames] = useState<string[]>([])
  const [openAcIndex, setOpenAcIndex] = useState<number | null>(null)
  const [createClientModal, setCreateClientModal] = useState<{
    billIndex: number
    name: string
    phone: string
    email: string
    notes: string
    saving: boolean
  } | null>(null)

  const [formData, setFormData] = useState<ReportFormData>({
    report_date: format(new Date(), 'yyyy-MM-dd'),
    total_sales: 0,
    airtel_money: 0,
    mtn_money: 0,
    visa_card: 0,
    cash: 0,
    complementaries: 0,
    discounts: 0,
    stanbic: 0,
    usd_amount: 0,
    exchange_rate: 3700,
    bar_sales: 0,
    kitchen_sales: 0,
    shisha_sales: 0,
    notes: '',
    expenses: [],
    unpaid_bills: []
  })

  const fetchReports = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*, expenses (*), unpaid_bills (*)')
        .eq('user_id', user.id)
        .order('report_date', { ascending: false })
        .limit(30)
      if (error) throw error
      setReports(data || [])
    } catch (error) {
      console.error('Error fetching reports:', error)
      toast.error('Failed to fetch reports')
    } finally {
      setLoading(false)
    }
  }

  const fetchReportForDate = async (date: string) => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*, expenses (*), unpaid_bills (*)')
        .eq('user_id', user.id)
        .eq('report_date', date)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      if (data) {
        setExistingReport(data)
        setFormData({
          report_date: data.report_date,
          total_sales: data.total_sales,
          airtel_money: data.airtel_money,
          mtn_money: data.mtn_money,
          visa_card: data.visa_card,
          cash: data.cash,
          complementaries: data.complementaries,
          discounts: data.discounts,
          stanbic: data.stanbic ?? 0,
          usd_amount: data.usd_amount ?? 0,
          exchange_rate: data.exchange_rate ?? 3700,
          bar_sales: data.bar_sales ?? 0,
          kitchen_sales: data.kitchen_sales ?? 0,
          shisha_sales: data.shisha_sales ?? 0,
          notes: data.notes || '',
          expenses: data.expenses?.map((e: any) => ({ description: e.description, amount: e.amount, paid_from: e.paid_from || 'cash' })) || [],
          unpaid_bills: data.unpaid_bills?.map((b: any) => ({ customer_name: b.customer_name, amount: b.amount, notes: b.notes || '' })) || []
        })
      } else {
        setExistingReport(null)
        setFormData({
          report_date: date,
          total_sales: 0,
          airtel_money: 0,
          mtn_money: 0,
          visa_card: 0,
          cash: 0,
          complementaries: 0,
          discounts: 0,
          stanbic: 0,
          usd_amount: 0,
          exchange_rate: 3700,
          bar_sales: 0,
          kitchen_sales: 0,
          shisha_sales: 0,
          notes: '',
          expenses: [],
          unpaid_bills: []
        })
      }
    } catch (error) {
      console.error('Error fetching report:', error)
    }
  }

  const fetchCustomerNames = async () => {
    try {
      const orgId = selectedOrg?.id || profile?.organization_id || null

      let billQuery = supabase
        .from('unpaid_bills')
        .select('customer_name, daily_reports!inner(organization_id)')
      if (orgId) billQuery = billQuery.eq('daily_reports.organization_id', orgId)

      let clientQuery = supabase.from('clients').select('name')
      if (orgId) clientQuery = clientQuery.eq('organization_id', orgId)

      const [{ data: billData }, { data: clientData }] = await Promise.all([billQuery, clientQuery])

      const seen = new Set<string>()
      const allNames = [
        ...((billData as any[]) || []).map((r: any) => r.customer_name as string),
        ...((clientData as any[]) || []).map((r: any) => r.name as string),
      ]
      const unique = allNames.filter(n => {
        if (!n || seen.has(n.toLowerCase())) return false
        seen.add(n.toLowerCase())
        return true
      }).sort((a, b) => a.localeCompare(b))
      setCustomerNames(unique)
    } catch {
      // silently ignore — autocomplete is non-critical
    }
  }

  useEffect(() => {
    fetchReports()
    fetchCustomerNames()
  }, [user?.id])

  useEffect(() => {
    fetchReportForDate(selectedDate)
  }, [selectedDate, user?.id])

  const handleInputChange = (field: keyof ReportFormData, value: number | string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addExpense = () => {
    setFormData(prev => ({
      ...prev,
      expenses: [...prev.expenses, { description: '', amount: 0, paid_from: 'cash' as AccountType }]
    }))
  }

  const updateExpense = (index: number, field: 'description' | 'amount' | 'paid_from', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      expenses: prev.expenses.map((exp, i) => i === index ? { ...exp, [field]: value } : exp)
    }))
  }

  const removeExpense = (index: number) => {
    setFormData(prev => ({
      ...prev,
      expenses: prev.expenses.filter((_, i) => i !== index)
    }))
  }

  const addUnpaidBill = () => {
    setFormData(prev => ({
      ...prev,
      unpaid_bills: [...prev.unpaid_bills, { customer_name: '', amount: 0, notes: '' }]
    }))
  }

  const updateUnpaidBill = (index: number, field: 'customer_name' | 'amount' | 'notes', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      unpaid_bills: prev.unpaid_bills.map((bill, i) => i === index ? { ...bill, [field]: value } : bill)
    }))
  }

  const removeUnpaidBill = (index: number) => {
    setFormData(prev => ({
      ...prev,
      unpaid_bills: prev.unpaid_bills.filter((_, i) => i !== index)
    }))
  }

  const isValidPhone = (phone: string) => /^\+\d{9,14}$/.test(phone.replace(/\s/g, ''))

  const handlePhoneInput = (raw: string) => {
    // Ensure it always starts with +, allow only digits and spaces after
    let val = raw
    if (val && !val.startsWith('+')) val = '+' + val.replace(/\+/g, '')
    val = '+' + val.slice(1).replace(/[^\d\s]/g, '')
    setCreateClientModal(m => m ? { ...m, phone: val } : null)
  }

  const handleSaveNewClient = async () => {
    if (!createClientModal || !createClientModal.name.trim()) return
    const phone = createClientModal.phone.replace(/\s/g, '')
    if (!isValidPhone(phone)) {
      toast.error('Enter a valid phone number (e.g. +256700000000)')
      return
    }
    setCreateClientModal(m => m ? { ...m, saving: true } : null)
    try {
      const orgId = selectedOrg?.id || profile?.organization_id || null
      const { error } = await supabase.from('clients').insert({
        name: createClientModal.name.trim(),
        organization_id: orgId,
        phone_number: phone,
        email: createClientModal.email.trim() || null,
        notes: createClientModal.notes.trim() || null,
      })
      if (error) {
        if (error.code === '23505') {
          toast.error('A client with this phone number already exists')
        } else {
          throw error
        }
        setCreateClientModal(m => m ? { ...m, saving: false } : null)
        return
      }
      updateUnpaidBill(createClientModal.billIndex, 'customer_name', createClientModal.name.trim())
      await fetchCustomerNames()
      toast.success(`Client "${createClientModal.name.trim()}" created`)
      setCreateClientModal(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create client')
      setCreateClientModal(m => m ? { ...m, saving: false } : null)
    }
  }

  const totalExpenses = formData.expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)
  const totalUnpaidBills = formData.unpaid_bills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0)
  const totalPayments = Number(formData.airtel_money) + Number(formData.mtn_money) + Number(formData.visa_card) + Number(formData.cash)
  const totalDeductions = Number(formData.complementaries) + Number(formData.discounts)
  const netSales = Number(formData.total_sales) - totalDeductions
  const paymentDifference = totalPayments - netSales
  const paymentMatch = Math.abs(paymentDifference) < 0.01
  const balanceStatus = paymentMatch ? 'balanced' : paymentDifference > 0 ? 'excess' : 'shortage'
  const cashAtHand = Number(formData.total_sales) - (Number(formData.discounts) + Number(formData.cash) + Number(formData.airtel_money) + Number(formData.mtn_money) + Number(formData.visa_card) + totalUnpaidBills + totalExpenses)

  // Reconciliation: compares total collected (all payment methods + bills + expenses + deductions) against total_sales
  // Uses formData.cash (the cash received into the till), not the computed cashAtHand
  const totalCash = formData.airtel_money + formData.mtn_money + formData.visa_card + formData.cash + formData.stanbic + (formData.usd_amount * formData.exchange_rate)
  const totalBills = formData.unpaid_bills.reduce((s, b) => s + Number(b.amount), 0)
  const reconCollected = totalCash + totalBills + totalExpenses + totalDeductions
  const reconDiff = reconCollected - formData.total_sales
  const reconStatus: 'RECONCILED' | 'SHORTAGE' | 'EXCESS' | null =
    formData.total_sales === 0 ? null :
    Math.abs(reconDiff) < 1 ? 'RECONCILED' :
    reconDiff > 0 ? 'EXCESS' : 'SHORTAGE'

  // Determine whether the form should be locked for this employee
  // Disable form if a report exists for the selected date (regardless of lock status)
  const isReportLocked = !!existingReport

  // Calculate per-account expense totals
  const expensesByAccount = ACCOUNTS.reduce((acc, account) => {
    acc[account.key] = formData.expenses
      .filter(e => e.paid_from === account.key)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    return acc
  }, {} as Record<AccountType, number>)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (existingReport) {
      toast.error('A report already exists for this date. Select a different date.')
      return
    }
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .insert({
          user_id: user.id,
          organization_id: selectedOrg?.id || profile?.organization_id || null,
          report_date: formData.report_date,
          total_sales: formData.total_sales,
          airtel_money: formData.airtel_money,
          mtn_money: formData.mtn_money,
          visa_card: formData.visa_card,
          cash: formData.cash,
          complementaries: formData.complementaries,
          discounts: formData.discounts,
          stanbic: formData.stanbic,
          usd_amount: formData.usd_amount,
          exchange_rate: formData.exchange_rate,
          bar_sales: formData.bar_sales,
          kitchen_sales: formData.kitchen_sales,
          shisha_sales: formData.shisha_sales,
          notes: formData.notes || null,
          recon_status: reconStatus,
          recon_diff: Math.round(reconDiff),
          is_locked: true,
          locked_by: profile?.full_name ?? null,
          locked_at: new Date().toISOString()
        })
        .select()
        .single()
      if (error) throw error

      const reportId = data.id
      const expenses = formData.expenses
        .filter(exp => exp.description && exp.amount > 0)
        .map(exp => ({ report_id: reportId, description: exp.description, amount: exp.amount, paid_from: exp.paid_from }))
      if (expenses.length > 0) {
        const { error } = await supabase.from('expenses').insert(expenses)
        if (error) throw error
      }
      const bills = formData.unpaid_bills
        .filter(bill => bill.customer_name && bill.amount > 0)
        .map(bill => ({ report_id: reportId, customer_name: bill.customer_name, amount: bill.amount, original_amount: bill.amount, notes: bill.notes || null }))
      if (bills.length > 0) {
        const { error } = await supabase.from('unpaid_bills').insert(bills)
        if (error) throw error
      }
      fetch('/api/email/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: profile?.full_name ?? 'Employee',
          reportDate: formData.report_date,
          totalSales: formData.total_sales,
          cash: formData.cash,
          airtelMoney: formData.airtel_money,
          mtnMoney: formData.mtn_money,
          visaCard: formData.visa_card,
          stanbic: formData.stanbic,
          usdAmount: formData.usd_amount,
          exchangeRate: formData.exchange_rate,
          barSales: formData.bar_sales,
          kitchenSales: formData.kitchen_sales,
          shishaSales: formData.shisha_sales,
          complementaries: formData.complementaries,
          discounts: formData.discounts,
          expenses: formData.expenses
            .filter(e => e.description && e.amount > 0)
            .map(e => ({ description: e.description, amount: e.amount, paidFrom: e.paid_from })),
          unpaidBills: formData.unpaid_bills
            .filter(b => b.customer_name && b.amount > 0)
            .map(b => ({ customerName: b.customer_name, amount: b.amount, notes: b.notes || undefined })),
          reconStatus,
          reconDiff: Math.round(reconDiff),
          notes: formData.notes || '',
        }),
      }).catch(() => {})

      toast.success('Report saved and locked!')
      fetchReports()
      fetchReportForDate(selectedDate)
    } catch (error: any) {
      console.error('Error saving report:', error)
      toast.error(error.message || 'Failed to save report')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['employee']}>
      <DashboardLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Daily Sales Report</h1>
          <p className="text-gray-500">Welcome, {profile?.full_name}! Enter your daily sales data below.</p>
        </div>

        {/* Account Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {ACCOUNTS.map((account) => {
            const value = Number(formData[account.key]) || 0
            const spent = expensesByAccount[account.key] || 0
            const balance = value - spent
            return (
              <div key={account.key} className={`rounded-xl border p-4 ${account.bgColor}`}>
                <div className="flex items-center gap-2 mb-3">
                  <AccountIcon type={account.key} className={account.iconColor} />
                  <span className="text-sm font-semibold text-gray-700">{account.label}</span>
                </div>
                <div className={`text-2xl font-bold ${account.color}`}>
                  {value.toLocaleString()}
                </div>
                {spent > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Expenses</span>
                      <span className="text-red-500">-{spent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold mt-1">
                      <span className="text-gray-500">Balance</span>
                      <span className={balance >= 0 ? 'text-green-600' : 'text-red-600'}>{balance.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Locked report banner */}
              {isReportLocked && (
                <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.25)' }}>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="#C9A84C" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: '#E8C97A' }}>Report already submitted for this day</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(232,201,122,.6)' }}>Select a different date above to create a new report for another day.</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(201,168,76,.15)', color: '#C9A84C', letterSpacing: '.08em' }}>LOCKED</span>
                </div>
              )}

              {/* Reconciliation banner */}
              {formData.total_sales > 0 && (
                <div className={`rounded-xl p-4 mb-6 border flex items-center justify-between ${
                  reconStatus === 'RECONCILED' ? 'bg-green-500/10 border-green-500/40' :
                  reconStatus === 'EXCESS' ? 'bg-amber-500/10 border-amber-500/40' :
                  'bg-red-500/10 border-red-500/40'
                }`}>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Reconciliation</p>
                    <p className={`text-lg font-bold ${
                      reconStatus === 'RECONCILED' ? 'text-green-600' :
                      reconStatus === 'EXCESS' ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {reconStatus === 'RECONCILED' ? '✓ RECONCILED' : reconStatus === 'EXCESS' ? '↑ EXCESS' : '↓ SHORTAGE'}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-1">
                      Cash ({totalCash.toLocaleString()}) + Credit ({totalBills.toLocaleString()}) + Expenses ({totalExpenses.toLocaleString()}) + Deductions ({totalDeductions.toLocaleString()}) = {reconCollected.toLocaleString()} | Sales: {formData.total_sales.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold font-mono ${
                      reconStatus === 'RECONCILED' ? 'text-green-600' :
                      reconStatus === 'EXCESS' ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {reconDiff > 0 ? '+' : ''}{Math.round(reconDiff).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">{reconStatus === 'RECONCILED' ? 'Balanced' : reconStatus === 'EXCESS' ? 'UGX over' : 'UGX short'}</p>
                  </div>
                </div>
              )}

              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Report Date</h2>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value)
                    setFormData(prev => ({ ...prev, report_date: e.target.value }))
                  }}
                  className="input-field w-48"
                />
                {existingReport && (
                  <p className="text-sm mt-2" style={{ color: '#C9A84C' }}>
                    A report already exists for this date. Choose a different date to create a new report.
                  </p>
                )}
                {existingReport?.admin_comment && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-800">Admin Comment:</p>
                    <p className="text-sm text-blue-700">{existingReport.admin_comment}</p>
                  </div>
                )}
              </div>

              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Sales Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Total Sales</label>
                    <CurrencyInput value={formData.total_sales} onValueChange={(v) => handleInputChange('total_sales', v)} className="input-field" disabled={isReportLocked} />
                  </div>
                  <div>
                    <label className="label">Discounts Given</label>
                    <CurrencyInput value={formData.discounts} onValueChange={(v) => handleInputChange('discounts', v)} className="input-field" disabled={isReportLocked} />
                  </div>
                  <div>
                    <label className="label">Complementaries</label>
                    <CurrencyInput value={formData.complementaries} onValueChange={(v) => handleInputChange('complementaries', v)} className="input-field" disabled={isReportLocked} />
                  </div>
                </div>
                {/* Sales breakdown (optional) */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-400 mb-3">Sales Breakdown (optional)</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Bar Sales</label>
                      <CurrencyInput value={formData.bar_sales} onValueChange={(v) => handleInputChange('bar_sales', v)} className="input-field" disabled={isReportLocked} />
                    </div>
                    <div>
                      <label className="label">Kitchen Sales</label>
                      <CurrencyInput value={formData.kitchen_sales} onValueChange={(v) => handleInputChange('kitchen_sales', v)} className="input-field" disabled={isReportLocked} />
                    </div>
                    <div>
                      <label className="label">Shisha Sales</label>
                      <CurrencyInput value={formData.shisha_sales} onValueChange={(v) => handleInputChange('shisha_sales', v)} className="input-field" disabled={isReportLocked} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Account Receipts</h2>
                <p className="text-sm text-gray-400 mb-4">How much was received into each account from sales today?</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ACCOUNTS.map((account) => (
                    <div key={account.key}>
                      <label className="label">
                        <span className="flex items-center gap-2">
                          <AccountIcon type={account.key} className={account.iconColor} />
                          {account.label}
                        </span>
                      </label>
                      <CurrencyInput
                        value={Number(formData[account.key]) || 0}
                        onValueChange={(v) => handleInputChange(account.key, v)}
                        className="input-field"
                        disabled={isReportLocked}
                      />
                    </div>
                  ))}
                  {/* Stanbic (UGX) */}
                  <div>
                    <label className="label">Stanbic (UGX)</label>
                    <CurrencyInput
                      value={formData.stanbic}
                      onValueChange={(v) => handleInputChange('stanbic', v)}
                      className="input-field"
                      disabled={isReportLocked}
                    />
                  </div>
                </div>

                {/* USD section */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-400 mb-3">USD Payments</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">USD Amount ($)</label>
                      <CurrencyInput
                        value={formData.usd_amount}
                        onValueChange={(v) => handleInputChange('usd_amount', v)}
                        className="input-field"
                        disabled={isReportLocked}
                      />
                    </div>
                    <div>
                      <label className="label">Exchange Rate (UGX per $1)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={formData.exchange_rate || ''}
                        onChange={(e) => handleInputChange('exchange_rate', parseFloat(e.target.value) || 3700)}
                        className="input-field"
                        placeholder="3700"
                        disabled={isReportLocked}
                      />
                    </div>
                  </div>
                  {formData.usd_amount > 0 && (
                    <p className="mt-2 text-sm text-blue-600">
                      USD in UGX: {Math.round(formData.usd_amount * formData.exchange_rate).toLocaleString()} UGX
                    </p>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Expenses of the Day</h2>
                  {!isReportLocked && (
                    <button type="button" onClick={addExpense} className="btn-secondary text-sm">+ Add Expense</button>
                  )}
                </div>
                {formData.expenses.length === 0 ? (
                  <p className="text-gray-400 text-sm">No expenses added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {formData.expenses.map((expense, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex gap-3 items-start">
                          <div className="flex-1">
                            <input type="text" value={expense.description} onChange={(e) => updateExpense(index, 'description', e.target.value)} className="input-field" placeholder="Expense description" disabled={isReportLocked} />
                          </div>
                          <div className="w-32">
                            <CurrencyInput value={Number(expense.amount) || 0} onValueChange={(v) => updateExpense(index, 'amount', v)} className="input-field" placeholder="Amount" disabled={isReportLocked} />
                          </div>
                          {!isReportLocked && (
                            <button type="button" onClick={() => removeExpense(index)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                        <div className="mt-2">
                          <select value={expense.paid_from} onChange={(e) => updateExpense(index, 'paid_from', e.target.value)} className="input-field text-sm" disabled={isReportLocked}>
                            {ACCOUNTS.map((account) => (
                              <option key={account.key} value={account.key}>{account.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {formData.expenses.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-right font-semibold">Total Expenses: <span className="text-red-600">{totalExpenses.toLocaleString()}</span></p>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Unpaid Bills</h2>
                  {!isReportLocked && (
                    <button type="button" onClick={addUnpaidBill} className="btn-secondary text-sm">+ Add Unpaid Bill</button>
                  )}
                </div>
                {formData.unpaid_bills.length === 0 ? (
                  <p className="text-gray-400 text-sm">No unpaid bills recorded.</p>
                ) : (
                  <div className="space-y-3">
                    {formData.unpaid_bills.map((bill, index) => {
                      const query = bill.customer_name.toLowerCase()
                      const suggestions = query
                        ? customerNames.filter(n => n.toLowerCase().includes(query) && n.toLowerCase() !== query)
                        : customerNames
                      const isOpen = openAcIndex === index && !isReportLocked && suggestions.length > 0

                      const nameTyped = bill.customer_name.trim()
                      const nameExists = customerNames.some(n => n.toLowerCase() === nameTyped.toLowerCase())
                      const showCreateBtn = !isReportLocked && nameTyped.length > 0 && !nameExists

                      return (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex gap-3 items-start">
                            <div className="flex-1 relative">
                              <input
                                type="text"
                                value={bill.customer_name}
                                onChange={(e) => {
                                  updateUnpaidBill(index, 'customer_name', e.target.value)
                                  setOpenAcIndex(index)
                                }}
                                onFocus={() => setOpenAcIndex(index)}
                                onBlur={() => setTimeout(() => setOpenAcIndex(null), 150)}
                                className="input-field"
                                placeholder="Customer name"
                                disabled={isReportLocked}
                                autoComplete="off"
                              />
                              {isOpen && (
                                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-44 overflow-y-auto">
                                  {suggestions.map(name => (
                                    <li
                                      key={name}
                                      onMouseDown={() => {
                                        updateUnpaidBill(index, 'customer_name', name)
                                        setOpenAcIndex(null)
                                      }}
                                      className="px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 cursor-pointer flex items-center gap-2"
                                    >
                                      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-semibold text-xs flex items-center justify-center shrink-0">
                                        {name.charAt(0).toUpperCase()}
                                      </span>
                                      {name}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {showCreateBtn && (
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    setCreateClientModal({ billIndex: index, name: nameTyped, phone: '+256', email: '', notes: '', saving: false })
                                  }}
                                  className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                                  style={{ background: 'rgba(16,185,129,.08)', color: '#059669', border: '1px solid rgba(16,185,129,.25)' }}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                  </svg>
                                  Create &ldquo;{nameTyped}&rdquo; as client
                                </button>
                              )}
                            </div>
                            <div className="w-32">
                              <CurrencyInput value={Number(bill.amount) || 0} onValueChange={(v) => updateUnpaidBill(index, 'amount', v)} className="input-field" placeholder="Amount" disabled={isReportLocked} />
                            </div>
                            {!isReportLocked && (
                              <button type="button" onClick={() => removeUnpaidBill(index)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            )}
                          </div>
                          <div className="mt-2">
                            <input type="text" value={bill.notes} onChange={(e) => updateUnpaidBill(index, 'notes', e.target.value)} className="input-field text-sm" placeholder="Notes (optional)" disabled={isReportLocked} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {formData.unpaid_bills.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-right font-semibold">Total Unpaid: <span className="text-amber-600">{totalUnpaidBills.toLocaleString()}</span></p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Additional Notes</h2>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="input-field h-24 resize-none"
                  placeholder="Any additional notes for this report..."
                  disabled={isReportLocked}
                />
              </div>

              {/* Only show submit if no report exists for this date */}
              {!isReportLocked && (
                <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-lg">
                  {saving ? 'Saving...' : 'Save & Lock Report'}
                </button>
              )}
            </form>
          </div>

          <div className="lg:col-span-1">
            <div className="card sticky top-8">
              <h2 className="text-lg font-semibold mb-4">Daily Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-gray-500">Total Sales</span><span className="font-semibold">{Number(formData.total_sales).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Complementaries</span><span className="text-purple-600">-{Number(formData.complementaries).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Discounts</span><span className="text-orange-600">-{Number(formData.discounts).toLocaleString()}</span></div>
                <hr className="border-gray-200" />
                <div className="flex justify-between font-semibold"><span className="text-gray-900">Net Sales</span><span className={netSales >= 0 ? 'text-green-600' : 'text-red-600'}>{netSales.toLocaleString()}</span></div>
                <hr className="border-gray-200" />
                <p className="text-xs text-gray-400 font-medium">Account Receipts:</p>
                {ACCOUNTS.map((account) => (
                  <div key={account.key} className="flex justify-between text-sm">
                    <span className="text-gray-500">{account.label}</span>
                    <span className={account.color}>{Number(formData[account.key]).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2">
                  <span className="text-gray-500">Total Received</span><span className="text-green-600 font-bold">{totalPayments.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Unpaid Bills</span><span className="text-amber-600">-{totalUnpaidBills.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Total Expenses</span><span className="text-red-600">-{totalExpenses.toLocaleString()}</span></div>
                <hr className="border-gray-200" />
                <div className="flex justify-between font-bold text-lg"><span className="text-gray-900">Cash at Hand</span><span className={cashAtHand >= 0 ? 'text-green-600' : 'text-red-600'}>{cashAtHand.toLocaleString()}</span></div>

                {/* Balance Status Banner */}
                <hr className="border-gray-200" />
                <div className={`p-3 rounded-lg text-center ${
                  balanceStatus === 'balanced'
                    ? 'bg-emerald-50 border border-emerald-200-emerald-800'
                    : balanceStatus === 'excess'
                    ? 'bg-blue-50 border border-blue-200-blue-800'
                    : 'bg-red-50 border border-red-200-red-800'
                }`}>
                  <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${
                    balanceStatus === 'balanced' ? 'text-emerald-600'
                    : balanceStatus === 'excess' ? 'text-blue-600'
                    : 'text-red-600'
                  }`}>
                    {balanceStatus === 'balanced' ? 'Balanced' : balanceStatus === 'excess' ? 'Excess' : 'Shortage'}
                  </p>
                  <p className={`text-lg font-bold ${
                    balanceStatus === 'balanced' ? 'text-emerald-700'
                    : balanceStatus === 'excess' ? 'text-blue-700'
                    : 'text-red-700'
                  }`}>
                    {balanceStatus === 'balanced' ? 'All accounts match' : `${Math.abs(paymentDifference).toLocaleString()}`}
                  </p>
                  {!paymentMatch && (
                    <p className="text-xs text-gray-400 mt-1">
                      {balanceStatus === 'excess' ? 'Payments received exceed net sales' : 'Payments received are less than net sales'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="card mt-6">
              <h2 className="text-lg font-semibold mb-4">Recent Reports</h2>
              {loading ? (
                <p className="text-gray-400 text-sm">Loading...</p>
              ) : reports.length === 0 ? (
                <p className="text-gray-400 text-sm">No reports yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {reports.slice(0, 10).map((report) => (
                    <button key={report.id} onClick={() => setSelectedDate(report.report_date)} className={`w-full text-left p-3 rounded-lg transition-colors ${selectedDate === report.report_date ? 'bg-emerald-50 border border-emerald-200-emerald-700' : 'bg-gray-50 hover:bg-gray-100'}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{format(new Date(report.report_date), 'MMM dd, yyyy')}</span>
                        <span className="text-sm text-gray-500">{Number(report.total_sales).toLocaleString()}</span>
                      </div>
                      {report.is_edited && <span className="text-xs text-amber-600">Edited by admin</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Create Client Modal */}
        {createClientModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg leading-tight">Create New Client</h2>
                    <p className="text-sm text-gray-500">Register as a tracked client</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateClientModal(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 pb-5 space-y-4">
                <div>
                  <label className="label">Client Name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={createClientModal.name}
                    onChange={e => setCreateClientModal(m => m ? { ...m, name: e.target.value } : null)}
                    className="input-field"
                    placeholder="Full name"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Phone Number <span className="text-red-400">*</span></label>
                  <input
                    type="tel"
                    value={createClientModal.phone}
                    onChange={e => handlePhoneInput(e.target.value)}
                    className={`input-field ${createClientModal.phone.length > 4 && !isValidPhone(createClientModal.phone.replace(/\s/g, '')) ? 'border-red-300 focus:ring-red-200' : ''}`}
                    placeholder="+256 700 000 000"
                  />
                  {createClientModal.phone.length > 4 && !isValidPhone(createClientModal.phone.replace(/\s/g, '')) ? (
                    <p className="mt-1 text-xs text-red-500">Must start with + and contain 9–14 digits (e.g. +256700000000)</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400">Unique identifier — no two clients can share a number</p>
                  )}
                </div>
                <div>
                  <label className="label">Email <span className="text-gray-400 font-normal">(optional — for receipts)</span></label>
                  <input
                    type="email"
                    value={createClientModal.email}
                    onChange={e => setCreateClientModal(m => m ? { ...m, email: e.target.value } : null)}
                    className="input-field"
                    placeholder="client@example.com"
                  />
                </div>
                <div>
                  <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    value={createClientModal.notes}
                    onChange={e => setCreateClientModal(m => m ? { ...m, notes: e.target.value } : null)}
                    className="input-field resize-none h-20"
                    placeholder="Any additional information about this client..."
                  />
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCreateClientModal(null)}
                  disabled={createClientModal.saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewClient}
                  disabled={createClientModal.saving || !createClientModal.name.trim() || !isValidPhone(createClientModal.phone.replace(/\s/g, ''))}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: '#059669' }}
                >
                  {createClientModal.saving ? 'Creating...' : 'Create Client'}
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
