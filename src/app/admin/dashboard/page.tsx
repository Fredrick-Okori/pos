'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase'
import { DailyReport, Profile } from '@/types'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import toast from 'react-hot-toast'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export default function AdminDashboard() {
  const { user, profile } = useAuth()
  const { selectedOrg } = useOrganization()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<DailyReport[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  })
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Fetch employees
  const fetchEmployees = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'employee')
        .order('full_name')

      if (selectedOrg) {
        query = query.eq('organization_id', selectedOrg.id)
      }

      const { data, error } = await query

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  // Fetch reports
  const fetchReports = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('daily_reports')
        .select(`
          *,
          profiles!daily_reports_user_id_fkey (id, email, full_name),
          expenses (*),
          unpaid_bills (*)
        `)
        .gte('report_date', dateRange.start)
        .lte('report_date', dateRange.end)
        .order('report_date', { ascending: false })

      if (selectedOrg) {
        query = query.eq('organization_id', selectedOrg.id)
      }

      if (selectedEmployee !== 'all') {
        query = query.eq('user_id', selectedEmployee)
      }

      const { data, error } = await query

      if (error) throw error
      setReports(data || [])
    } catch (error) {
      console.error('Error fetching reports:', error)
      toast.error('Failed to fetch reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [selectedOrg?.id])

  useEffect(() => {
    fetchReports()
  }, [selectedEmployee, dateRange, selectedOrg?.id])

  // Calculate summary statistics
  const summary = reports.reduce((acc, report) => ({
    totalSales: acc.totalSales + Number(report.total_sales),
    airtelMoney: acc.airtelMoney + Number(report.airtel_money),
    mtnMoney: acc.mtnMoney + Number(report.mtn_money),
    visaCard: acc.visaCard + Number(report.visa_card),
    complementaries: acc.complementaries + Number(report.complementaries),
    discounts: acc.discounts + Number(report.discounts),
    cash: acc.cash + Number(report.cash),
    cashAtHand: acc.cashAtHand + Number(report.cash_at_hand),
    expenses: acc.expenses + (report.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0),
    unpaidBills: acc.unpaidBills + (report.unpaid_bills?.reduce((sum, b) => sum + Number(b.amount), 0) || 0)
  }), {
    totalSales: 0,
    airtelMoney: 0,
    mtnMoney: 0,
    visaCard: 0,
    cash: 0,
    complementaries: 0,
    discounts: 0,
    cashAtHand: 0,
    expenses: 0,
    unpaidBills: 0
  })

  // Quick date filters
  const setQuickFilter = (filter: string) => {
    const today = new Date()
    switch (filter) {
      case 'today':
        setDateRange({
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd')
        })
        break
      case 'thisMonth':
        setDateRange({
          start: format(startOfMonth(today), 'yyyy-MM-dd'),
          end: format(endOfMonth(today), 'yyyy-MM-dd')
        })
        break
      case 'lastMonth':
        const lastMonth = subMonths(today, 1)
        setDateRange({
          start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
          end: format(endOfMonth(lastMonth), 'yyyy-MM-dd')
        })
        break
    }
  }

  // Open edit modal
  const openEditModal = (report: DailyReport) => {
    setSelectedReport(report)
    setEditModalOpen(true)
  }

  // Save edited report
  const saveReport = async (updatedData: Partial<DailyReport>) => {
    if (!selectedReport || !user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('daily_reports')
        .update({
          ...updatedData,
          is_edited: true,
          edited_by: user.id,
          edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedReport.id)

      if (error) throw error

      toast.success('Report updated successfully!')
      setEditModalOpen(false)
      fetchReports()
    } catch (error: any) {
      console.error('Error updating report:', error)
      toast.error(error.message || 'Failed to update report')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <DashboardLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">View and manage all employee sales reports</p>
        </div>

          {/* Filters */}
          <div className="card mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Employee</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="input-field"
                >
                  <option value="all">All Employees</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="label">From Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="label">To Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="label">Quick Filters</label>
                <div className="flex gap-2">
                  <button onClick={() => setQuickFilter('today')} className="btn-secondary text-xs px-2 py-1">Today</button>
                  <button onClick={() => setQuickFilter('thisMonth')} className="btn-secondary text-xs px-2 py-1">This Month</button>
                  <button onClick={() => setQuickFilter('lastMonth')} className="btn-secondary text-xs px-2 py-1">Last Month</button>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            <div className="card">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalSales.toLocaleString()}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600 dark:text-gray-400">Cash at Hand</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.cashAtHand.toLocaleString()}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.expenses.toLocaleString()}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600 dark:text-gray-400">Unpaid Bills</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.unpaidBills.toLocaleString()}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600 dark:text-gray-400">Net Cash</p>
              <p className={`text-2xl font-bold ${summary.cashAtHand - summary.expenses >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {(summary.cashAtHand - summary.expenses).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card bg-red-50 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-400">Airtel Money</p>
              <p className="text-xl font-bold text-red-800 dark:text-red-300">{summary.airtelMoney.toLocaleString()}</p>
            </div>
            <div className="card bg-yellow-50 dark:bg-yellow-900/20">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">MTN Money</p>
              <p className="text-xl font-bold text-yellow-800 dark:text-yellow-300">{summary.mtnMoney.toLocaleString()}</p>
            </div>
            <div className="card bg-blue-50 dark:bg-blue-900/20">
              <p className="text-sm text-blue-700 dark:text-blue-400">Visa Card</p>
              <p className="text-xl font-bold text-blue-800 dark:text-blue-300">{summary.visaCard.toLocaleString()}</p>
            </div>
            <div className="card bg-green-50 dark:bg-green-900/20">
              <p className="text-sm text-green-700 dark:text-green-400">Cash</p>
              <p className="text-xl font-bold text-green-800 dark:text-green-300">{summary.cash.toLocaleString()}</p>
            </div>
            <div className="card bg-purple-50 dark:bg-purple-900/20">
              <p className="text-sm text-purple-700 dark:text-purple-400">Complementaries</p>
              <p className="text-xl font-bold text-purple-800 dark:text-purple-300">{summary.complementaries.toLocaleString()}</p>
            </div>
          </div>

          {/* Reports Table */}
          <div className="card overflow-hidden">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">Daily Reports</h2>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading reports...</p>
              </div>
            ) : reports.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No reports found for the selected criteria.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Employee</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Sales</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cash at Hand</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expenses</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unpaid</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reports.map((report) => {
                      const expenses = report.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
                      const unpaid = report.unpaid_bills?.reduce((sum, b) => sum + Number(b.amount), 0) || 0
                      
                      return (
                        <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm dark:text-gray-300">
                            {format(new Date(report.report_date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm dark:text-gray-300">
                            {(report as any).profiles?.full_name || 'Unknown'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium dark:text-white">
                            {Number(report.total_sales).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-emerald-600 dark:text-emerald-400">
                            {Number(report.cash_at_hand).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600 dark:text-red-400">
                            {expenses.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-amber-600 dark:text-amber-400">
                            {unpaid.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            {report.is_edited ? (
                              <span className="px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full">
                                Edited
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full">
                                Original
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <button
                              onClick={() => openEditModal(report)}
                              className="text-emerald-600 hover:text-emerald-800 font-medium text-sm"
                            >
                              View/Edit
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        {/* Edit Modal */}
        {editModalOpen && selectedReport && (
          <EditReportModal
            report={selectedReport}
            onClose={() => setEditModalOpen(false)}
            onSave={saveReport}
            saving={saving}
          />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}

// Edit Report Modal Component
interface EditModalProps {
  report: DailyReport
  onClose: () => void
  onSave: (data: Partial<DailyReport>) => void
  saving: boolean
}

function EditReportModal({ report, onClose, onSave, saving }: EditModalProps) {
  const [formData, setFormData] = useState({
    total_sales: report.total_sales,
    airtel_money: report.airtel_money,
    mtn_money: report.mtn_money,
    visa_card: report.visa_card,
    cash: report.cash,
    complementaries: report.complementaries,
    discounts: report.discounts,
    admin_comment: report.admin_comment || ''
  })

  const expenses = report.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
  const unpaidBills = report.unpaid_bills?.reduce((sum, b) => sum + Number(b.amount), 0) || 0
  const cashAtHand = Number(formData.total_sales) - Number(formData.airtel_money) - Number(formData.mtn_money) - 
                     Number(formData.visa_card) - Number(formData.cash) - Number(formData.complementaries) - Number(formData.discounts)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold dark:text-white">Report Details</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {format(new Date(report.report_date), 'MMMM dd, yyyy')} - {(report as any).profiles?.full_name}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Sales Data */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Total Sales</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total_sales}
                  onChange={(e) => setFormData(prev => ({ ...prev, total_sales: parseFloat(e.target.value) || 0 }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label"><span className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>Cash</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cash || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, cash: parseFloat(e.target.value) || 0 }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Airtel Money</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.airtel_money}
                  onChange={(e) => setFormData(prev => ({ ...prev, airtel_money: parseFloat(e.target.value) || 0 }))}
                  className="input-field"
                />
              </div>
            <div>
              <label className="label">MTN Money</label>
              <input
                type="number"
                step="0.01"
                value={formData.mtn_money}
                onChange={(e) => setFormData(prev => ({ ...prev, mtn_money: parseFloat(e.target.value) || 0 }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Visa Card</label>
              <input
                type="number"
                step="0.01"
                value={formData.visa_card}
                onChange={(e) => setFormData(prev => ({ ...prev, visa_card: parseFloat(e.target.value) || 0 }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Complementaries</label>
              <input
                type="number"
                step="0.01"
                value={formData.complementaries}
                onChange={(e) => setFormData(prev => ({ ...prev, complementaries: parseFloat(e.target.value) || 0 }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Discounts</label>
              <input
                type="number"
                step="0.01"
                value={formData.discounts}
                onChange={(e) => setFormData(prev => ({ ...prev, discounts: parseFloat(e.target.value) || 0 }))}
                className="input-field"
              />
            </div>
          </div>

          {/* Calculated Values */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold mb-3 dark:text-white">Calculated Values</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Cash at Hand</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{cashAtHand.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{expenses.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Net Cash</p>
                <p className={`text-lg font-bold ${cashAtHand - expenses >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {(cashAtHand - expenses).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Expenses List */}
          {report.expenses && report.expenses.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 dark:text-white">Expenses</h3>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <ul className="space-y-2">
                  {report.expenses.map((expense) => (
                    <li key={expense.id} className="flex justify-between text-sm">
                      <span className="dark:text-gray-300">{expense.description}</span>
                      <span className="font-medium dark:text-white">{Number(expense.amount).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Unpaid Bills List */}
          {report.unpaid_bills && report.unpaid_bills.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 dark:text-white">Unpaid Bills ({unpaidBills.toLocaleString()} total)</h3>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                <ul className="space-y-2">
                  {report.unpaid_bills.map((bill) => (
                    <li key={bill.id} className="flex justify-between text-sm">
                      <div>
                        <span className="font-medium dark:text-white">{bill.customer_name}</span>
                        {bill.notes && <span className="text-gray-600 dark:text-gray-400 ml-2">({bill.notes})</span>}
                      </div>
                      <span className="font-medium dark:text-white">{Number(bill.amount).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Admin Comment */}
          <div>
            <label className="label">Admin Comment</label>
            <textarea
              value={formData.admin_comment}
              onChange={(e) => setFormData(prev => ({ ...prev, admin_comment: e.target.value }))}
              className="input-field h-24"
              placeholder="Add a comment for the employee..."
            />
          </div>

          {/* Edit History */}
          {report.is_edited && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm">
              <p className="text-amber-800 dark:text-amber-300">
                <span className="font-medium">⚠️ This report was edited</span>
                {report.edited_at && (
                  <span className="ml-2">on {format(new Date(report.edited_at), 'MMM dd, yyyy HH:mm')}</span>
                )}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
