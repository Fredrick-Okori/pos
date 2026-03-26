'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase'
import { DailyReport } from '@/types'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import Link from 'next/link'

export default function EmployeeReports() {
  const { user } = useAuth()
  const supabase = createClient()
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReports = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select(`
          *,
          expenses (*),
          unpaid_bills (*)
        `)
        .eq('user_id', user.id)
        .order('report_date', { ascending: false })

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
    fetchReports()
  }, [user])

  return (
    <ProtectedRoute allowedRoles={['employee']}>
      <DashboardLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Reports</h1>
          <p className="text-gray-600 dark:text-gray-400">View all your submitted daily sales reports</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Reports</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{reports.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Sales</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {reports.reduce((sum, r) => sum + Number(r.total_sales), 0).toLocaleString()}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Cash at Hand</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {reports.reduce((sum, r) => sum + Number(r.cash_at_hand), 0).toLocaleString()}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600 dark:text-gray-400">Edited Reports</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {reports.filter(r => r.is_edited).length}
            </p>
          </div>
        </div>

        {/* Reports Table */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold dark:text-white">Report History</h2>
            <Link href="/employee/dashboard" className="btn-primary">
              + New Report
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 mb-4">No reports yet</p>
              <Link href="/employee/dashboard" className="btn-primary">
                Create Your First Report
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Sales</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cash at Hand</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expenses</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unpaid Bills</th>
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium dark:text-white">
                            {format(new Date(report.report_date), 'MMM dd, yyyy')}
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {format(new Date(report.report_date), 'EEEE')}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right font-medium dark:text-white">
                          {Number(report.total_sales).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-green-600 dark:text-green-400">
                          {Number(report.cash_at_hand).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-red-600 dark:text-red-400">
                          {expenses.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-amber-600 dark:text-amber-400">
                          {unpaid.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {report.is_edited ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edited
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full">
                              Original
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <Link
                            href={`/employee/dashboard?date=${report.report_date}`}
                            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-medium text-sm"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Admin Comments Section */}
        {reports.some(r => r.admin_comment) && (
          <div className="card mt-6">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">Admin Comments</h2>
            <div className="space-y-3">
              {reports.filter(r => r.admin_comment).map((report) => (
                <div key={report.id} className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm text-blue-900 dark:text-blue-300">
                      {format(new Date(report.report_date), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-400">{report.admin_comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
