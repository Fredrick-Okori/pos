'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import SendPaymentNotificationModal from '@/components/SendPaymentNotificationModal'
import { useAuth } from '@/contexts/AuthContext'
import { Organization, Profile, SystemNotification, NotificationStatus } from '@/types'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function NotificationsAdminPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const supabase = createClient()

  const isFred =
    profile?.role === 'superadmin' &&
    profile?.email?.toLowerCase() === 'fred.okori@kayeai.com'

  const [notifications, setNotifications] = useState<SystemNotification[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [managers, setManagers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | NotificationStatus>('all')
  const [orgFilter, setOrgFilter] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (profile && !isFred) {
      router.replace('/admin/dashboard')
    }
  }, [profile, isFred, router])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/notifications')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load notifications')
      }

      if (data.tableMissing) {
        setTableMissing(true)
      } else {
        setTableMissing(false)
      }

      setNotifications(data.notifications || [])
      setOrganizations(data.organizations || [])
      setManagers(data.managers || [])

      if (data.organizations && data.organizations.length > 0) {
        setOrganizations(data.organizations)
      } else {
        const { data: directOrgs } = await supabase.from('organizations').select('*').order('name')
        if (directOrgs) setOrganizations(directOrgs)
      }

      if (data.managers && data.managers.length > 0) {
        setManagers(data.managers)
      } else {
        const { data: directManagers } = await supabase.from('profiles').select('id, full_name, email, role, organization_id').eq('role', 'manager')
        if (directManagers) setManagers(directManagers)
      }
    } catch (err: any) {
      console.error(err)
      // Attempt fallback direct fetch of organizations and managers
      try {
        const [{ data: fallbackOrgs }, { data: fallbackManagers }] = await Promise.all([
          supabase.from('organizations').select('*').order('name'),
          supabase.from('profiles').select('id, full_name, email, role, organization_id').eq('role', 'manager')
        ])
        if (fallbackOrgs) setOrganizations(fallbackOrgs)
        if (fallbackManagers) setManagers(fallbackManagers)
      } catch {}
      toast.error(err.message || 'Error fetching notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isFred) {
      fetchData()
    }
  }, [isFred])

  if (profile && !isFred) {
    return null
  }

  const handleStatusChange = async (id: string, newStatus: NotificationStatus) => {
    setUpdatingId(id)
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status')
      }

      toast.success(`Notification status marked as "${newStatus}"`)
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, status: newStatus } : n))
      )
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredNotifications = notifications.filter(n => {
    const matchesStatus = statusFilter === 'all' || n.status === statusFilter
    const matchesOrg = orgFilter === 'all' || n.organization_id === orgFilter
    return matchesStatus && matchesOrg
  })

  const totalSent = notifications.length
  const totalPending = notifications.filter(n => n.status === 'pending').length
  const totalAcknowledged = notifications.filter(n => n.status === 'acknowledged').length
  const totalPaid = notifications.filter(n => n.status === 'paid').length
  const totalBilled = notifications.reduce((sum, n) => sum + Number(n.amount || 0), 0)

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Payment Notifications</h1>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                  Fred Okori Exclusive
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Send 250,000 UGX monthly system utilization fee reminders to managers of active organizations
              </p>
            </div>

            <button
              onClick={() => setShowSendModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#0C2340] text-amber-400 hover:bg-[#16375f] border border-amber-500/30 transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Send Payment Notification (250,000 UGX)
            </button>
          </div>

          {/* Migration notice if table is missing */}
          {tableMissing && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm">
              <div className="flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div className="text-xs text-amber-900 space-y-1">
                  <p className="font-bold">Database Setup Notice</p>
                  <p>
                    The <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono">notifications</code> table has not been created in Supabase yet.
                    Please execute the SQL in <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono">supabase_notifications_migration.sql</code> in your Supabase SQL Editor.
                  </p>
                  <button
                    onClick={fetchData}
                    className="mt-2 text-xs font-semibold text-amber-800 hover:underline"
                  >
                    Click here to re-check table status
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sent</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalSent}</p>
              <span className="text-[11px] text-gray-400">Total notifications issued</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-100 bg-amber-50/20 shadow-sm">
              <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">Pending Payment</span>
              <p className="text-2xl font-bold text-amber-600 mt-1">{totalPending}</p>
              <span className="text-[11px] text-amber-600/80">Awaiting 250,000 UGX payment</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-100 bg-blue-50/20 shadow-sm">
              <span className="text-xs font-medium text-blue-700 uppercase tracking-wider">Acknowledged</span>
              <p className="text-2xl font-bold text-blue-600 mt-1">{totalAcknowledged}</p>
              <span className="text-[11px] text-blue-600/80">Manager confirmed payment</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-sm">
              <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Paid / Cleared</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{totalPaid}</p>
              <span className="text-[11px] text-emerald-600/80">UGX {(totalPaid * 250000).toLocaleString()} received</span>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Statuses ({notifications.length})</option>
                  <option value="pending">Pending ({totalPending})</option>
                  <option value="acknowledged">Acknowledged ({totalAcknowledged})</option>
                  <option value="paid">Paid ({totalPaid})</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1">Organization</label>
                <select
                  value={orgFilter}
                  onChange={e => setOrgFilter(e.target.value)}
                  className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Organizations</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={fetchData}
              className="text-xs font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1.5 self-end py-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {/* Notifications Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400 text-xs">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mb-2" />
                <p>Loading payment notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-xs space-y-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-600">No payment notifications found</p>
                <p className="text-gray-400 max-w-sm mx-auto">
                  Click the button below to issue the monthly 250,000 UGX subscription fee notice to organization managers.
                </p>
                <button
                  onClick={() => setShowSendModal(true)}
                  className="px-4 py-2 bg-[#0C2340] text-amber-400 font-semibold text-xs rounded-lg hover:bg-[#16375f] transition"
                >
                  + Send Payment Notification
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 px-4 font-semibold">Organization</th>
                      <th className="py-3.5 px-4 font-semibold">Billing Month</th>
                      <th className="py-3.5 px-4 font-semibold">Amount</th>
                      <th className="py-3.5 px-4 font-semibold">Status</th>
                      <th className="py-3.5 px-4 font-semibold">Due Date</th>
                      <th className="py-3.5 px-4 font-semibold">Sent On</th>
                      <th className="py-3.5 px-4 font-semibold">Manager Feedback</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {filteredNotifications.map(item => {
                      const orgName = item.organizations?.name || 'All Organizations'
                      const isPending = item.status === 'pending'
                      const isAck = item.status === 'acknowledged'
                      const isPaid = item.status === 'paid'

                      return (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition">
                          <td className="py-3 px-4">
                            <span className="font-semibold text-gray-900 block">{orgName}</span>
                            <span className="text-[10px] text-gray-400">Target: Managers</span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-medium text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                              {item.billing_month}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-gray-900 text-sm">
                              {Number(item.amount).toLocaleString()}{' '}
                              <span className="text-[10px] text-gray-500 font-normal">{item.currency}</span>
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Pending Payment
                              </span>
                            )}
                            {isAck && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                Acknowledged (Payment Sent)
                              </span>
                            )}
                            {isPaid && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Paid / Verified
                              </span>
                            )}
                            {item.status === 'cancelled' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                                Cancelled
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-gray-600">
                            {item.due_date ? format(new Date(item.due_date), 'MMM dd, yyyy') : 'Upon receipt'}
                          </td>

                          <td className="py-3 px-4 text-gray-500 text-[11px]">
                            {item.created_at ? format(new Date(item.created_at), 'MMM dd, yyyy HH:mm') : '—'}
                          </td>

                          <td className="py-3 px-4">
                            {item.acknowledged_by_name ? (
                              <div className="space-y-0.5">
                                <span className="text-gray-800 font-medium block">
                                  {item.acknowledged_by_name}
                                </span>
                                <span className="text-[10px] text-gray-400 block">
                                  {item.acknowledged_at ? format(new Date(item.acknowledged_at), 'MMM dd, HH:mm') : ''}
                                </span>
                                {item.notes && (
                                  <p className="text-[10px] text-blue-600 bg-blue-50/50 p-1 rounded max-w-xs truncate">
                                    {item.notes}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[11px]">Not acknowledged yet</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.status !== 'paid' && (
                                <button
                                  onClick={() => handleStatusChange(item.id, 'paid')}
                                  disabled={updatingId === item.id}
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] transition"
                                  title="Confirm payment received"
                                >
                                  Mark Paid
                                </button>
                              )}

                              {item.status === 'paid' && (
                                <button
                                  onClick={() => handleStatusChange(item.id, 'pending')}
                                  disabled={updatingId === item.id}
                                  className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-[11px] transition"
                                  title="Revert back to pending"
                                >
                                  Mark Pending
                                </button>
                              )}

                              {item.status !== 'cancelled' && (
                                <button
                                  onClick={() => handleStatusChange(item.id, 'cancelled')}
                                  disabled={updatingId === item.id}
                                  className="px-2 py-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 text-[11px] transition"
                                  title="Cancel notification"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal */}
        <SendPaymentNotificationModal
          isOpen={showSendModal}
          onClose={() => setShowSendModal(false)}
          onSuccess={fetchData}
          organizations={organizations}
          managers={managers}
        />
      </DashboardLayout>
    </ProtectedRoute>
  )
}

