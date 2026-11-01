'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { SystemNotification } from '@/types'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function ManagerNotificationsPage() {
  const { profile } = useAuth()
  const { selectedOrg } = useOrganization()

  const [notifications, setNotifications] = useState<SystemNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [paymentRefNotes, setPaymentRefNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/manager/notifications')
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch notifications')
      }
      setNotifications(data.notifications || [])
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error loading notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [selectedOrg?.id])

  const handleAcknowledge = async (id: string) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/manager/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          referenceNotes: paymentRefNotes.trim()
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to acknowledge notification')
      }

      toast.success('Payment confirmation submitted to Fred Okori!')
      setAcknowledgingId(null)
      setPaymentRefNotes('')
      fetchNotifications()
    } catch (err: any) {
      toast.error(err.message || 'Failed to acknowledge')
    } finally {
      setSubmitting(false)
    }
  }

  const pendingNotifs = notifications.filter(n => n.status === 'pending')
  const completedNotifs = notifications.filter(n => n.status !== 'pending')

  return (
    <ProtectedRoute allowedRoles={['manager', 'superadmin']}>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System & Payment Notifications</h1>
              <p className="text-sm text-gray-500 mt-1">
                Official notices regarding monthly system utilization fees (250,000 UGX) and account status
              </p>
            </div>
            <button
              onClick={fetchNotifications}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400 text-xs">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mb-2" />
              <p>Loading notifications...</p>
            </div>
          ) : (
            <>
              {/* Active / Pending Notices */}
              {pendingNotifs.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    Action Required: Pending Monthly Subscription ({pendingNotifs.length})
                  </h2>

                  {pendingNotifs.map(notif => (
                    <div
                      key={notif.id}
                      className="bg-white rounded-xl border-2 border-amber-400/80 p-6 shadow-md relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 bg-amber-500 text-navy-950 font-bold uppercase text-[10px] tracking-widest px-4 py-1 rounded-bl-lg">
                        Pending Payment
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-2">
                          <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            Billing Month: {notif.billing_month}
                          </span>
                          <h3 className="text-lg font-bold text-gray-900">{notif.title}</h3>
                          <p className="text-sm text-gray-700 leading-relaxed max-w-xl">
                            {notif.message}
                          </p>
                        </div>

                        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 text-right shrink-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                            Amount Due
                          </span>
                          <span className="text-2xl font-black text-gray-900 block mt-0.5">
                            {Number(notif.amount).toLocaleString()}{' '}
                            <span className="text-xs font-semibold text-amber-700">{notif.currency}</span>
                          </span>
                          {notif.due_date && (
                            <span className="text-[11px] text-gray-500 block mt-1">
                              Due: {format(new Date(notif.due_date), 'MMM dd, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Payment Instructions */}
                      {notif.payment_instructions && (
                        <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Payment Instructions
                          </h4>
                          <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {notif.payment_instructions}
                          </pre>
                        </div>
                      )}

                      {/* Action / Acknowledge form */}
                      <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <span className="text-xs text-gray-400">
                          Sent by Fred Okori • {format(new Date(notif.created_at), 'MMM dd, yyyy')}
                        </span>

                        {acknowledgingId === notif.id ? (
                          <div className="w-full sm:w-auto flex-1 max-w-md space-y-2">
                            <input
                              type="text"
                              value={paymentRefNotes}
                              onChange={e => setPaymentRefNotes(e.target.value)}
                              placeholder="Transaction ref / phone used / payment details"
                              className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setAcknowledgingId(null)}
                                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleAcknowledge(notif.id)}
                                disabled={submitting}
                                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition disabled:opacity-50"
                              >
                                {submitting ? 'Submitting...' : 'Confirm Payment Sent'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setAcknowledgingId(notif.id)
                              setPaymentRefNotes('')
                            }}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#0C2340] hover:bg-[#16375f] text-amber-400 border border-amber-500/30 transition shadow-sm flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Confirm / Submit Payment Info
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Past / Completed Notices */}
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Notification History ({completedNotifs.length})
                </h2>

                {completedNotifs.length === 0 && pendingNotifs.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-xs">
                    No notifications at this time. All system fees are up to date!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedNotifs.map(item => (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">{item.title}</span>
                            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {item.billing_month}
                            </span>
                            {item.status === 'paid' && (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                Paid & Verified
                              </span>
                            )}
                            {item.status === 'acknowledged' && (
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                Payment Submitted
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{item.message}</p>
                          {item.notes && (
                            <p className="text-[11px] text-gray-400 font-mono mt-1">Note: {item.notes}</p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-bold text-gray-900 text-sm block">
                            {Number(item.amount).toLocaleString()} {item.currency}
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            {format(new Date(item.created_at), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

