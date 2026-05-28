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
  const [reconFilter, setReconFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  })

  const fetchEmployees = async () => {
    try {
      let query = supabase.from('profiles').select('*').eq('role', 'employee').order('full_name')
      if (selectedOrg) query = query.eq('organization_id', selectedOrg.id)
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
        .select(`*, profiles!daily_reports_user_id_fkey (id, email, full_name), expenses (*), unpaid_bills (*)`)
        .gte('report_date', dateRange.start)
        .lte('report_date', dateRange.end)
        .order('report_date', { ascending: false })

      if (selectedOrg) query = query.eq('organization_id', selectedOrg.id)
      if (selectedEmployee !== 'all') query = query.eq('user_id', selectedEmployee)

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

  useEffect(() => { fetchEmployees() }, [selectedOrg?.id])
  useEffect(() => { fetchReports() }, [selectedEmployee, dateRange, selectedOrg?.id])

  const setQuickFilter = (filter: string) => {
    const today = new Date()
    if (filter === 'today') {
      setDateRange({ start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') })
    } else if (filter === 'thisMonth') {
      setDateRange({ start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(endOfMonth(today), 'yyyy-MM-dd') })
    } else if (filter === 'lastMonth') {
      const last = subMonths(today, 1)
      setDateRange({ start: format(startOfMonth(last), 'yyyy-MM-dd'), end: format(endOfMonth(last), 'yyyy-MM-dd') })
    }
  }

  const handleDelete = async (reportId: string, reportDate: string) => {
    if (!confirm(`Delete report for ${format(new Date(reportDate), 'MMM dd, yyyy')}? This cannot be undone.`)) return
    try {
      const { error } = await supabase.from('daily_reports').delete().eq('id', reportId)
      if (error) throw error
      toast.success('Report deleted')
      fetchReports()
    } catch (err: any) {
      console.error('Error deleting report:', err)
      toast.error(err.message || 'Failed to delete report')
    }
  }

  const exportPDF = () => {
    const date = new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })
    const rows = filteredReports.map(r => {
      const expenses = r.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0
      const credit = r.unpaid_bills?.reduce((s, b) => s + Number(b.amount), 0) || 0
      const diff = r.recon_diff || 0
      const diffStr = diff !== 0 ? (diff > 0 ? '+' : '') + diff.toLocaleString() : '–'
      const diffColor = diff > 0 ? '#d97706' : diff < 0 ? '#dc2626' : '#16a34a'
      const reconColor = r.recon_status === 'RECONCILED' ? '#16a34a' : r.recon_status === 'EXCESS' ? '#d97706' : '#dc2626'
      return `<tr>
        <td>${format(new Date(r.report_date), 'MMM dd, yyyy')}</td>
        <td>${(r as any).profiles?.full_name || 'Unknown'}</td>
        <td style="text-align:right;font-weight:600">${Number(r.total_sales).toLocaleString()}</td>
        <td style="text-align:right;color:#16a34a">${Number(r.cash).toLocaleString()}</td>
        <td style="text-align:right;color:#16a34a">${Number(r.airtel_money).toLocaleString()}</td>
        <td style="text-align:right;color:#16a34a">${Number(r.mtn_money).toLocaleString()}</td>
        <td style="text-align:right;color:#16a34a">${Number(r.visa_card).toLocaleString()}</td>
        <td style="text-align:right;color:#666">${Number(r.complementaries).toLocaleString()}</td>
        <td style="text-align:right;color:#666">${Number(r.discounts).toLocaleString()}</td>
        <td style="text-align:right;color:#d97706">${expenses.toLocaleString()}</td>
        <td style="text-align:right;color:#dc2626">${credit.toLocaleString()}</td>
        <td style="text-align:center;font-size:10px;font-weight:700;color:${reconColor}">${r.recon_status || '–'}</td>
        <td style="text-align:right;font-weight:600;color:${diffColor}">${diffStr}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Daily Sales Reports – SEIV</title>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#111;padding:32px;max-width:1100px;margin:0 auto}
  h1{font-size:22px;color:#0C2340;margin-bottom:4px;font-weight:700}
  .sub{font-size:11px;color:#666;margin-bottom:20px}
  .cards{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}
  .card{background:#f4f8ff;border-radius:8px;padding:10px 16px;min-width:120px;border:1px solid #e2e8f0}
  .card-label{font-size:9px;color:#666;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em}
  .card-val{font-size:17px;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{text-align:left;padding:7px 8px;background:#0C2340;color:#fff;font-size:10px;font-weight:600;white-space:nowrap}
  th.r{text-align:right}th.c{text-align:center}
  td{padding:6px 8px;border-bottom:1px solid #eee;white-space:nowrap}
  tr:last-child td{border-bottom:none}
  tr:nth-child(even) td{background:#fafafa}
  .totals-row td{background:#0C2340!important;color:#fff;font-weight:700;font-size:11px}
  .footer{margin-top:24px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px;text-align:center}
  .print-btn{display:inline-flex;align-items:center;gap:8px;margin-bottom:20px;padding:9px 20px;background:#0C2340;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  .print-btn:hover{background:#1E4A7A}
  @media print{.print-btn{display:none!important}body{padding:12px}@page{margin:10mm;size:landscape}}
</style></head>
<body>
<button class="print-btn" onclick="window.print()">&#128438; Save as PDF / Print</button>
<h1>Daily Sales Reports</h1>
<div class="sub">SEIV Point of Sale &middot; Generated ${date} &middot; Period: ${dateRange.start} to ${dateRange.end}</div>
<div class="cards">
  <div class="card"><div class="card-label">Total Sales</div><div class="card-val" style="color:#0C2340">${totals.sales.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Cash Collected</div><div class="card-val" style="color:#16a34a">${totals.cash.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Airtel + MTN</div><div class="card-val" style="color:#16a34a">${(totals.airtel + totals.mtn).toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Total Expenses</div><div class="card-val" style="color:#d97706">${totals.expenses.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Credit Sales</div><div class="card-val" style="color:#dc2626">${totals.credit.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Days Shown</div><div class="card-val">${filteredReports.length}</div></div>
</div>
<table>
  <thead>
    <tr class="totals-row">
      <td colspan="2">TOTALS</td>
      <td style="text-align:right">${totals.sales.toLocaleString()}</td>
      <td style="text-align:right">${totals.cash.toLocaleString()}</td>
      <td style="text-align:right">${totals.airtel.toLocaleString()}</td>
      <td style="text-align:right">${totals.mtn.toLocaleString()}</td>
      <td style="text-align:right">${totals.visa.toLocaleString()}</td>
      <td style="text-align:right">${totals.comp.toLocaleString()}</td>
      <td style="text-align:right">${totals.disc.toLocaleString()}</td>
      <td style="text-align:right">${totals.expenses.toLocaleString()}</td>
      <td style="text-align:right">${totals.credit.toLocaleString()}</td>
      <td colspan="2"></td>
    </tr>
    <tr><th>Date</th><th>Employee</th><th class="r">Total Sales</th><th class="r">Cash</th><th class="r">Airtel</th><th class="r">MTN</th><th class="r">Visa</th><th class="r">Comp</th><th class="r">Disc</th><th class="r">Expenses</th><th class="r">Credit</th><th class="c">Recon</th><th class="r">Diff</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">SEIV &middot; This is a system-generated report.</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});</script>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'width=1100,height=750')
    if (!win) { toast.error('Allow popups to export PDF'); URL.revokeObjectURL(url); return }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const emailSummary = () => {
    const subject = encodeURIComponent(`SEIV`)
    const body = encodeURIComponent(
      `Daily Sales Summary – SEIV\n` +
      `Period: ${dateRange.start} to ${dateRange.end}\n` +
      `Generated: ${new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
      `Total Sales:      UGX ${totals.sales.toLocaleString()}\n` +
      `Cash Collected:   UGX ${totals.cash.toLocaleString()}\n` +
      `Airtel Money:     UGX ${totals.airtel.toLocaleString()}\n` +
      `MTN Money:        UGX ${totals.mtn.toLocaleString()}\n` +
      `Visa Card:        UGX ${totals.visa.toLocaleString()}\n` +
      `Complementaries:  UGX ${totals.comp.toLocaleString()}\n` +
      `Discounts:        UGX ${totals.disc.toLocaleString()}\n` +
      `Total Expenses:   UGX ${totals.expenses.toLocaleString()}\n` +
      `Credit Sales:     UGX ${totals.credit.toLocaleString()}\n` +
      `Days Reported:    ${filteredReports.length}\n\n` +
      `Powered by SEIV · SEIV`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Employee', 'Total Sales', 'Cash', 'Airtel', 'MTN', 'Visa', 'Stanbic', 'Comp', 'Disc', 'Expenses', 'Credit Sales', 'Recon', 'Diff']
    const rows = filteredReports.map(r => {
      const expenses = r.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0
      const credit = r.unpaid_bills?.reduce((s, b) => s + Number(b.amount), 0) || 0
      return [
        r.report_date,
        (r as any).profiles?.full_name || 'Unknown',
        r.total_sales, r.cash, r.airtel_money, r.mtn_money, r.visa_card, r.stanbic,
        r.complementaries, r.discounts, expenses, credit,
        r.recon_status || '', r.recon_diff || 0
      ]
    })
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reports-${dateRange.start}-to-${dateRange.end}.csv`
    a.click()
  }

  // Apply recon filter client-side
  const filteredReports = reconFilter === 'all'
    ? reports
    : reports.filter(r => r.recon_status === reconFilter)

  // Column totals
  const totals = filteredReports.reduce((acc, r) => {
    const expenses = r.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0
    const credit = r.unpaid_bills?.reduce((s, b) => s + Number(b.amount), 0) || 0
    return {
      sales: acc.sales + Number(r.total_sales),
      cash: acc.cash + Number(r.cash),
      airtel: acc.airtel + Number(r.airtel_money),
      mtn: acc.mtn + Number(r.mtn_money),
      visa: acc.visa + Number(r.visa_card),
      stanbic: acc.stanbic + Number(r.stanbic || 0),
      comp: acc.comp + Number(r.complementaries),
      disc: acc.disc + Number(r.discounts),
      expenses: acc.expenses + expenses,
      credit: acc.credit + credit,
    }
  }, { sales: 0, cash: 0, airtel: 0, mtn: 0, visa: 0, stanbic: 0, comp: 0, disc: 0, expenses: 0, credit: 0 })

  const reconBadge = (status: string | null) => {
    if (!status) return <span className="text-gray-400 text-xs">–</span>
    const styles: Record<string, string> = {
      RECONCILED: 'bg-green-100 text-green-800',
      SHORTAGE: 'bg-red-100 text-red-800',
      EXCESS: 'bg-amber-100 text-amber-800',
    }
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>
  }

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <DashboardLayout>
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Reports</h1>
            <p className="text-gray-500">View and export all employee sales reports</p>
          </div>
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
            <button onClick={exportToCSV} className="btn-primary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 border border-gray-200 rounded-xl overflow-hidden mb-6 divide-x divide-gray-200">
          {[
            { label: 'Total Sales', value: totals.sales, color: 'text-gray-900' },
            { label: 'Credit Sales', value: totals.credit, color: 'text-red-600' },
            { label: 'Total Expenses', value: totals.expenses, color: 'text-amber-600' },
            { label: 'Cash Collected', value: totals.cash, color: 'text-emerald-600' },
            { label: 'Airtel + MTN', value: totals.airtel + totals.mtn, color: 'text-blue-600' },
            { label: 'Days Shown', value: filteredReports.length, color: 'text-gray-700', raw: true },
          ].map(({ label, value, color, raw }) => (
            <div key={label} className="bg-white px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-lg font-bold font-mono ${color}`}>
                {raw ? value : (value as number).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="label">Employee</label>
              <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className="input-field">
                <option value="all">All Employees</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Recon Status</label>
              <select value={reconFilter} onChange={e => setReconFilter(e.target.value)} className="input-field">
                <option value="all">All Statuses</option>
                <option value="RECONCILED">Reconciled</option>
                <option value="SHORTAGE">Shortage</option>
                <option value="EXCESS">Excess</option>
              </select>
            </div>
            <div>
              <label className="label">From Date</label>
              <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label">To Date</label>
              <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label">Quick Filters</label>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setQuickFilter('today')} className="btn-secondary text-xs px-3 py-2">Today</button>
                <button onClick={() => setQuickFilter('thisMonth')} className="btn-secondary text-xs px-3 py-2">This Month</button>
                <button onClick={() => setQuickFilter('lastMonth')} className="btn-secondary text-xs px-3 py-2">Last Month</button>
              </div>
            </div>
          </div>
        </div>

        {/* Reports table */}
        <div className="card overflow-hidden">
          <h2 className="text-lg font-semibold mb-4">Reports ({filteredReports.length})</h2>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
              <p className="mt-2 text-gray-500">Loading reports...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No reports found for the selected criteria.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  {/* Totals row */}
                  <tr className="bg-gray-800 text-white">
                    <td className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide" colSpan={2}>TOTALS</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-yellow-300">{totals.sales.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-green-300">{totals.cash.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-green-300">{totals.airtel.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-green-300">{totals.mtn.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-green-300">{totals.visa.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-gray-300">{totals.comp.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-gray-300">{totals.disc.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-amber-300">{totals.expenses.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-red-300">{totals.credit.toLocaleString()}</td>
                    <td className="px-3 py-2" colSpan={3}></td>
                  </tr>
                  {/* Header row */}
                  <tr className="bg-gray-50">
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Employee</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total Sales</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Cash</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Airtel</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">MTN</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Visa</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Comp</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Disc</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Expenses</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Credit</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase">Recon</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Diff</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredReports.map(report => {
                    const expenses = report.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0
                    const credit = report.unpaid_bills?.reduce((s, b) => s + Number(b.amount), 0) || 0
                    const diff = report.recon_diff || 0
                    return (
                      <tr key={report.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-700">{format(new Date(report.report_date), 'MMM dd, yyyy')}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{(report as any).profiles?.full_name || 'Unknown'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono font-semibold text-gray-900">{Number(report.total_sales).toLocaleString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-emerald-600">{Number(report.cash).toLocaleString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-emerald-600">{Number(report.airtel_money).toLocaleString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-emerald-600">{Number(report.mtn_money).toLocaleString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-emerald-600">{Number(report.visa_card).toLocaleString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-gray-500">{Number(report.complementaries).toLocaleString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-gray-500">{Number(report.discounts).toLocaleString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-amber-600">{expenses.toLocaleString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-red-600">{credit.toLocaleString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-center">{reconBadge(report.recon_status)}</td>
                        <td className={`px-3 py-2 whitespace-nowrap text-right font-mono text-xs font-semibold ${diff > 0 ? 'text-amber-600' : diff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {diff !== 0 ? (diff > 0 ? '+' : '') + diff.toLocaleString() : '–'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleDelete(report.id, report.report_date)}
                            className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          >
                            Delete
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
      </DashboardLayout>
    </ProtectedRoute>
  )
}
