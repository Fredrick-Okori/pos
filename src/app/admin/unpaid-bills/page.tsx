'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface UnpaidBillWithDetails {
  id: string
  customer_name: string
  amount: number
  notes: string | null
  created_at: string
  daily_reports: {
    report_date: string
    organization_id: string | null
    profiles: {
      full_name: string
    }
  }
}

export default function AdminUnpaidBills() {
  const supabase = createClient()
  const { selectedOrg } = useOrganization()
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
            profiles!inner (full_name)
          )
        `)
        .order('created_at', { ascending: false })

      if (selectedOrg) {
        query = query.eq('daily_reports.organization_id', selectedOrg.id)
      }

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

  // Group by customer
  const customerGroups = filteredBills.reduce((acc, bill) => {
    const key = bill.customer_name.toLowerCase()
    if (!acc[key]) {
      acc[key] = { name: bill.customer_name, bills: [], total: 0 }
    }
    acc[key].bills.push(bill)
    acc[key].total += Number(bill.amount)
    return acc
  }, {} as Record<string, { name: string; bills: UnpaidBillWithDetails[]; total: number }>)

  const sortedCustomers = Object.values(customerGroups).sort((a, b) => b.total - a.total)

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <DashboardLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Unpaid Bills</h1>
          <p className="text-gray-600">Track and manage all unpaid customer bills</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-700">Total Outstanding</p>
            <p className="text-3xl font-bold text-amber-800">{totalUnpaid.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Total Bills</p>
            <p className="text-3xl font-bold text-gray-900">{filteredBills.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Unique Customers</p>
            <p className="text-3xl font-bold text-primary-600">{sortedCustomers.length}</p>
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-12"
            />
          </div>
        </div>

        {/* Bills by Customer */}
        {loading ? (
          <div className="card text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading unpaid bills...</p>
          </div>
        ) : sortedCustomers.length === 0 ? (
          <div className="card text-center py-12">
            <svg className="w-16 h-16 text-green-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500">No unpaid bills found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedCustomers.map((customer) => (
              <div key={customer.name} className="card">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                      <span className="text-amber-700 font-semibold">
                        {customer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                      <p className="text-sm text-gray-500">{customer.bills.length} unpaid bill(s)</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-600">{customer.total.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Total owed</p>
                  </div>
                </div>
                
                <div className="border-t border-gray-100 pt-4">
                  <table className="min-w-full">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase">
                        <th className="text-left pb-2">Date</th>
                        <th className="text-left pb-2">Recorded By</th>
                        <th className="text-left pb-2">Notes</th>
                        <th className="text-right pb-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {customer.bills.map((bill) => (
                        <tr key={bill.id} className="text-sm">
                          <td className="py-2">
                            {format(new Date(bill.daily_reports.report_date), 'MMM dd, yyyy')}
                          </td>
                          <td className="py-2 text-gray-600">
                            {bill.daily_reports.profiles.full_name}
                          </td>
                          <td className="py-2 text-gray-600">
                            {bill.notes || '-'}
                          </td>
                          <td className="py-2 text-right font-medium text-amber-600">
                            {Number(bill.amount).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
