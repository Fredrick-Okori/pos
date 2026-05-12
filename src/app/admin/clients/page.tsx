'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Client, ClientCharge, ClientPayment } from '@/types'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

// Extended client type with computed balance fields
interface ClientWithBalance extends Client {
  totalCharged: number
  totalPaid: number
  balance: number
  transactionCount: number
}

// Form state for adding a charge
interface ChargeFormState {
  clientName: string
  date: string
  amount: string
  note: string
}

const emptyChargeForm: ChargeFormState = {
  clientName: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  amount: '',
  note: ''
}

export default function AdminClientsPage() {
  const supabase = createClient()
  const { selectedOrg } = useOrganization()
  const { profile } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<ClientWithBalance[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Modal state
  const [showAddChargeModal, setShowAddChargeModal] = useState(false)
  const [chargeForm, setChargeForm] = useState<ChargeFormState>(emptyChargeForm)
  const [savingCharge, setSavingCharge] = useState(false)

  // Autocomplete suggestions
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const fetchClients = async () => {
    setLoading(true)
    try {
      let clientQuery = supabase
        .from('clients')
        .select('*, client_charges(*), client_payments(*)')
        .order('name')

      if (selectedOrg) {
        clientQuery = clientQuery.eq('organization_id', selectedOrg.id)
      }

      const { data, error } = await clientQuery
      if (error) throw error

      const enriched: ClientWithBalance[] = (data || []).map((c: any) => {
        const charges: ClientCharge[] = c.client_charges || []
        const payments: ClientPayment[] = c.client_payments || []
        const totalCharged = charges.reduce((s: number, ch: ClientCharge) => s + Number(ch.amount), 0)
        const totalPaid = payments.reduce((s: number, p: ClientPayment) => s + Number(p.amount), 0)
        return {
          ...c,
          charges,
          payments,
          totalCharged,
          totalPaid,
          balance: totalCharged - totalPaid,
          transactionCount: charges.length + payments.length
        }
      })

      setClients(enriched)
    } catch (err) {
      console.error('Error fetching clients:', err)
      toast.error('Failed to load client ledger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg?.id])

  // Update autocomplete whenever the list of clients changes or name input changes
  useEffect(() => {
    if (chargeForm.clientName.trim().length === 0) {
      setNameSuggestions([])
      return
    }
    const lower = chargeForm.clientName.toLowerCase()
    const matches = clients
      .map(c => c.name)
      .filter(n => n.toLowerCase().includes(lower))
      .slice(0, 6)
    setNameSuggestions(matches)
  }, [chargeForm.clientName, clients])

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddCharge = async () => {
    if (!chargeForm.clientName.trim()) {
      toast.error('Client name is required')
      return
    }
    if (!chargeForm.amount || Number(chargeForm.amount) <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }
    setSavingCharge(true)
    try {
      const orgId = selectedOrg?.id || profile?.organization_id || null

      // Find or create client
      let clientId: string | null = null
      const existingClient = clients.find(
        c => c.name.toLowerCase() === chargeForm.clientName.trim().toLowerCase()
      )

      if (existingClient) {
        clientId = existingClient.id
      } else {
        // Create a new client record
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({ name: chargeForm.clientName.trim(), organization_id: orgId })
          .select()
          .single()
        if (clientError) throw clientError
        clientId = newClient.id
      }

      // Insert the charge
      const { error: chargeError } = await supabase
        .from('client_charges')
        .insert({
          client_id: clientId,
          organization_id: orgId,
          date: chargeForm.date,
          amount: Number(chargeForm.amount),
          note: chargeForm.note.trim()
        })
      if (chargeError) throw chargeError

      toast.success('Charge added successfully')
      setShowAddChargeModal(false)
      setChargeForm(emptyChargeForm)
      fetchClients()
    } catch (err: any) {
      console.error('Error adding charge:', err)
      toast.error(err.message || 'Failed to add charge')
    } finally {
      setSavingCharge(false)
    }
  }

  // Initials helper
  const getInitials = (name: string) =>
    name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <DashboardLayout>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Client Ledger</h1>
            <p className="text-gray-600 dark:text-blue-200/70">Track charges and payments for client accounts</p>
          </div>
          <button
            onClick={() => setShowAddChargeModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Client Charge
          </button>
        </div>

        {/* Search */}
        <div className="card mb-6">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search clients by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-12"
            />
          </div>
        </div>

        {/* Client cards grid */}
        {loading ? (
          <div className="card text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-blue-200/70">Loading clients...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="card text-center py-12">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-500 dark:text-blue-200/70">
              {searchTerm ? 'No clients match your search.' : 'No clients yet. Add a charge to create the first client.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => router.push(`/admin/clients/${client.id}`)}
                className="card text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer border border-transparent"
              >
                <div className="flex items-start gap-4">
                  {/* Initials avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-lg ${
                    client.balance > 0
                      ? 'bg-gradient-to-br from-red-400 to-rose-600'
                      : 'bg-gradient-to-br from-green-400 to-emerald-600'
                  }`}>
                    {getInitials(client.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{client.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-blue-200/70 mt-0.5">
                      {client.transactionCount} transaction{client.transactionCount !== 1 ? 's' : ''}
                    </p>

                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-navy-200/15">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 dark:text-blue-200/70">Balance Due</span>
                        <span className={`text-lg font-bold font-mono ${
                          client.balance > 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {client.balance.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          Charged: {client.totalCharged.toLocaleString()} &nbsp;|&nbsp; Paid: {client.totalPaid.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status badge */}
                <div className="mt-3">
                  <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                    client.balance <= 0
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                  }`}>
                    {client.balance <= 0 ? 'Settled' : 'Outstanding'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Add Charge Modal */}
        {showAddChargeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-navy-850 rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Client Charge</h2>
                <button
                  onClick={() => { setShowAddChargeModal(false); setChargeForm(emptyChargeForm) }}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Client name with autocomplete */}
                <div className="relative">
                  <label className="label">Client Name</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={chargeForm.clientName}
                    onChange={(e) => {
                      setChargeForm(prev => ({ ...prev, clientName: e.target.value }))
                      setShowSuggestions(true)
                    }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onFocus={() => setShowSuggestions(true)}
                    className="input-field"
                    placeholder="Type a client name..."
                    autoComplete="off"
                  />
                  {showSuggestions && nameSuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-200/20 rounded-xl shadow-lg overflow-hidden">
                      {nameSuggestions.map((name) => (
                        <li
                          key={name}
                          onMouseDown={() => {
                            setChargeForm(prev => ({ ...prev, clientName: name }))
                            setShowSuggestions(false)
                          }}
                          className="px-4 py-2.5 text-sm text-gray-700 dark:text-blue-100 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer"
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <label className="label">Date</label>
                  <input
                    type="date"
                    value={chargeForm.date}
                    onChange={(e) => setChargeForm(prev => ({ ...prev, date: e.target.value }))}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="label">Amount (UGX)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={chargeForm.amount}
                    onChange={(e) => setChargeForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="label">Note (optional)</label>
                  <input
                    type="text"
                    value={chargeForm.note}
                    onChange={(e) => setChargeForm(prev => ({ ...prev, note: e.target.value }))}
                    className="input-field"
                    placeholder="e.g. Table 4 – unpaid dinner"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowAddChargeModal(false); setChargeForm(emptyChargeForm) }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCharge}
                  disabled={savingCharge}
                  className="btn-primary flex-1"
                >
                  {savingCharge ? 'Saving...' : 'Add Charge'}
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
