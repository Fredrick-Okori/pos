'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase'
import { DailyReport, AccountType } from '@/types'
import { ACCOUNTS, AccountIcon } from '@/lib/accounts'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface ExpenseEntry {
  description: string
  amount: number
  paid_from: AccountType
}

export default function EmployeeExpenses() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [report, setReport] = useState<DailyReport | null>(null)
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([])
  const [noReport, setNoReport] = useState(false)

  const fetchReportAndExpenses = async (date: string) => {
    if (!user) return
    setLoading(true)
    setNoReport(false)
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*, expenses (*)')
        .eq('user_id', user.id)
        .eq('report_date', date)
        .single()

      if (error && error.code === 'PGRST116') {
        setReport(null)
        setExpenses([])
        setNoReport(true)
        return
      }
      if (error) throw error

      setReport(data)
      setExpenses(
        data.expenses?.map((e: any) => ({
          description: e.description,
          amount: e.amount,
          paid_from: e.paid_from || 'cash',
        })) || []
      )
    } catch (error) {
      console.error('Error fetching report:', error)
      toast.error('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReportAndExpenses(selectedDate)
  }, [selectedDate, user])

  const addExpense = () => {
    setExpenses(prev => [...prev, { description: '', amount: 0, paid_from: 'cash' }])
  }

  const updateExpense = (index: number, field: keyof ExpenseEntry, value: string | number) => {
    setExpenses(prev => prev.map((exp, i) => i === index ? { ...exp, [field]: value } : exp))
  }

  const removeExpense = (index: number) => {
    setExpenses(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!report) return
    setSaving(true)
    try {
      // Delete existing expenses for this report
      await supabase.from('expenses').delete().eq('report_id', report.id)

      // Insert new expenses
      const validExpenses = expenses
        .filter(exp => exp.description && exp.amount > 0)
        .map(exp => ({
          report_id: report.id,
          description: exp.description,
          amount: exp.amount,
          paid_from: exp.paid_from,
        }))

      if (validExpenses.length > 0) {
        const { error } = await supabase.from('expenses').insert(validExpenses)
        if (error) throw error
      }

      toast.success('Expenses saved!')
      fetchReportAndExpenses(selectedDate)
    } catch (error: any) {
      console.error('Error saving expenses:', error)
      toast.error(error.message || 'Failed to save expenses')
    } finally {
      setSaving(false)
    }
  }

  // Account balances: what was received minus what was spent
  const accountBalances = ACCOUNTS.map(account => {
    const received = Number(report?.[account.key] ?? 0)
    const spent = expenses
      .filter(e => e.paid_from === account.key)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    return { ...account, received, spent, balance: received - spent }
  })

  const totalExpenses = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)

  return (
    <ProtectedRoute allowedRoles={['employee']}>
      <DashboardLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-gray-600 dark:text-gray-400">Record expenses paid from your accounts for the day.</p>
        </div>

        {/* Account Balance Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {accountBalances.map((account) => (
            <div key={account.key} className={`rounded-xl border p-4 ${account.bgColor}`}>
              <div className="flex items-center gap-2 mb-2">
                <AccountIcon type={account.key} className={account.iconColor} />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{account.label}</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Received</div>
              <div className={`text-lg font-bold ${account.color}`}>{account.received.toLocaleString()}</div>
              {account.spent > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Spent</span>
                    <span className="text-red-500 dark:text-red-400">-{account.spent.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold mt-1">
                    <span className="text-gray-600 dark:text-gray-300">Balance</span>
                    <span className={account.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {account.balance.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Date Picker */}
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field"
              />
            </div>
            {report && (
              <div className="flex-1 text-right">
                <span className="text-sm text-gray-500 dark:text-gray-400">Report Total Sales:</span>
                <span className="ml-2 font-semibold text-gray-900 dark:text-white">{Number(report.total_sales).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="card text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-500 dark:text-gray-400 mt-3">Loading...</p>
          </div>
        ) : noReport ? (
          <div className="card text-center py-8">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">No sales report found for this date.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Create a daily report first from the Dashboard, then come back to add expenses.</p>
          </div>
        ) : (
          <>
            {/* Expenses List */}
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold dark:text-white">Expenses for {format(new Date(selectedDate), 'MMM dd, yyyy')}</h2>
                <button type="button" onClick={addExpense} className="btn-secondary text-sm">+ Add Expense</button>
              </div>

              {expenses.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">No expenses yet. Click &quot;+ Add Expense&quot; to get started.</p>
              ) : (
                <div className="space-y-3">
                  {expenses.map((expense, index) => (
                    <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex gap-3 items-start">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Description</label>
                          <input
                            type="text"
                            value={expense.description}
                            onChange={(e) => updateExpense(index, 'description', e.target.value)}
                            className="input-field"
                            placeholder="What was this expense for?"
                          />
                        </div>
                        <div className="w-32">
                          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={expense.amount || ''}
                            onChange={(e) => updateExpense(index, 'amount', parseFloat(e.target.value) || 0)}
                            className="input-field"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="w-44">
                          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Paid From</label>
                          <select
                            value={expense.paid_from}
                            onChange={(e) => updateExpense(index, 'paid_from', e.target.value)}
                            className="input-field"
                          >
                            {ACCOUNTS.map((account) => (
                              <option key={account.key} value={account.key}>
                                {account.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="pt-5">
                          <button
                            type="button"
                            onClick={() => removeExpense(index)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {expenses.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <p className="font-semibold dark:text-white">Total Expenses: <span className="text-red-600 dark:text-red-400">{totalExpenses.toLocaleString()}</span></p>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary px-6"
                  >
                    {saving ? 'Saving...' : 'Save Expenses'}
                  </button>
                </div>
              )}

              {expenses.length === 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary px-6"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
