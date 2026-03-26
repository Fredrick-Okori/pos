'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { DailyReport, Profile } from '@/types'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import toast from 'react-hot-toast'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export default function AdminReports() {
  const supabase = createClient()
  const { selectedOrg } = useOrganization()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<DailyReport[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  })

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

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Employee', 'Total Sales', 'Airtel Money', 'MTN Money', 'Visa Card', 'Complementaries', 'Discounts', 'Cash at Hand', 'Expenses', 'Unpaid Bills']
    const rows = reports.map(r => [
      r.report_date,
      (r as any).profiles?.full_name || 'Unknown',
      r.total_sales,
      r.airtel_money,
      r.mtn_money,
      r.visa_card,
      r.complementaries,
      r.discounts,
      r.cash_at_hand,
      r.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0,
      r.unpaid_bills?.reduce((sum, b) => sum + Number(b.amount), 0) || 0
    ])

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reports-${dateRange.start}-to-${dateRange.end}.csv`
    a.click()
  }

  const summary = reports.reduce((acc, report) => ({
    totalSales: acc.totalSales + Number(report.total_sales),
    cashAtHand: acc.cashAtHand + Number(report.cash_at_hand),
    expenses: acc.expenses + (report.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0),
    unpaidBills: acc.unpaidBills + (report.unpaid_bills?.reduce((sum, b) => sum + Number(b.amount), 0) || 0)
  }), { totalSales: 0, cashAtHand: 0, expenses: 0, unpaidBills: 0 })

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <DashboardLayout>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Reports</h1>
            <p className="text-gray-600">View and export all employee sales reports</p>
          </div>
          <button onClick={exportToCSV} className="btn-primary">
            Export CSV
          </button>
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
                <button onClick={() => setQuickFilter('today')} className="btn-secondary text-xs px-3 py-2">Today</button>
                <button onClick={() => setQuickFilter('thisMonth')} className="btn-secondary text-xs px-3 py-2">This Month</button>
                <button onClick={() => setQuickFilter('lastMonth')} className="btn-secondary text-xs px-3 py-2">Last Month</button>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <p className="text-sm text-gray-600">Total Sales</p>
            <p className="text-2xl font-bold text-gray-900">{summary.totalSales.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Cash at Hand</p>
            <p className="text-2xl font-bold text-green-600">{summary.cashAtHand.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600">{summary.expenses.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Unpaid Bills</p>
            <p className="text-2xl font-bold text-amber-600">{summary.unpaidBills.toLocaleString()}</p>
          </div>
        </div>

        {/* Reports Table */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Reports ({reports.length})</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No reports found for the selected criteria.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cash at Hand</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expenses</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unpaid</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report) => {
                    const expenses = report.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
                    const unpaid = report.unpaid_bills?.reduce((sum, b) => sum + Number(b.amount), 0) || 0
                    
                    return (
                      <tr key={report.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          {format(new Date(report.report_date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {(report as any).profiles?.full_name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                          {Number(report.total_sales).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-600">
                          {Number(report.cash_at_hand).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600">
                          {expenses.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-amber-600">
                          {unpaid.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {report.is_edited ? (
                            <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">Edited</span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Original</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
