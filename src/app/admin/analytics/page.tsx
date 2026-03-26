'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { DailyReport, Profile } from '@/types'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import toast from 'react-hot-toast'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'

export default function AdminAnalytics() {
  const supabase = createClient()
  const { selectedOrg } = useOrganization()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<DailyReport[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch last 30 days of reports
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

      let reportsQuery = supabase
        .from('daily_reports')
        .select(`
          *,
          profiles!daily_reports_user_id_fkey (id, email, full_name),
          expenses (*),
          unpaid_bills (*)
        `)
        .gte('report_date', thirtyDaysAgo)
        .order('report_date', { ascending: true })

      let employeesQuery = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'employee')

      if (selectedOrg) {
        reportsQuery = reportsQuery.eq('organization_id', selectedOrg.id)
        employeesQuery = employeesQuery.eq('organization_id', selectedOrg.id)
      }

      const [reportsRes, employeesRes] = await Promise.all([
        reportsQuery,
        employeesQuery
      ])

      if (reportsRes.error) throw reportsRes.error
      if (employeesRes.error) throw employeesRes.error

      setReports(reportsRes.data || [])
      setEmployees(employeesRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedOrg?.id])

  // Calculate analytics
  const totalSales = reports.reduce((sum, r) => sum + Number(r.total_sales), 0)
  const totalCash = reports.reduce((sum, r) => sum + Number(r.cash_at_hand), 0)
  const totalExpenses = reports.reduce((sum, r) => sum + (r.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0), 0)
  const totalUnpaid = reports.reduce((sum, r) => sum + (r.unpaid_bills?.reduce((s, b) => s + Number(b.amount), 0) || 0), 0)
  
  const avgDailySales = reports.length > 0 ? totalSales / reports.length : 0
  
  // Payment method breakdown
  const paymentBreakdown = {
    airtel: reports.reduce((sum, r) => sum + Number(r.airtel_money), 0),
    mtn: reports.reduce((sum, r) => sum + Number(r.mtn_money), 0),
    visa: reports.reduce((sum, r) => sum + Number(r.visa_card), 0),
    cash: totalCash
  }

  // Top performing employees
  const employeePerformance = employees.map(emp => {
    const empReports = reports.filter(r => r.user_id === emp.id)
    return {
      ...emp,
      totalSales: empReports.reduce((sum, r) => sum + Number(r.total_sales), 0),
      reportCount: empReports.length
    }
  }).sort((a, b) => b.totalSales - a.totalSales)

  // Daily trend (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
    const dayReports = reports.filter(r => r.report_date === date)
    return {
      date,
      label: format(subDays(new Date(), 6 - i), 'EEE'),
      sales: dayReports.reduce((sum, r) => sum + Number(r.total_sales), 0)
    }
  })

  const maxDailySales = Math.max(...last7Days.map(d => d.sales), 1)

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <DashboardLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Sales performance and insights (Last 30 days)</p>
        </div>

        {loading ? (
          <div className="card text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600">Total Sales</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{totalSales.toLocaleString()}</p>
              </div>
              
              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600">Avg Daily</p>
                </div>
                <p className="text-2xl font-bold text-primary-600">{avgDailySales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              
              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600">Expenses</p>
                </div>
                <p className="text-2xl font-bold text-red-600">{totalExpenses.toLocaleString()}</p>
              </div>
              
              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600">Unpaid Bills</p>
                </div>
                <p className="text-2xl font-bold text-amber-600">{totalUnpaid.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Sales Trend */}
              <div className="card">
                <h3 className="font-semibold mb-6">Sales Trend (Last 7 Days)</h3>
                <div className="flex items-end justify-between gap-2 h-48">
                  {last7Days.map((day) => (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full bg-gray-100 rounded-t-lg relative flex-1 flex items-end">
                        <div
                          className="w-full bg-primary-500 rounded-t-lg transition-all duration-500"
                          style={{ height: `${(day.sales / maxDailySales) * 100}%`, minHeight: day.sales > 0 ? '8px' : '0' }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{day.label}</span>
                      <span className="text-xs font-medium">{(day.sales / 1000).toFixed(0)}k</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Methods */}
              <div className="card">
                <h3 className="font-semibold mb-6">Payment Methods</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Cash at Hand</span>
                      <span className="font-medium">{paymentBreakdown.cash.toLocaleString()}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${(paymentBreakdown.cash / totalSales) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">MTN Mobile Money</span>
                      <span className="font-medium">{paymentBreakdown.mtn.toLocaleString()}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${(paymentBreakdown.mtn / totalSales) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Airtel Money</span>
                      <span className="font-medium">{paymentBreakdown.airtel.toLocaleString()}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${(paymentBreakdown.airtel / totalSales) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Visa Card</span>
                      <span className="font-medium">{paymentBreakdown.visa.toLocaleString()}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(paymentBreakdown.visa / totalSales) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Employee Performance */}
            <div className="card">
              <h3 className="font-semibold mb-6">Employee Performance</h3>
              {employeePerformance.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No employee data available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase border-b">
                        <th className="text-left pb-3">Rank</th>
                        <th className="text-left pb-3">Employee</th>
                        <th className="text-right pb-3">Reports</th>
                        <th className="text-right pb-3">Total Sales</th>
                        <th className="text-right pb-3">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {employeePerformance.map((emp, index) => (
                        <tr key={emp.id}>
                          <td className="py-3">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                <span className="text-primary-700 font-medium text-sm">
                                  {emp.full_name?.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-medium">{emp.full_name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-right text-gray-600">{emp.reportCount}</td>
                          <td className="py-3 text-right font-medium">{emp.totalSales.toLocaleString()}</td>
                          <td className="py-3 text-right">
                            <div className="w-24 ml-auto">
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary-500 rounded-full"
                                  style={{ width: `${employeePerformance[0].totalSales > 0 ? (emp.totalSales / employeePerformance[0].totalSales) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
