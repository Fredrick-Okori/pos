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
  const [filterStatus, setFilterStatus] = useState<'all' | 'outstanding' | 'settled'>('all')

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
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  // Summary totals
  const totalOutstanding = clients.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0)
  const totalCharged = clients.reduce((s, c) => s + c.totalCharged, 0)
  const totalPaid = clients.reduce((s, c) => s + c.totalPaid, 0)
  const outstandingCount = clients.filter(c => c.balance > 0).length
  const settledCount = clients.filter(c => c.balance <= 0).length

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'outstanding' && c.balance > 0) ||
      (filterStatus === 'settled' && c.balance <= 0)
    return matchesSearch && matchesStatus
  })

  const exportLedger = () => {
    const date = new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })
    const rows = clients
      .sort((a, b) => b.balance - a.balance)
      .map(c => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:500">${c.name}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${c.totalCharged.toLocaleString()}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;color:#16a34a">${c.totalPaid.toLocaleString()}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:${c.balance > 0 ? '#dc2626' : '#16a34a'}">${c.balance.toLocaleString()}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center">
            <span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;background:${c.balance <= 0 ? 'rgba(22,163,74,.12)' : 'rgba(220,38,38,.12)'};color:${c.balance <= 0 ? '#16a34a' : '#dc2626'}">
              ${c.balance <= 0 ? 'SETTLED' : 'OUTSTANDING'}
            </span>
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;color:#666">${c.transactionCount}</td>
        </tr>`)
      .join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Client Ledger – Krug Ten Eleven</title>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#111;padding:40px;max-width:960px;margin:0 auto}
  h1{font-size:22px;color:#0C2340;margin-bottom:4px;font-weight:700}
  .sub{font-size:11px;color:#666;margin-bottom:24px}
  .cards{display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap}
  .card{background:#f4f8ff;border-radius:8px;padding:12px 18px;min-width:130px;border:1px solid #e2e8f0}
  .card-label{font-size:10px;color:#666;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em}
  .card-val{font-size:19px;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;padding:8px 10px;background:#0C2340;color:#fff;font-size:11px;font-weight:600}
  th.r{text-align:right}th.c{text-align:center}
  tr:hover td{background:#f9fafb}
  .footer{margin-top:32px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:12px;text-align:center}
  .print-btn{display:inline-flex;align-items:center;gap:8px;margin-bottom:24px;padding:9px 20px;background:#0C2340;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  .print-btn:hover{background:#1E4A7A}
  @media print{.print-btn{display:none!important}body{padding:20px}@page{margin:15mm}}
</style></head>
<body>
<button class="print-btn" onclick="window.print()">&#128438; Save as PDF / Print</button>
<h1>Client Ledger Overview</h1>
<div class="sub">Krug Ten Eleven Bar &amp; Restaurant &middot; SEIV System &middot; Generated ${date}</div>
<div class="cards">
  <div class="card"><div class="card-label">Total Charged</div><div class="card-val" style="color:#0C2340">${totalCharged.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Total Paid</div><div class="card-val" style="color:#16a34a">${totalPaid.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Total Outstanding</div><div class="card-val" style="color:#dc2626">${totalOutstanding.toLocaleString()} UGX</div></div>
  <div class="card"><div class="card-label">Clients</div><div class="card-val">${clients.length} total &middot; ${outstandingCount} owing</div></div>
</div>
<table>
  <thead><tr><th>Client</th><th class="r">Total Charged (UGX)</th><th class="r">Total Paid (UGX)</th><th class="r">Balance (UGX)</th><th class="c">Status</th><th class="c">Transactions</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">SEIV &middot; Krug Ten Eleven Bar &amp; Restaurant &middot; This is a system-generated ledger overview.</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});</script>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'width=960,height=720')
    if (!win) { toast.error('Allow popups to export PDF'); URL.revokeObjectURL(url); return }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const emailLedger = () => {
    const owingList = clients
      .filter(c => c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 15)
      .map(c => `  ${c.name}: UGX ${c.balance.toLocaleString()}`)
      .join('\n')
    const subject = encodeURIComponent('Client Ledger Summary · Krug Ten Eleven')
    const body = encodeURIComponent(
      `Client Ledger Summary – Krug Ten Eleven Bar & Restaurant\n` +
      `Generated: ${new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
      `Total Charged:     UGX ${totalCharged.toLocaleString()}\n` +
      `Total Paid:        UGX ${totalPaid.toLocaleString()}\n` +
      `Total Outstanding: UGX ${totalOutstanding.toLocaleString()}\n` +
      `Clients Owing:     ${outstandingCount} of ${clients.length}\n\n` +
      `Outstanding Clients:\n${owingList || '  None'}\n\n` +
      `Powered by SEIV · Krug Ten Eleven Bar & Restaurant`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <DashboardLayout>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Ledger</h1>
            <p className="text-gray-500">Track charges and payments for client accounts</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={emailLedger}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </button>
            <button
              onClick={exportLedger}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export PDF
            </button>
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
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Charged</p>
            <p className="text-xl font-bold text-gray-900 font-mono">{totalCharged.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">UGX</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Paid</p>
            <p className="text-xl font-bold text-green-600 font-mono">{totalPaid.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">UGX</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Outstanding</p>
            <p className="text-xl font-bold text-red-600 font-mono">{totalOutstanding.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{outstandingCount} client{outstandingCount !== 1 ? 's' : ''} owing</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Settled</p>
            <p className="text-xl font-bold text-gray-900">{settledCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">of {clients.length} clients</p>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="card mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
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
          <div className="flex gap-1 shrink-0">
            {(['all', 'outstanding', 'settled'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  filterStatus === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Client cards grid */}
        {loading ? (
          <div className="card text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading clients...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="card text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-400">
              {searchTerm ? 'No clients match your search.' : 'No clients yet. Add a charge to create the first client.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => router.push(`/admin/clients/${client.id}`)}
                className="card text-left hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer border border-transparent"
              >
                <div className="flex items-start gap-4">
                  {/* Initials avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-gray-900 font-bold text-lg ${
                    client.balance > 0
                      ? 'bg-gradient-to-br from-red-400 to-rose-600'
                      : 'bg-gradient-to-br from-green-400 to-emerald-600'
                  }`}>
                    {getInitials(client.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{client.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {client.transactionCount} transaction{client.transactionCount !== 1 ? 's' : ''}
                    </p>

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Balance Due</span>
                        <span className={`text-lg font-bold font-mono ${
                          client.balance > 0
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}>
                          {client.balance.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-400">
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
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Add Client Charge</h2>
                <button
                  onClick={() => { setShowAddChargeModal(false); setChargeForm(emptyChargeForm) }}
                  className="p-1 text-gray-400 hover:text-gray-500 rounded-lg"
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
                    <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      {nameSuggestions.map((name) => (
                        <li
                          key={name}
                          onMouseDown={() => {
                            setChargeForm(prev => ({ ...prev, clientName: name }))
                            setShowSuggestions(false)
                          }}
                          className="px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
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
