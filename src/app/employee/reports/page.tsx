'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase'
import { DailyReport } from '@/types'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import toast from 'react-hot-toast'
import {
  format, parseISO, isWithinInterval,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks,
} from 'date-fns'
import Link from 'next/link'

type FilterPeriod = 'all' | 'this_week' | 'last_week' | 'this_month' | 'custom'

export default function EmployeeReports() {
  const { user } = useAuth()
  const supabase = createClient()
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

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

  const filteredReports = useMemo(() => {
    const today = new Date()
    let from: Date, to: Date

    if (filterPeriod === 'this_week') {
      from = startOfWeek(today, { weekStartsOn: 1 })
      to = endOfWeek(today, { weekStartsOn: 1 })
    } else if (filterPeriod === 'last_week') {
      const last = subWeeks(today, 1)
      from = startOfWeek(last, { weekStartsOn: 1 })
      to = endOfWeek(last, { weekStartsOn: 1 })
    } else if (filterPeriod === 'this_month') {
      from = startOfMonth(today)
      to = endOfMonth(today)
    } else if (filterPeriod === 'custom' && customFrom && customTo) {
      from = new Date(customFrom)
      to = new Date(customTo)
    } else {
      return reports
    }

    return reports.filter(r => isWithinInterval(parseISO(r.report_date), { start: from, end: to }))
  }, [reports, filterPeriod, customFrom, customTo])

  const filterLabel = useMemo(() => {
    const today = new Date()
    if (filterPeriod === 'this_week') {
      const from = startOfWeek(today, { weekStartsOn: 1 })
      const to = endOfWeek(today, { weekStartsOn: 1 })
      return `${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`
    }
    if (filterPeriod === 'last_week') {
      const last = subWeeks(today, 1)
      const from = startOfWeek(last, { weekStartsOn: 1 })
      const to = endOfWeek(last, { weekStartsOn: 1 })
      return `${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`
    }
    if (filterPeriod === 'this_month') return format(today, 'MMMM yyyy')
    if (filterPeriod === 'custom' && customFrom && customTo)
      return `${format(new Date(customFrom), 'MMM d')} – ${format(new Date(customTo), 'MMM d, yyyy')}`
    return null
  }, [filterPeriod, customFrom, customTo])

  const totalSales = filteredReports.reduce((s, r) => s + Number(r.total_sales), 0)
  const totalExpenses = filteredReports.reduce((s, r) => s + (r.expenses?.reduce((e, x) => e + Number(x.amount), 0) || 0), 0)
  const totalUnpaid = filteredReports.reduce((s, r) => s + (r.unpaid_bills?.reduce((e, x) => e + Number(x.amount), 0) || 0), 0)
  const totalCash = filteredReports.reduce((s, r) => s + Number(r.cash_at_hand), 0)

  const exportPDF = () => {
    const date = new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })
    const rows = filteredReports.map(r => {
      const expenses = r.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0
      const unpaid = r.unpaid_bills?.reduce((s, b) => s + Number(b.amount), 0) || 0
      return `<tr>
        <td>${format(new Date(r.report_date), 'MMM dd, yyyy')}</td>
        <td>${format(new Date(r.report_date), 'EEEE')}</td>
        <td style="text-align:right;font-weight:600">${Number(r.total_sales).toLocaleString()}</td>
        <td style="text-align:right;color:#16a34a">${Number(r.cash_at_hand).toLocaleString()}</td>
        <td style="text-align:right;color:#d97706">${expenses.toLocaleString()}</td>
        <td style="text-align:right;color:#dc2626">${unpaid.toLocaleString()}</td>
        <td style="text-align:center;font-size:10px;font-weight:600;color:${r.is_edited ? '#d97706' : '#16a34a'}">${r.is_edited ? 'EDITED' : 'ORIGINAL'}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>My Sales Reports – SEIV</title>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#111;padding:36px;max-width:900px;margin:0 auto}
  h1{font-size:22px;color:#0C2340;margin-bottom:4px;font-weight:700}
  .sub{font-size:11px;color:#666;margin-bottom:22px}
  .cards{display:flex;gap:14px;margin-bottom:26px;flex-wrap:wrap}
  .card{background:#f4f8ff;border-radius:8px;padding:11px 16px;min-width:120px;border:1px solid #e2e8f0}
  .card-label{font-size:9px;color:#666;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em}
  .card-val{font-size:18px;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;padding:8px 10px;background:#0C2340;color:#fff;font-size:11px;font-weight:600}
  th.r{text-align:right}th.c{text-align:center}
  td{padding:7px 10px;border-bottom:1px solid #eee}
  tr:last-child td{border-bottom:none}
  tr:nth-child(even) td{background:#fafafa}
  .footer{margin-top:26px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px;text-align:center}
  .print-btn{display:inline-flex;align-items:center;gap:8px;margin-bottom:22px;padding:9px 20px;background:#0C2340;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  .print-btn:hover{background:#1E4A7A}
  @media print{.print-btn{display:none!important}body{padding:16px}@page{margin:12mm}}
</style></head>
<body>
<button class="print-btn" onclick="window.print()">&#128438; Save as PDF / Print</button>
<h1>My Daily Sales Reports</h1>
<div class="sub">SEIV Point of Sale &middot; Generated ${date}</div>
<div class="cards">
  <div class="card"><div class="card-label">Total Reports</div><div class="card-val">${filteredReports.length}</div></div>
  <div class="card"><div class="card-label">Total Sales</div><div class="card-val" style="color:#16a34a">${totalSales.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Cash at Hand</div><div class="card-val" style="color:#059669">${totalCash.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Total Expenses</div><div class="card-val" style="color:#d97706">${totalExpenses.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Credit Sales</div><div class="card-val" style="color:#dc2626">${totalUnpaid.toLocaleString()} UGX</div></div>
</div>
<table>
  <thead><tr><th>Date</th><th>Day</th><th class="r">Total Sales</th><th class="r">Cash at Hand</th><th class="r">Expenses</th><th class="r">Credit Sales</th><th class="c">Status</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">SEIV &middot; This is a system-generated report.</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});</script>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'width=960,height=720')
    if (!win) { toast.error('Allow popups to export PDF'); URL.revokeObjectURL(url); return }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const emailSummary = () => {
    const periodStr = filterLabel ? `Period: ${filterLabel}\n` : ''
    const subject = encodeURIComponent('My Sales Reports Summary · SEIV')
    const body = encodeURIComponent(
      `My Daily Sales Reports – SEIV Bar & Restaurant\n` +
      `Generated: ${new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })}\n` +
      periodStr + '\n' +
      `Total Reports:   ${filteredReports.length}\n` +
      `Total Sales:     UGX ${totalSales.toLocaleString()}\n` +
      `Cash at Hand:    UGX ${totalCash.toLocaleString()}\n` +
      `Total Expenses:  UGX ${totalExpenses.toLocaleString()}\n` +
      `Credit Sales:    UGX ${totalUnpaid.toLocaleString()}\n` +
      `Edited Reports:  ${filteredReports.filter(r => r.is_edited).length}\n\n` +
      `Powered by SEIV · SEIV`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  return (
    <ProtectedRoute allowedRoles={['employee']}>
      <DashboardLayout>
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Reports</h1>
            <p className="text-gray-500">View all your submitted daily sales reports</p>
          </div>
          {filteredReports.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={emailSummary} className="btn-secondary flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </button>
              <button onClick={exportPDF} className="btn-secondary flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export PDF
              </button>
            </div>
          )}
        </div>

        {/* Filter bar */}
        <div className="card mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: 'all', label: 'All Time' },
              { key: 'this_week', label: 'This Week' },
              { key: 'last_week', label: 'Last Week' },
              { key: 'this_month', label: 'This Month' },
              { key: 'custom', label: 'Custom' },
            ] as { key: FilterPeriod; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterPeriod(key)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  filterPeriod === key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}

            {filterLabel && (
              <span className="ml-auto text-xs text-gray-400 font-medium">{filterLabel}</span>
            )}
          </div>

          {filterPeriod === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-medium whitespace-nowrap">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="input-field text-sm py-1.5"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-medium whitespace-nowrap">To</label>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={e => setCustomTo(e.target.value)}
                  className="input-field text-sm py-1.5"
                />
              </div>
              {customFrom && customTo && (
                <button
                  onClick={() => { setCustomFrom(''); setCustomTo('') }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <p className="text-sm text-gray-500">Reports</p>
            <p className="text-2xl font-bold text-gray-900">{filteredReports.length}</p>
            {filterPeriod !== 'all' && <p className="text-xs text-gray-400 mt-0.5">of {reports.length} total</p>}
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Total Sales</p>
            <p className="text-2xl font-bold text-green-600">{totalSales.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Total Cash at Hand</p>
            <p className="text-2xl font-bold text-emerald-600">{totalCash.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Edited Reports</p>
            <p className="text-2xl font-bold text-amber-600">
              {filteredReports.filter(r => r.is_edited).length}
            </p>
          </div>
        </div>

        {/* Reports Table */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">Report History</h2>
            <Link href="/employee/dashboard" className="btn-primary">
              + New Report
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading reports...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {reports.length === 0 ? (
                <>
                  <p className="text-gray-400 mb-4">No reports yet</p>
                  <Link href="/employee/dashboard" className="btn-primary">Create Your First Report</Link>
                </>
              ) : (
                <>
                  <p className="text-gray-400 mb-2">No reports found for this period</p>
                  <button onClick={() => setFilterPeriod('all')} className="text-sm text-emerald-600 hover:underline">
                    Clear filter
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total Sales</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Cash at Hand</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Expenses</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Unpaid Bills</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReports.map((report) => {
                    const expenses = report.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
                    const unpaid = report.unpaid_bills?.reduce((sum, b) => sum + Number(b.amount), 0) || 0
                    
                    return (
                      <tr key={report.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium">
                            {format(new Date(report.report_date), 'MMM dd, yyyy')}
                          </span>
                          <span className="block text-xs text-gray-400">
                            {format(new Date(report.report_date), 'EEEE')}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right font-medium">
                          {Number(report.total_sales).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-green-600">
                          {Number(report.cash_at_hand).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-red-600">
                          {expenses.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-amber-600">
                          {unpaid.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {report.is_edited ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edited
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full">
                              Original
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <Link
                            href={`/employee/dashboard?date=${report.report_date}`}
                            className="text-emerald-600 hover:text-emerald-800 font-medium text-sm"
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
        {filteredReports.some(r => r.admin_comment) && (
          <div className="card mt-6">
            <h2 className="text-lg font-semibold mb-4">Admin Comments</h2>
            <div className="space-y-3">
              {filteredReports.filter(r => r.admin_comment).map((report) => (
                <div key={report.id} className="p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm text-blue-900">
                      {format(new Date(report.report_date), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <p className="text-sm text-blue-800">{report.admin_comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
