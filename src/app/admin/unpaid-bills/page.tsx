'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface UnpaidBillWithDetails {
  id: string
  customer_name: string
  amount: number
  original_amount: number
  notes: string | null
  created_at: string
  daily_reports: {
    report_date: string
    organization_id: string | null
    profiles: { full_name: string } | null
  }
}

function nameToSlug(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export default function AdminUnpaidBills() {
  const supabase = createClient()
  const { selectedOrg } = useOrganization()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [bills, setBills] = useState<UnpaidBillWithDetails[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const fetchUnpaidBills = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('unpaid_bills')
        .select(`
          *,
          daily_reports!inner (
            report_date,
            organization_id,
            profiles!user_id (full_name)
          )
        `)
        .order('created_at', { ascending: false })

      if (selectedOrg) query = query.eq('daily_reports.organization_id', selectedOrg.id)

      const { data, error } = await query
      if (error) throw error
      setBills(data || [])
    } catch (error) {
      console.error('Error fetching unpaid bills:', error)
      toast.error('Failed to fetch unpaid bills')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUnpaidBills()
  }, [selectedOrg?.id])

  const filteredBills = bills.filter(bill =>
    bill.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalUnpaid = filteredBills.reduce((sum, bill) => sum + Number(bill.amount), 0)

  const customerGroups = Object.values(
    filteredBills.reduce((acc, bill) => {
      const key = bill.customer_name.toLowerCase()
      if (!acc[key]) acc[key] = { name: bill.customer_name, bills: [], total: 0 }
      acc[key].bills.push(bill)
      acc[key].total += Number(bill.amount)
      return acc
    }, {} as Record<string, { name: string; bills: UnpaidBillWithDetails[]; total: number }>)
  ).sort((a, b) => {
    if (a.total === 0 && b.total > 0) return 1
    if (a.total > 0 && b.total === 0) return -1
    return b.total - a.total
  })

  const owingCount = customerGroups.filter(c => c.total > 0).length
  const clearedCount = customerGroups.filter(c => c.total === 0).length
  const totalCollected = filteredBills.reduce((s, b) => s + Math.max(0, Number(b.original_amount || 0) - Number(b.amount)), 0)

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <DashboardLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Unpaid Bills</h1>
          <p className="text-gray-500">Track and manage all outstanding client balances</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card" style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.25)' }}>
            <p className="text-sm" style={{ color: '#92400e' }}>Total Outstanding</p>
            <p className="text-3xl font-bold font-mono" style={{ color: '#b45309' }}>{totalUnpaid.toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: '#b45309', opacity: 0.6 }}>UGX across all clients</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Clients Owing</p>
            <p className="text-3xl font-bold text-gray-900">{owingCount}</p>
          </div>
          <div className="card" style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)' }}>
            <p className="text-sm" style={{ color: '#065f46' }}>Clients Cleared</p>
            <p className="text-3xl font-bold" style={{ color: '#059669' }}>{clearedCount}</p>
          </div>
          <div className="card" style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)' }}>
            <p className="text-sm" style={{ color: '#1e40af' }}>Total Collected</p>
            <p className="text-3xl font-bold font-mono" style={{ color: '#2563eb' }}>{totalCollected.toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: '#2563eb', opacity: 0.6 }}>UGX paid by clients</p>
          </div>
        </div>

        {/* Search */}
        <div className="card mb-6">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by customer name or notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input-field pl-12"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="card text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
            <p className="mt-3 text-gray-500">Loading...</p>
          </div>
        ) : customerGroups.length === 0 ? (
          <div className="card text-center py-14">
            <svg className="w-16 h-16 text-green-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-400">{searchTerm ? 'No clients match your search.' : 'No unpaid bills found.'}</p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Client</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Bills</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Balance (UGX)</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customerGroups.map(customer => {
                  const isCleared = customer.total === 0
                  return (
                    <tr
                      key={customer.name}
                      onClick={() => router.push(`/admin/unpaid-bills/${nameToSlug(customer.name)}`)}
                      className={`cursor-pointer transition-colors hover:bg-amber-50/60 ${isCleared ? 'opacity-60' : ''}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-xs ${isCleared ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}>
                            {getInitials(customer.name)}
                          </div>
                          <p className="font-semibold text-gray-900 text-sm">{customer.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm text-gray-600 font-medium">{customer.bills.length}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-bold font-mono text-sm ${isCleared ? 'text-green-600' : 'text-amber-600'}`}>
                          {isCleared ? '0' : customer.total.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {isCleared ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Cleared</span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Owing</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => router.push(`/admin/unpaid-bills/${nameToSlug(customer.name)}`)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ml-auto"
                          style={{ background: 'rgba(12,35,64,.06)', color: '#0C2340', border: '1px solid rgba(12,35,64,.15)' }}
                        >
                          View
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
