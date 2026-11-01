'use client'

import { useState, useEffect, useRef } from 'react'
import { Organization, Profile } from '@/types'
import toast from 'react-hot-toast'
import { format, addMonths } from 'date-fns'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  organizations: Organization[]
  managers: Profile[]
}

export default function SendPaymentNotificationModal({
  isOpen,
  onClose,
  onSuccess,
  organizations,
  managers
}: Props) {
  const activeOrgs = organizations.filter(o => o.is_active)
  const currentMonthStr = format(new Date(), 'MMMM yyyy')
  const nextMonthStr = format(addMonths(new Date(), 1), 'MMMM yyyy')

  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Ensure selectedOrgIds defaults to all active organizations as soon as organizations are loaded
  useEffect(() => {
    if (activeOrgs.length > 0) {
      setSelectedOrgIds(prev => (prev.length === 0 ? activeOrgs.map(o => o.id) : prev))
    }
  }, [organizations])

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  const [amount, setAmount] = useState<number>(250000)
  const [currency, setCurrency] = useState('UGX')
  const [billingMonth, setBillingMonth] = useState(currentMonthStr)
  const [dueDate, setDueDate] = useState('')
  const [title, setTitle] = useState('Monthly System Utilization Fee - 250,000 UGX')
  const [message, setMessage] = useState(
    `Please be reminded that the monthly system subscription fee of 250,000 UGX is due for ${currentMonthStr} to maintain active system access.`
  )
  const [paymentInstructions, setPaymentInstructions] = useState(
`1. Stanbic Bank:
   Account Name: SEIV Systems
   Account No: 9030012345678

2. Mobile Money:
   MTN / Airtel Money: +256 700 000 000 (Fred Okori)
   Reference: [Organization Name] - Fee`
  )
  const [sendEmail, setSendEmail] = useState(true)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testRecipient, setTestRecipient] = useState('fred.okori@kayeai.com')
  const [showTestInput, setShowTestInput] = useState(false)

  const handleSendTest = async () => {
    if (!testRecipient.trim()) {
      toast.error('Please enter a valid email address for testing')
      return
    }
    setTesting(true)
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isTest: true,
          testRecipient: testRecipient.trim(),
          amount,
          currency,
          billingMonth,
          dueDate: dueDate || null,
          title,
          message,
          paymentInstructions,
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send test email')
      }

      toast.success(`Test notification email dispatched to ${testRecipient.trim()}!`)
      setShowTestInput(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to send test email')
    } finally {
      setTesting(false)
    }
  }

  if (!isOpen) return null

  const handleSelectAll = () => {
    if (selectedOrgIds.length === activeOrgs.length) {
      setSelectedOrgIds([])
    } else {
      setSelectedOrgIds(activeOrgs.map(o => o.id))
    }
  }

  const toggleOrg = (id: string) => {
    setSelectedOrgIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleMonthChange = (month: string) => {
    setBillingMonth(month)
    setMessage(
      `Please be reminded that the monthly system subscription fee of ${amount.toLocaleString()} ${currency} is due for ${month} to maintain active system access.`
    )
  }

  const handleAmountChange = (newAmount: number) => {
    setAmount(newAmount)
    setTitle(`Monthly System Utilization Fee - ${newAmount.toLocaleString()} ${currency}`)
    setMessage(
      `Please be reminded that the monthly system subscription fee of ${newAmount.toLocaleString()} ${currency} is due for ${billingMonth} to maintain active system access.`
    )
  }

  const selectedManagers = managers.filter(
    m => m.organization_id && selectedOrgIds.includes(m.organization_id)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedOrgIds.length === 0) {
      toast.error('Please select at least one organization')
      return
    }
    if (!billingMonth.trim()) {
      toast.error('Billing month is required')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationIds: selectedOrgIds,
          amount,
          currency,
          billingMonth,
          dueDate: dueDate || null,
          title,
          message,
          paymentInstructions,
          sendEmail
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send notification')
      }

      toast.success(
        `Payment notification sent for ${data.createdCount} organization(s)! ${
          data.emailsSent > 0 ? `(${data.emailsSent} email(s) dispatched)` : ''
        }`
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Failed to send notification')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#10243E] border border-blue-900/60 rounded-xl shadow-2xl max-w-2xl w-full my-8 text-white overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0C1E34] border-b border-blue-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Send Payment Notification</h2>
              <p className="text-xs text-blue-200/70">
                Send 250,000 UGX monthly system fee reminders to organization managers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Target Organizations Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                Target Organizations
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400">
                  {selectedOrgIds.length} of {activeOrgs.length} selected ({selectedManagers.length} manager{selectedManagers.length !== 1 ? 's' : ''})
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition"
                >
                  {selectedOrgIds.length === activeOrgs.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            {/* Dropdown Button */}
            <button
              type="button"
              onClick={() => setDropdownOpen(prev => !prev)}
              className="w-full bg-[#09172A] border border-blue-900/50 hover:border-amber-500/50 rounded-lg px-3.5 py-2.5 text-left flex items-center justify-between text-xs text-white transition focus:outline-none focus:border-amber-500 shadow-sm"
            >
              <div className="flex items-center gap-2 truncate pr-2">
                {activeOrgs.length === 0 ? (
                  <span className="text-gray-400">No active organizations found</span>
                ) : selectedOrgIds.length === activeOrgs.length ? (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/40">
                      All Active Organizations
                    </span>
                    <span className="text-gray-300">
                      ({activeOrgs.length} bars · {selectedManagers.length} managers)
                    </span>
                  </div>
                ) : selectedOrgIds.length === 0 ? (
                  <span className="text-gray-400">Select target organizations...</span>
                ) : selectedOrgIds.length === 1 ? (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {activeOrgs.find(o => o.id === selectedOrgIds[0])?.name || '1 Organization'}
                    </span>
                    <span className="text-gray-400 text-[11px]">
                      ({selectedManagers.length} manager{selectedManagers.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {selectedOrgIds.length} Organizations Selected
                    </span>
                    <span className="text-gray-400 text-[11px]">
                      ({selectedManagers.length} managers)
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 text-blue-300">
                <span className="text-[10px] text-gray-400 hidden sm:inline">
                  {dropdownOpen ? 'Click to close' : 'Click to select'}
                </span>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute left-0 right-0 z-30 mt-1.5 bg-[#0C1E34] border border-blue-800/80 rounded-xl shadow-2xl p-2.5 max-h-72 overflow-y-auto space-y-1 animate-in fade-in zoom-in-95 duration-100">
                {/* Select All Item */}
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-blue-900/30 transition text-left border border-amber-500/30 bg-amber-500/10 mb-1.5"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedOrgIds.length === activeOrgs.length && activeOrgs.length > 0}
                      readOnly
                      className="rounded border-gray-600 text-amber-500 focus:ring-amber-500 cursor-pointer pointer-events-none"
                    />
                    <div>
                      <span className="font-bold text-xs text-amber-400 block">
                        Select All Active Organizations ({activeOrgs.length})
                      </span>
                      <span className="text-[11px] text-gray-300 block">
                        Send to all {activeOrgs.length} active organizations at once
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
                    ALL
                  </span>
                </button>

                <div className="border-t border-blue-900/60 my-1" />

                {/* Individual Organizations */}
                {activeOrgs.length === 0 ? (
                  <p className="p-3 text-xs text-gray-400 text-center">No active organizations found</p>
                ) : (
                  activeOrgs.map(org => {
                    const orgManagers = managers.filter(m => m.organization_id === org.id)
                    const isSelected = selectedOrgIds.includes(org.id)
                    return (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => toggleOrg(org.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
                          isSelected
                            ? 'bg-blue-900/40 border border-blue-700/50 text-white'
                            : 'hover:bg-white/5 border border-transparent text-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="mt-0.5 rounded border-gray-600 text-amber-500 focus:ring-amber-500 cursor-pointer pointer-events-none shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-white block truncate">
                              {org.name}
                            </span>
                            <span className="text-[11px] text-gray-400 block truncate">
                              {orgManagers.length > 0
                                ? `${orgManagers.length} manager${orgManagers.length !== 1 ? 's' : ''}: ${orgManagers
                                    .map(m => m.full_name || m.email)
                                    .join(', ')}`
                                : 'No manager assigned'}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                          Active
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            )}

            {/* Selected Tags Below Dropdown */}
            {selectedOrgIds.length > 0 && selectedOrgIds.length < activeOrgs.length && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedOrgIds.map(id => {
                  const org = activeOrgs.find(o => o.id === id)
                  if (!org) return null
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-900/40 border border-blue-800 text-[11px] text-blue-200"
                    >
                      <span>{org.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleOrg(id)}
                        className="text-gray-400 hover:text-red-400 ml-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200 mb-1">
                Payment Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={e => handleAmountChange(Number(e.target.value))}
                  className="w-full bg-[#09172A] border border-blue-900/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  required
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-amber-400">
                  {currency}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Default fee: 250,000 UGX per organization</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200 mb-1">
                Billing Month
              </label>
              <div className="space-y-1">
                <input
                  type="text"
                  value={billingMonth}
                  onChange={e => handleMonthChange(e.target.value)}
                  placeholder="e.g. November 2026"
                  className="w-full bg-[#09172A] border border-blue-900/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleMonthChange(currentMonthStr)}
                    className="text-[10px] text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900/40 hover:text-white"
                  >
                    Current: {currentMonthStr}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMonthChange(nextMonthStr)}
                    className="text-[10px] text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900/40 hover:text-white"
                  >
                    Next: {nextMonthStr}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Due Date & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200 mb-1">
                Due Date (Optional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-[#09172A] border border-blue-900/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200 mb-1">
                Notification Subject / Title
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-[#09172A] border border-blue-900/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200 mb-1">
              Notification Message
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full bg-[#09172A] border border-blue-900/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          {/* Payment Instructions */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200 mb-1">
              Payment Methods & Instructions
            </label>
            <textarea
              rows={4}
              value={paymentInstructions}
              onChange={e => setPaymentInstructions(e.target.value)}
              className="w-full font-mono text-xs bg-[#09172A] border border-blue-900/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Email dispatch option */}
          <div className="bg-[#0b1a2e] p-3 rounded-lg border border-blue-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="sendEmail"
                checked={sendEmail}
                onChange={e => setSendEmail(e.target.checked)}
                className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="sendEmail" className="text-xs text-white cursor-pointer select-none">
                <span className="font-semibold">Dispatch Email to Organization Managers</span>
                <p className="text-[11px] text-gray-400">
                  Sends an official payment reminder email with full instructions via Resend
                </p>
              </label>
            </div>
            <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {selectedManagers.length} recipient{selectedManagers.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-blue-900/50">
            <div className="flex items-center gap-1.5">
              {showTestInput ? (
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <input
                    type="email"
                    value={testRecipient}
                    onChange={e => setTestRecipient(e.target.value)}
                    placeholder="recipient@example.com"
                    className="text-xs bg-[#09172A] border border-blue-900/60 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-500 w-48"
                  />
                  <button
                    type="button"
                    onClick={handleSendTest}
                    disabled={testing}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-navy-950 hover:bg-amber-400 transition shrink-0 disabled:opacity-50"
                  >
                    {testing ? 'Sending...' : 'Send'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTestInput(false)}
                    className="text-xs text-gray-400 hover:text-white px-1"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSendTest}
                    disabled={testing || loading}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-blue-900/40 hover:bg-blue-900/60 text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5 disabled:opacity-50"
                    title={`Send preview test to ${testRecipient}`}
                  >
                    {testing ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Sending Test...
                      </>
                    ) : (
                      <>
                        <span>🧪</span>
                        <span>Send Test Email</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTestInput(true)}
                    className="p-2 text-xs text-blue-300 hover:text-white hover:bg-white/5 rounded-lg border border-blue-900/40"
                    title="Change test email recipient"
                  >
                    ✏️
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || selectedOrgIds.length === 0}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-navy-950 transition flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Sending Notifications...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send to {selectedOrgIds.length} Organization{selectedOrgIds.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

