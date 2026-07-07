'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase'
import { DailyReport } from '@/types'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'

export default function ManagerDashboard() {
  const { profile } = useAuth()
  const { selectedOrg } = useOrganization()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<DailyReport[]>([])
  const [unpaidTotal, setUnpaidTotal] = useState(0)
  const [unpaidCount, setUnpaidCount] = useState(0)

  const dateRange = {
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  }

  useEffect(() => {
    if (!selectedOrg) return
    fetchData()
  }, [selectedOrg?.id])

  const fetchData = async () => {
    if (!selectedOrg) return
    setLoading(true)
    try {
      const [reportsRes, billsRes] = await Promise.all([
        supabase
          .from('daily_reports')
          .select('*, profiles(full_name)')
          .eq('organization_id', selectedOrg.id)
          .gte('report_date', dateRange.start)
          .lte('report_date', dateRange.end)
          .order('report_date', { ascending: false }),
        supabase
          .from('unpaid_bills')
          .select('amount, daily_reports!inner(organization_id)')
          .eq('daily_reports.organization_id', selectedOrg.id),
      ])

      setReports(reportsRes.data || [])

      const bills = billsRes.data || []
      setUnpaidTotal(bills.reduce((s, b) => s + Number(b.amount), 0))
      setUnpaidCount(bills.length)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const totalSales = reports.reduce((s, r) => s + Number(r.total_sales), 0)
  const totalCash = reports.reduce((s, r) => s + Number(r.cash), 0)
  const totalMobile = reports.reduce((s, r) => s + Number(r.airtel_money) + Number(r.mtn_money), 0)

  const fmt = (n: number) => `UGX ${n.toLocaleString()}`

  const statCards = [
    {
      label: 'Total Sales (This Month)',
      value: fmt(totalSales),
      sub: `${reports.length} report${reports.length !== 1 ? 's' : ''}`,
      color: '#2563EB',
      bg: 'rgba(37,99,235,.1)',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      label: 'Cash Collected',
      value: fmt(totalCash),
      sub: 'this month',
      color: '#16A34A',
      bg: 'rgba(22,163,74,.1)',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: 'Mobile Money',
      value: fmt(totalMobile),
      sub: 'Airtel + MTN this month',
      color: '#7C3AED',
      bg: 'rgba(124,58,237,.1)',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Outstanding Bills',
      value: fmt(unpaidTotal),
      sub: `${unpaidCount} open bill${unpaidCount !== 1 ? 's' : ''}`,
      color: '#D97706',
      bg: 'rgba(217,119,6,.1)',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  return (
    <ProtectedRoute allowedRoles={['manager']}>
      <DashboardLayout>
        {/* Header */}
        <div className="mb-7">
          <h1 className="text-xl font-bold text-gray-900">
            {selectedOrg?.name ?? 'Organization'} — Overview
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Welcome back, {profile?.full_name} &nbsp;·&nbsp;{' '}
            {format(new Date(), 'MMMM yyyy')}
          </p>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((card) => (
              <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: card.bg, color: card.color }}>
                    {card.icon}
                  </div>
                  <p className="text-xs text-gray-400 leading-tight">{card.label}</p>
                </div>
                <p className="text-lg font-bold text-gray-900 leading-tight">{card.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'View All Reports', href: '/admin/reports', desc: 'Browse and filter daily reports', color: '#2563EB' },
            { label: 'Invoices', href: '/admin/unpaid-bills', desc: 'Manage client outstanding bills', color: '#D97706' },
            { label: 'Client Ledger', href: '/admin/clients', desc: 'View client accounts', color: '#7C3AED' },
          ].map((link) => (
            <Link key={link.href} href={link.href}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
              <p className="font-semibold text-sm text-gray-800 group-hover:text-blue-700 transition-colors">{link.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{link.desc}</p>
            </Link>
          ))}
        </div>

        {/* Recent reports */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Recent Reports — {format(new Date(), 'MMMM yyyy')}</h2>
          </div>
          {loading ? null : reports.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">No reports this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase">Employee</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total Sales</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase">Cash</th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reports.slice(0, 10).map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-700 whitespace-nowrap">
                        {format(new Date(r.report_date), 'EEE, MMM d')}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {(r.profiles as any)?.full_name ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-800">
                        {Number(r.total_sales).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {Number(r.cash).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {r.recon_status ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.recon_status === 'RECONCILED' ? 'bg-green-100 text-green-700'
                            : r.recon_status === 'SHORTAGE' ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                          }`}>
                            {r.recon_status}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
