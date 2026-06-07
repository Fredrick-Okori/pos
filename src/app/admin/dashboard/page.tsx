'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase'
import { DailyReport, Profile } from '@/types'
import { ACCOUNTS, AccountIcon } from '@/lib/accounts'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import toast from 'react-hot-toast'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import Link from 'next/link'
import EditReportModal from '@/components/EditReportModal'

export default function AdminDashboard() {
  const { user } = useAuth()
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

  // Unpaid balances (all-time, grouped by customer)
  const [unpaidGroups, setUnpaidGroups] = useState<{ name: string; total: number; count: number }[]>([])
  const [unpaidTotal, setUnpaidTotal] = useState(0)
  const [loadingUnpaid, setLoadingUnpaid] = useState(true)

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

  const fetchUnpaidBalances = async () => {
    setLoadingUnpaid(true)
    try {
      let query = supabase
        .from('unpaid_bills')
        .select(`
          customer_name,
          amount,
          daily_reports!inner (
            report_date,
            organization_id
          )
        `)
        .order('created_at', { ascending: false })

      if (selectedOrg) {
        query = query.eq('daily_reports.organization_id', selectedOrg.id)
      }

      const { data, error } = await query
      if (error) {
        console.error('Unpaid balances query error:', JSON.stringify(error))
        throw error
      }

      const groupMap: Record<string, { name: string; total: number; count: number }> = {}
      for (const bill of (data || []) as any[]) {
        const key = (bill.customer_name as string).toLowerCase()
        if (!groupMap[key]) groupMap[key] = { name: bill.customer_name, total: 0, count: 0 }
        groupMap[key].total += Number(bill.amount)
        groupMap[key].count += 1
      }

      const groups = Object.values(groupMap).sort((a, b) => b.total - a.total)
      setUnpaidGroups(groups)
      setUnpaidTotal(groups.reduce((s, g) => s + g.total, 0))
    } catch (err) {
      console.error('Error fetching unpaid balances:', err)
      toast.error('Failed to fetch unpaid bills')
    } finally {
      setLoadingUnpaid(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [selectedOrg?.id])

  useEffect(() => {
    fetchReports()
  }, [selectedEmployee, dateRange, selectedOrg?.id])

  useEffect(() => {
    fetchUnpaidBalances()
  }, [selectedOrg?.id])

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

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sales reports across all employees</p>
        </div>

        {/* Filters */}
        <div className="card mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Employee</label>
              <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className="input-field">
                <option value="all">All Employees</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">From</label>
              <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 mr-1">Quick:</span>
            {[
              { key: 'today', label: 'Today' },
              { key: 'thisMonth', label: 'This Month' },
              { key: 'lastMonth', label: 'Last Month' },
            ].map(f => (
              <button key={f.key} onClick={() => setQuickFilter(f.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: 'rgba(12,35,64,.07)', color: '#0C2340' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        {(() => {
          const totalReceived = summary.airtelMoney + summary.mtnMoney + summary.visaCard + summary.cash
          const cashAtHand = summary.totalSales - summary.expenses
          const cashPositive = cashAtHand >= 0
          const stats = [
            {
              label: 'Total Sales',
              value: summary.totalSales,
              iconBg: '#0C2340',
              valueColor: '#0C2340',
              icon: (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              ),
            },
            {
              label: 'Total Received',
              value: totalReceived,
              iconBg: '#059669',
              valueColor: '#059669',
              icon: (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              ),
            },
            {
              label: 'Expenses',
              value: summary.expenses,
              iconBg: '#dc2626',
              valueColor: '#dc2626',
              icon: (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              ),
            },
            {
              label: 'Invoices',
              value: summary.unpaidBills,
              iconBg: '#d97706',
              valueColor: '#d97706',
              icon: (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ),
            },
            {
              label: 'Cash at Hand',
              value: cashAtHand,
              iconBg: cashPositive ? '#059669' : '#dc2626',
              valueColor: cashPositive ? '#059669' : '#dc2626',
              icon: cashPositive ? (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              ),
            },
          ]
          return (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              {stats.map(stat => (
                <div key={stat.label} className="rounded-2xl p-5 flex items-center gap-4" style={{ background: '#f0f0f0', border: '1px solid rgba(0,0,0,.1)' }}>
                  <div className="shrink-0 flex items-center justify-center w-14 h-14 rounded-xl shadow-sm" style={{ background: stat.iconBg }}>
                    {stat.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-500 leading-tight">{stat.label}</p>
                    <p className="text-2xl font-black leading-tight mt-0.5" style={{ color: stat.valueColor }}>
                      {stat.value.toLocaleString()}
                    </p>
                    <p className="text-xs font-semibold text-gray-400 tracking-wider">UGX</p>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Payment Breakdown */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Payment Breakdown</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {ACCOUNTS.map((account) => {
              const accountValues: Record<string, number> = {
                airtel_money: summary.airtelMoney,
                mtn_money: summary.mtnMoney,
                visa_card: summary.visaCard,
                cash: summary.cash,
              }
              const value = accountValues[account.key] ?? 0
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
                  </div>
                </div>
              )
            })}
          </div>
        </div>

          {/* Outstanding Unpaid Balances */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Outstanding Unpaid Balances</h2>
                <p className="text-xs text-gray-400 mt-0.5">All-time — across all reports</p>
              </div>
              <Link
                href="/admin/unpaid-bills"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'rgba(245,158,11,.1)', color: '#b45309', border: '1px solid rgba(245,158,11,.25)' }}
              >
                View All →
              </Link>
            </div>

            {loadingUnpaid ? (
              <div className="flex items-center gap-3 py-4 text-gray-400">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-500" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : unpaidGroups.length === 0 ? (
              <div className="flex items-center gap-3 py-4">
                <svg className="w-8 h-8 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-400">No unpaid balances on record.</p>
              </div>
            ) : (
              <>
                {/* Total banner */}
                <div className="flex items-center justify-between p-3 rounded-xl mb-4"
                  style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}>
                  <div>
                    <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">Total Outstanding</p>
                    <p className="text-2xl font-bold font-mono text-amber-700">{unpaidTotal.toLocaleString()} <span className="text-sm font-normal">UGX</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-amber-700">{unpaidGroups.length} client{unpaidGroups.length !== 1 ? 's' : ''} with balance</p>
                  </div>
                </div>

                {/* Top customers table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                        <th className="text-left pb-2 font-medium">Client</th>
                        <th className="text-center pb-2 font-medium">Bills</th>
                        <th className="text-right pb-2 font-medium">Amount Owed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {unpaidGroups.slice(0, 8).map(group => (
                        <tr key={group.name} className="hover:bg-amber-50/40 transition-colors">
                          <td className="py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 text-white font-bold text-xs">
                                {group.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <span className="font-medium text-gray-900">{group.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-center text-gray-500">{group.count}</td>
                          <td className="py-2.5 text-right font-bold font-mono text-amber-600">
                            {group.total.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {unpaidGroups.length > 8 && (
                    <p className="text-xs text-gray-400 text-center mt-3">
                      +{unpaidGroups.length - 8} more clients —{' '}
                      <Link href="/admin/unpaid-bills" className="text-amber-600 hover:underline">view all</Link>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

        {/* Reports Table */}
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <h2 className="text-base font-semibold text-gray-900">Daily Reports</h2>
            <p className="text-xs text-gray-400 mt-0.5">{reports.length} report{reports.length !== 1 ? 's' : ''} in range</p>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
              <p className="mt-3 text-sm text-gray-500">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-14">
              <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-gray-400">No reports found for the selected criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Sales</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Cash at Hand</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Expenses</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Unpaid</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reports.map(report => {
                    const expenses = report.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
                    const unpaid = report.unpaid_bills?.reduce((sum, b) => sum + Number(b.amount), 0) || 0
                    return (
                      <tr key={report.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {format(new Date(report.report_date), 'MMM dd, yyyy')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                              style={{ background: 'linear-gradient(135deg,#1E4A7A,#0C2340)' }}>
                              {((report as any).profiles?.full_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-700">{(report as any).profiles?.full_name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <span className="text-sm font-semibold font-mono text-gray-900">{Number(report.total_sales).toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <span className="text-sm font-mono font-semibold text-emerald-600">{Number(report.cash_at_hand).toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <span className="text-sm font-mono text-red-500">{expenses.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <span className="text-sm font-mono text-amber-600">{unpaid.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          {report.is_edited ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                              Edited
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                              Original
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <button onClick={() => openEditModal(report)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                            style={{ background: 'rgba(12,35,64,.06)', color: '#0C2340', border: '1px solid rgba(12,35,64,.15)' }}>
                            View / Edit
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
