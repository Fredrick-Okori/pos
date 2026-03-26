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

export default function EmployeeDashboard() {
  const { user, profile } = useAuth()
  const { selectedOrg } = useOrganization()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reports, setReports] = useState<DailyReport[]>([])
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [existingReport, setExistingReport] = useState<DailyReport | null>(null)

  const [formData, setFormData] = useState<ReportFormData>({
    report_date: format(new Date(), 'yyyy-MM-dd'),
    total_sales: 0,
    airtel_money: 0,
    mtn_money: 0,
    visa_card: 0,
    cash: 0,
    complementaries: 0,
    discounts: 0,
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
          expenses: [],
          unpaid_bills: []
        })
      }
    } catch (error) {
      console.error('Error fetching report:', error)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [user])

  useEffect(() => {
    fetchReportForDate(selectedDate)
  }, [selectedDate, user])

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

  const totalExpenses = formData.expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)
  const totalUnpaidBills = formData.unpaid_bills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0)
  const totalPayments = Number(formData.airtel_money) + Number(formData.mtn_money) + Number(formData.visa_card) + Number(formData.cash)
  const totalDeductions = Number(formData.complementaries) + Number(formData.discounts)
  const netSales = Number(formData.total_sales) - totalDeductions
  const paymentDifference = totalPayments - netSales
  const paymentMatch = Math.abs(paymentDifference) < 0.01
  const balanceStatus = paymentMatch ? 'balanced' : paymentDifference > 0 ? 'excess' : 'shortage'
  const cashAtHand = Number(formData.total_sales) - (Number(formData.discounts) + Number(formData.cash) + Number(formData.airtel_money) + Number(formData.mtn_money) + Number(formData.visa_card) + totalUnpaidBills + totalExpenses)

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
    setSaving(true)
    try {
      let reportId = existingReport?.id
      if (existingReport) {
        const { error } = await supabase
          .from('daily_reports')
          .update({
            total_sales: formData.total_sales,
            airtel_money: formData.airtel_money,
            mtn_money: formData.mtn_money,
            visa_card: formData.visa_card,
            cash: formData.cash,
            complementaries: formData.complementaries,
            discounts: formData.discounts,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingReport.id)
        if (error) throw error
        await supabase.from('expenses').delete().eq('report_id', existingReport.id)
        await supabase.from('unpaid_bills').delete().eq('report_id', existingReport.id)
      } else {
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
            discounts: formData.discounts
          })
          .select()
          .single()
        if (error) throw error
        reportId = data.id
      }
      if (formData.expenses.length > 0) {
        const expenses = formData.expenses
          .filter(exp => exp.description && exp.amount > 0)
          .map(exp => ({ report_id: reportId, description: exp.description, amount: exp.amount, paid_from: exp.paid_from }))
        if (expenses.length > 0) {
          const { error } = await supabase.from('expenses').insert(expenses)
          if (error) throw error
        }
      }
      if (formData.unpaid_bills.length > 0) {
        const bills = formData.unpaid_bills
          .filter(bill => bill.customer_name && bill.amount > 0)
          .map(bill => ({ report_id: reportId, customer_name: bill.customer_name, amount: bill.amount, notes: bill.notes || null }))
        if (bills.length > 0) {
          const { error } = await supabase.from('unpaid_bills').insert(bills)
          if (error) throw error
        }
      }
      toast.success(existingReport ? 'Report updated successfully!' : 'Report saved successfully!')
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daily Sales Report</h1>
          <p className="text-gray-600 dark:text-gray-400">Welcome, {profile?.full_name}! Enter your daily sales data below.</p>
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
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{account.label}</span>
                </div>
                <div className={`text-2xl font-bold ${account.color}`}>
                  {value.toLocaleString()}
                </div>
                {spent > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Expenses</span>
                      <span className="text-red-500 dark:text-red-400">-{spent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold mt-1">
                      <span className="text-gray-600 dark:text-gray-300">Balance</span>
                      <span className={balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{balance.toLocaleString()}</span>
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
              <div className="card">
                <h2 className="text-lg font-semibold mb-4 dark:text-white">Report Date</h2>
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
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">A report exists for this date. Saving will update it.</p>
                )}
                {existingReport?.admin_comment && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Admin Comment:</p>
                    <p className="text-sm text-blue-700 dark:text-blue-400">{existingReport.admin_comment}</p>
                  </div>
                )}
              </div>

              <div className="card">
                <h2 className="text-lg font-semibold mb-4 dark:text-white">Sales Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Total Sales</label>
                    <input type="number" step="0.01" min="0" value={formData.total_sales || ''} onChange={(e) => handleInputChange('total_sales', parseFloat(e.target.value) || 0)} className="input-field" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="label">Discounts Given</label>
                    <input type="number" step="0.01" min="0" value={formData.discounts || ''} onChange={(e) => handleInputChange('discounts', parseFloat(e.target.value) || 0)} className="input-field" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="label">Complementaries</label>
                    <input type="number" step="0.01" min="0" value={formData.complementaries || ''} onChange={(e) => handleInputChange('complementaries', parseFloat(e.target.value) || 0)} className="input-field" placeholder="0.00" />
                  </div>
                </div>
              </div>

              <div className="card">
                <h2 className="text-lg font-semibold mb-4 dark:text-white">Account Receipts</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">How much was received into each account from sales today?</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ACCOUNTS.map((account) => (
                    <div key={account.key}>
                      <label className="label">
                        <span className="flex items-center gap-2">
                          <AccountIcon type={account.key} className={account.iconColor} />
                          {account.label}
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData[account.key] || ''}
                        onChange={(e) => handleInputChange(account.key, parseFloat(e.target.value) || 0)}
                        className="input-field"
                        placeholder="0.00"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold dark:text-white">Expenses of the Day</h2>
                  <button type="button" onClick={addExpense} className="btn-secondary text-sm">+ Add Expense</button>
                </div>
                {formData.expenses.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No expenses added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {formData.expenses.map((expense, index) => (
                      <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex gap-3 items-start">
                          <div className="flex-1">
                            <input type="text" value={expense.description} onChange={(e) => updateExpense(index, 'description', e.target.value)} className="input-field" placeholder="Expense description" />
                          </div>
                          <div className="w-32">
                            <input type="number" step="0.01" min="0" value={expense.amount || ''} onChange={(e) => updateExpense(index, 'amount', parseFloat(e.target.value) || 0)} className="input-field" placeholder="Amount" />
                          </div>
                          <button type="button" onClick={() => removeExpense(index)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        <div className="mt-2">
                          <select value={expense.paid_from} onChange={(e) => updateExpense(index, 'paid_from', e.target.value)} className="input-field text-sm">
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
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-right font-semibold dark:text-white">Total Expenses: <span className="text-red-600 dark:text-red-400">{totalExpenses.toLocaleString()}</span></p>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold dark:text-white">Unpaid Bills</h2>
                  <button type="button" onClick={addUnpaidBill} className="btn-secondary text-sm">+ Add Unpaid Bill</button>
                </div>
                {formData.unpaid_bills.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No unpaid bills recorded.</p>
                ) : (
                  <div className="space-y-3">
                    {formData.unpaid_bills.map((bill, index) => (
                      <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex gap-3 items-start">
                          <div className="flex-1">
                            <input type="text" value={bill.customer_name} onChange={(e) => updateUnpaidBill(index, 'customer_name', e.target.value)} className="input-field" placeholder="Customer name" />
                          </div>
                          <div className="w-32">
                            <input type="number" step="0.01" min="0" value={bill.amount} onChange={(e) => updateUnpaidBill(index, 'amount', parseFloat(e.target.value) || 0)} className="input-field" placeholder="Amount" />
                          </div>
                          <button type="button" onClick={() => removeUnpaidBill(index)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        <div className="mt-2">
                          <input type="text" value={bill.notes} onChange={(e) => updateUnpaidBill(index, 'notes', e.target.value)} className="input-field text-sm" placeholder="Notes (optional)" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {formData.unpaid_bills.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-right font-semibold dark:text-white">Total Unpaid: <span className="text-amber-600 dark:text-amber-400">{totalUnpaidBills.toLocaleString()}</span></p>
                  </div>
                )}
              </div>

              <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-lg">
                {saving ? 'Saving...' : existingReport ? 'Update Report' : 'Save Report'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-1">
            <div className="card sticky top-8">
              <h2 className="text-lg font-semibold mb-4 dark:text-white">Daily Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Total Sales</span><span className="font-semibold dark:text-white">{Number(formData.total_sales).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Complementaries</span><span className="text-purple-600 dark:text-purple-400">-{Number(formData.complementaries).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Discounts</span><span className="text-orange-600 dark:text-orange-400">-{Number(formData.discounts).toLocaleString()}</span></div>
                <hr className="border-gray-200 dark:border-gray-700" />
                <div className="flex justify-between font-semibold"><span className="dark:text-white">Net Sales</span><span className={netSales >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{netSales.toLocaleString()}</span></div>
                <hr className="border-gray-200 dark:border-gray-700" />
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Account Receipts:</p>
                {ACCOUNTS.map((account) => (
                  <div key={account.key} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{account.label}</span>
                    <span className={account.color}>{Number(formData[account.key]).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold border-t border-gray-300 dark:border-gray-600 pt-2">
                  <span className="text-gray-600 dark:text-gray-400">Total Received</span><span className="text-green-600 dark:text-green-400 font-bold">{totalPayments.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Unpaid Bills</span><span className="text-amber-600 dark:text-amber-400">-{totalUnpaidBills.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Total Expenses</span><span className="text-red-600 dark:text-red-400">-{totalExpenses.toLocaleString()}</span></div>
                <hr className="border-gray-200 dark:border-gray-700" />
                <div className="flex justify-between font-bold text-lg"><span className="dark:text-white">Cash at Hand</span><span className={cashAtHand >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{cashAtHand.toLocaleString()}</span></div>

                {/* Balance Status Banner */}
                <hr className="border-gray-200 dark:border-gray-700" />
                <div className={`p-3 rounded-lg text-center ${
                  balanceStatus === 'balanced'
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800'
                    : balanceStatus === 'excess'
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                    : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
                }`}>
                  <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${
                    balanceStatus === 'balanced' ? 'text-emerald-600 dark:text-emerald-400'
                    : balanceStatus === 'excess' ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400'
                  }`}>
                    {balanceStatus === 'balanced' ? 'Balanced' : balanceStatus === 'excess' ? 'Excess' : 'Shortage'}
                  </p>
                  <p className={`text-lg font-bold ${
                    balanceStatus === 'balanced' ? 'text-emerald-700 dark:text-emerald-300'
                    : balanceStatus === 'excess' ? 'text-blue-700 dark:text-blue-300'
                    : 'text-red-700 dark:text-red-300'
                  }`}>
                    {balanceStatus === 'balanced' ? 'All accounts match' : `${Math.abs(paymentDifference).toLocaleString()}`}
                  </p>
                  {!paymentMatch && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {balanceStatus === 'excess' ? 'Payments received exceed net sales' : 'Payments received are less than net sales'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="card mt-6">
              <h2 className="text-lg font-semibold mb-4 dark:text-white">Recent Reports</h2>
              {loading ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">Loading...</p>
              ) : reports.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No reports yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {reports.slice(0, 10).map((report) => (
                    <button key={report.id} onClick={() => setSelectedDate(report.report_date)} className={`w-full text-left p-3 rounded-lg transition-colors ${selectedDate === report.report_date ? 'bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700' : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm dark:text-white">{format(new Date(report.report_date), 'MMM dd, yyyy')}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{Number(report.total_sales).toLocaleString()}</span>
                      </div>
                      {report.is_edited && <span className="text-xs text-amber-600 dark:text-amber-400">Edited by admin</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
