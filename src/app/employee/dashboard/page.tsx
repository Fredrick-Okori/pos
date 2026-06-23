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

          usd_amount: data.usd_amount ?? 0,
          exchange_rate: data.exchange_rate || 3700,
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
      if (!orgId) return

      // Clients table is the authoritative source (requires supabase_clients_select_policy.sql to be run).
      // unpaid_bills is queried as a fallback for names that predate the clients table.
      let billQuery = supabase
        .from('unpaid_bills')
        .select('customer_name, daily_reports!inner(organization_id)')
        .eq('daily_reports.organization_id', orgId)

      let clientQuery = supabase
        .from('clients')
        .select('name')
        .eq('organization_id', orgId)

      const [{ data: billData }, { data: clientData }] = await Promise.all([billQuery, clientQuery])

      const seen = new Set<string>()
      // Clients first (more curated), then bill names as fallback
      const allNames = [
        ...((clientData as any[]) || []).map((r: any) => r.name as string),
        ...((billData as any[]) || []).map((r: any) => r.customer_name as string),
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
  }, [user?.id])

  useEffect(() => {
    fetchCustomerNames()
  }, [user?.id, selectedOrg?.id, profile?.organization_id])

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
  const usdInUgx = Math.round(Number(formData.usd_amount) * Number(formData.exchange_rate))
  const totalPayments = Number(formData.airtel_money) + Number(formData.mtn_money) + Number(formData.visa_card) + Number(formData.cash) + usdInUgx
  const totalDeductions = Number(formData.complementaries) + Number(formData.discounts)
  const netSales = Number(formData.total_sales) - totalDeductions
  const paymentDifference = totalPayments - netSales
  const paymentMatch = Math.abs(paymentDifference) < 0.01
  const balanceStatus = paymentMatch ? 'balanced' : paymentDifference > 0 ? 'excess' : 'shortage'
  const cashAtHand = Number(formData.total_sales) - totalExpenses

  // Reconciliation: compares total collected (all payment methods + bills + expenses + deductions) against total_sales
  // Uses formData.cash (the cash received into the till), not the computed cashAtHand
  const totalCash = formData.airtel_money + formData.mtn_money + formData.visa_card + formData.cash + (formData.usd_amount * formData.exchange_rate)
  const totalBills = formData.unpaid_bills.reduce((s, b) => s + Number(b.amount), 0)
  const reconCollected = totalCash + totalBills + totalExpenses + totalDeductions
  const reconDiff = reconCollected - formData.total_sales
  const reconStatus: 'RECONCILED' | 'SHORTAGE' | 'EXCESS' | null =
    formData.total_sales === 0 ? null :
    Math.abs(reconDiff) < 1 ? 'RECONCILED' :
    reconDiff > 0 ? 'EXCESS' : 'SHORTAGE'

  // Form is only locked when a report exists AND is_locked is true.
  // When admin unlocks, is_locked becomes false and the employee can edit.
  const isReportLocked = !!(existingReport && existingReport.is_locked)
  const isUnlockedForEdit = !!(existingReport && !existingReport.is_locked)

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
    if (existingReport && existingReport.is_locked) {
      toast.error('This report is locked and cannot be edited.')
      return
    }
    const incompleteExpense = formData.expenses.find(e => !e.description || !(Number(e.amount) > 0))
    if (incompleteExpense) {
      toast.error('Each expense must have both a description and an amount.')
      return
    }
    const incompleteBill = formData.unpaid_bills.find(b => !b.customer_name || !(Number(b.amount) > 0))
    if (incompleteBill) {
      toast.error('Each invoice must have both a customer name and an amount.')
      return
    }
    setSaving(true)
    try {
      const reportFields = {
        total_sales: formData.total_sales,
        airtel_money: formData.airtel_money,
        mtn_money: formData.mtn_money,
        visa_card: formData.visa_card,
        cash: formData.cash,
        complementaries: formData.complementaries,
        discounts: formData.discounts,
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
        locked_at: new Date().toISOString(),
      }

      let reportId: string

      if (isUnlockedForEdit && existingReport) {
        // UPDATE the unlocked report
        const { error } = await supabase
          .from('daily_reports')
          .update({ ...reportFields, updated_at: new Date().toISOString() })
          .eq('id', existingReport.id)
        if (error) throw error
        reportId = existingReport.id

        // Replace expenses and bills
        await supabase.from('expenses').delete().eq('report_id', reportId)
        await supabase.from('unpaid_bills').delete().eq('report_id', reportId)
      } else {
        // INSERT new report
        const { data, error } = await supabase
          .from('daily_reports')
          .insert({
            user_id: user.id,
            organization_id: selectedOrg?.id || profile?.organization_id || null,
            report_date: formData.report_date,
            ...reportFields,
          })
          .select()
          .single()
        if (error) throw error
        reportId = data.id
      }

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
          usdAmount: formData.usd_amount,
          exchangeRate: formData.exchange_rate,
          barSales: formData.bar_sales,
          kitchenSales: formData.kitchen_sales,
          shishaSales: formData.shisha_sales,
          complementaries: formData.complementaries,
          discounts: formData.discounts,
          expenses: formData.expenses
            .filter(ex => ex.description && ex.amount > 0)
            .map(ex => ({ description: ex.description, amount: ex.amount, paidFrom: ex.paid_from })),
          unpaidBills: formData.unpaid_bills
            .filter(b => b.customer_name && b.amount > 0)
            .map(b => ({ customerName: b.customer_name, amount: b.amount, notes: b.notes || undefined })),
          reconStatus,
          reconDiff: Math.round(reconDiff),
          notes: formData.notes || '',
        }),
      }).catch(() => {})

      toast.success(isUnlockedForEdit ? 'Report updated and locked!' : 'Report saved and locked!')
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
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Daily Sales Report</h1>
            <p className="text-sm text-gray-500 mt-0.5">Welcome back, {profile?.full_name}</p>
          </div>
          <span className="shrink-0 text-xs font-sans font-medium px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(12,35,64,.06)', color: '#0C2340' }}>
            {format(new Date(), 'EEE, dd MMM yyyy')}
          </span>
        </div>

        {/* Account Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {ACCOUNTS.map((account) => {
            const value = Number(formData[account.key]) || 0
            const spent = expensesByAccount[account.key] || 0
            const balance = value - spent
            return (
              <div key={account.key} className="rounded-2xl p-5 flex items-center gap-4" style={{ background: '#f0f0f0', border: '1px solid rgba(0,0,0,.1)' }}>
                <div className="shrink-0 flex items-center justify-center w-14 h-14 rounded-xl bg-white shadow-sm">
                  <AccountIcon type={account.key} size={44} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-500 leading-tight">{account.label}</p>
                  <p className="text-2xl font-black text-gray-900 leading-tight mt-0.5">
                    {value.toLocaleString()}
                  </p>
                  <p className="text-xs font-semibold text-gray-400 tracking-wider">UGX</p>
                  {spent > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-gray-300">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Expenses</span>
                        <span className="text-red-500">-{spent.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold mt-0.5">
                        <span className="text-gray-500">Balance</span>
                        <span className={balance >= 0 ? 'text-green-600' : 'text-red-600'}>{balance.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
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

              {/* Unlocked-for-edit banner */}
              {isUnlockedForEdit && (
                <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(59,130,246,.07)', border: '1px solid rgba(59,130,246,.3)' }}>
                  <svg className="w-5 h-5 shrink-0 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-300">Report unlocked for editing</p>
                    <p className="text-xs mt-0.5 text-blue-400/70">Your admin has unlocked this report. Make your changes and save to resubmit.</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(59,130,246,.15)', color: '#60a5fa', letterSpacing: '.08em' }}>EDIT MODE</span>
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
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Report Date</p>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value)
                        setFormData(prev => ({ ...prev, report_date: e.target.value }))
                      }}
                      className="input-field w-48"
                    />
                  </div>
                  {existingReport && (
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(201,168,76,.12)', color: '#C9A84C' }}>
                      Report exists for this date
                    </span>
                  )}
                </div>
                {existingReport?.admin_comment && (
                  <div className="mt-4 px-4 py-3 rounded-xl flex items-start gap-2.5"
                    style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.18)' }}>
                    <svg className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-blue-700 mb-0.5">Admin Comment</p>
                      <p className="text-sm text-blue-600">{existingReport.admin_comment}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Sales Information</p>
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
              </div>

              <div className="card">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Account Receipts</p>
                <p className="text-xs text-gray-400 mb-4">How much was received into each account from sales today?</p>
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

                </div>

                {/* USD section */}
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid #f1f5f9' }}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">USD Payments</p>
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
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Expenses of the Day</p>
                  {!isReportLocked && (
                    <button type="button" onClick={addExpense}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: 'rgba(220,38,38,.07)', color: '#dc2626', border: '1px solid rgba(220,38,38,.2)' }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add Expense
                    </button>
                  )}
                </div>
                {formData.expenses.length === 0 ? (
                  <p className="text-sm text-gray-400">No expenses added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {formData.expenses.map((expense, index) => (
                      <div key={index} className="rounded-xl px-4 py-3"
                        style={{ background: 'rgba(220,38,38,.03)', border: '1px solid rgba(220,38,38,.1)' }}>
                        <div className="flex gap-3 items-center">
                          <div className="flex-1">
                            <input type="text" value={expense.description} onChange={(e) => updateExpense(index, 'description', e.target.value)} className="input-field" placeholder="Expense description" disabled={isReportLocked} />
                          </div>
                          <div className="w-32 shrink-0">
                            <CurrencyInput value={Number(expense.amount) || 0} onValueChange={(v) => updateExpense(index, 'amount', v)} className="input-field" placeholder="Amount" disabled={isReportLocked} />
                          </div>
                          {!isReportLocked && (
                            <button type="button" onClick={() => removeExpense(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                        <div className="mt-2">
                          <select value={expense.paid_from} onChange={(e) => updateExpense(index, 'paid_from', e.target.value)} className="input-field text-sm" disabled={isReportLocked}>
                            {ACCOUNTS.map(account => (
                              <option key={account.key} value={account.key}>{account.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {formData.expenses.length > 0 && (
                  <div className="mt-4 pt-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #f1f5f9' }}>
                    <span className="text-xs text-gray-400">Total Expenses</span>
                    <span className="font-bold font-mono text-red-600">{totalExpenses.toLocaleString()}</span>
                    <span className="text-xs text-gray-400">UGX</span>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Invoices</p>
                  {!isReportLocked && (
                    <button type="button" onClick={addUnpaidBill}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: 'rgba(245,158,11,.08)', color: '#d97706', border: '1px solid rgba(245,158,11,.25)' }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add Invoice
                    </button>
                  )}
                </div>
                {formData.unpaid_bills.length === 0 ? (
                  <p className="text-sm text-gray-400">No invoices recorded.</p>
                ) : (
                  <div className="space-y-2">
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
                        <div key={index} className="rounded-xl px-4 py-3"
                          style={{ background: 'rgba(245,158,11,.04)', border: '1px solid rgba(245,158,11,.15)' }}>
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
                  <div className="mt-4 pt-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #f1f5f9' }}>
                    <span className="text-xs text-gray-400">Total Unpaid</span>
                    <span className="font-bold font-mono text-amber-600">{totalUnpaidBills.toLocaleString()}</span>
                    <span className="text-xs text-gray-400">UGX</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="card">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Additional Notes</p>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="input-field h-24 resize-none"
                  placeholder="Any additional notes for this report..."
                  disabled={isReportLocked}
                />
              </div>

              {(!isReportLocked) && (
                <button type="submit" disabled={saving}
                  className="w-full py-3.5 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: isUnlockedForEdit ? '#1e40af' : '#0C2340' }}>
                  {saving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving…
                    </>
                  ) : isUnlockedForEdit ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Update &amp; Resubmit Report
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Save &amp; Lock Report
                    </>
                  )}
                </button>
              )}
            </form>
          </div>

          <div className="lg:col-span-1">

            {/* Daily Summary */}
            <div className="card sticky top-8 space-y-0">
              <p className="font-sans text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Daily Summary</p>

              {/* Total Received hero */}
              <div className="rounded-2xl p-5 mb-6 flex items-center gap-4"
                style={{ background: '#f0f0f0', border: '1px solid rgba(0,0,0,.1)' }}>
                <div className="shrink-0 flex items-center justify-center w-14 h-14 rounded-xl shadow-sm"
                  style={{ background: '#059669' }}>
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-sans text-sm font-medium text-gray-500 leading-tight">Total Received</p>
                  <p className="font-sans text-2xl font-black leading-tight mt-0.5" style={{ color: '#059669' }}>
                    {totalPayments.toLocaleString()}
                  </p>
                  <p className="font-sans text-xs font-semibold text-gray-400 tracking-wider">UGX</p>
                </div>
              </div>

              {/* Sales rows */}
              <div className="space-y-2 text-sm font-sans">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Total Sales</span>
                  <span className="font-semibold text-gray-900">{Number(formData.total_sales).toLocaleString()}</span>
                </div>
                {Number(formData.complementaries) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">Complementaries</span>
                    <span className="text-purple-500 text-xs">−{Number(formData.complementaries).toLocaleString()}</span>
                  </div>
                )}
                {Number(formData.discounts) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">Discounts</span>
                    <span className="text-orange-500 text-xs">−{Number(formData.discounts).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1" style={{ borderTop: '1px solid #f1f5f9' }}>
                  <span className="text-gray-700 font-medium">Net Sales</span>
                  <span className={`font-bold ${netSales >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{netSales.toLocaleString()}</span>
                </div>
              </div>

              {/* Account receipts */}
              <div className="mt-3 pt-3 space-y-2 font-sans" style={{ borderTop: '1px solid #f1f5f9' }}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Account Receipts</p>
                {ACCOUNTS.map(account => (
                  <div key={account.key} className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">{account.label}</span>
                    <span className={`font-medium ${account.color}`}>{Number(formData[account.key]).toLocaleString()}</span>
                  </div>
                ))}
                {formData.usd_amount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">USD <span className="text-xs text-gray-400">(${Number(formData.usd_amount).toLocaleString()} × {Number(formData.exchange_rate).toLocaleString()})</span></span>
                    <span className="font-medium text-blue-600">{usdInUgx.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1" style={{ borderTop: '1px solid #f1f5f9' }}>
                  <span className="text-xs text-gray-500">Total Received</span>
                  <span className="font-bold text-emerald-600 text-sm">{totalPayments.toLocaleString()}</span>
                </div>
              </div>

              {/* Deductions */}
              <div className="mt-3 pt-3 space-y-2 font-sans" style={{ borderTop: '1px solid #f1f5f9' }}>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Invoices</span>
                  <span className="text-amber-600">−{totalUnpaidBills.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Total Expenses</span>
                  <span className="text-red-500">−{totalExpenses.toLocaleString()}</span>
                </div>
              </div>

              {/* Reconciliation status */}
              {reconStatus && (
                <div className="mt-3 pt-3 font-sans" style={{ borderTop: '1px solid #f1f5f9' }}>
                  <div className="px-4 py-3 rounded-xl text-center"
                    style={{
                      background: reconStatus === 'RECONCILED' ? 'rgba(16,185,129,.07)' : reconStatus === 'EXCESS' ? 'rgba(59,130,246,.07)' : 'rgba(220,38,38,.06)',
                      border: `1px solid ${reconStatus === 'RECONCILED' ? 'rgba(16,185,129,.2)' : reconStatus === 'EXCESS' ? 'rgba(59,130,246,.2)' : 'rgba(220,38,38,.18)'}`,
                    }}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                      reconStatus === 'RECONCILED' ? 'text-emerald-600' : reconStatus === 'EXCESS' ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      Reconciliation
                    </p>
                    <p className={`text-lg font-bold ${
                      reconStatus === 'RECONCILED' ? 'text-emerald-700' : reconStatus === 'EXCESS' ? 'text-blue-700' : 'text-red-700'
                    }`}>
                      {reconStatus === 'RECONCILED' ? '✓ Reconciled' : reconStatus === 'EXCESS' ? `+${Math.round(reconDiff).toLocaleString()}` : `−${Math.abs(Math.round(reconDiff)).toLocaleString()}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {reconStatus === 'RECONCILED' ? 'All amounts balance' : reconStatus === 'EXCESS' ? 'UGX over sales' : 'UGX short of sales'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Reports */}
            <div className="card mt-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Recent Reports</p>
              {loading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-300" />
                  Loading...
                </div>
              ) : reports.length === 0 ? (
                <p className="text-sm text-gray-400">No reports yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {reports.slice(0, 10).map(report => {
                    const isActive = selectedDate === report.report_date
                    return (
                      <button key={report.id} onClick={() => setSelectedDate(report.report_date)}
                        className="w-full text-left px-3 py-2.5 rounded-xl transition-colors"
                        style={isActive
                          ? { background: 'rgba(12,35,64,.08)', border: '1px solid rgba(12,35,64,.15)' }
                          : { background: 'rgba(0,0,0,.02)', border: '1px solid transparent' }
                        }>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-800">{format(new Date(report.report_date), 'MMM dd, yyyy')}</span>
                          <span className="text-xs font-mono text-gray-500">{Number(report.total_sales).toLocaleString()}</span>
                        </div>
                        {report.is_edited && (
                          <span className="text-xs text-amber-600 font-medium">Edited by admin</span>
                        )}
                      </button>
                    )
                  })}
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
