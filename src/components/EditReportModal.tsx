'use client'

import { useState } from 'react'
import { DailyReport, AccountType } from '@/types'
import { ACCOUNTS } from '@/lib/accounts'
import { format } from 'date-fns'
import CurrencyInput from '@/components/CurrencyInput'

export interface EditableExpense {
  id?: string
  description: string
  amount: number
  paid_from: AccountType
}

export interface EditableBill {
  id?: string
  customer_name: string
  amount: number
  original_amount: number
  notes: string
  isPaid?: boolean  // true when the bill has been settled via the Invoices tab
}

interface EditModalProps {
  report: DailyReport
  onClose: () => void
  onSave: (data: Partial<DailyReport>, expenses: EditableExpense[], bills: EditableBill[]) => void
  saving: boolean
}

export default function EditReportModal({ report, onClose, onSave, saving }: EditModalProps) {
  const [formData, setFormData] = useState({
    report_date: report.report_date,
    total_sales: report.total_sales,
    airtel_money: report.airtel_money,
    mtn_money: report.mtn_money,
    visa_card: report.visa_card,
    cash: report.cash,
    complementaries: report.complementaries,
    discounts: report.discounts,
    admin_comment: report.admin_comment || ''
  })

  const [expenses, setExpenses] = useState<EditableExpense[]>(
    report.expenses?.map(e => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      paid_from: e.paid_from,
    })) || []
  )

  const [bills, setBills] = useState<EditableBill[]>(
    report.unpaid_bills?.map(b => ({
      id: b.id,
      customer_name: b.customer_name,
      // Show the original recorded amount — payment adjustments live in the Invoices tab only
      amount: Number(b.original_amount) || Number(b.amount),
      original_amount: Number(b.original_amount) || Number(b.amount),
      notes: b.notes || '',
      isPaid: !!b.id && Number(b.amount) === 0,
    })) || []
  )

  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const totalBills = bills.reduce((s, b) => s + (Number(b.original_amount) || 0), 0)
  const cashAtHand = Number(formData.total_sales) - Number(formData.airtel_money) - Number(formData.mtn_money) -
    Number(formData.visa_card) - Number(formData.cash) - Number(formData.complementaries) - Number(formData.discounts)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData, expenses, bills)
  }

  // Expense helpers
  const addExpense = () => setExpenses(prev => [...prev, { description: '', amount: 0, paid_from: 'cash' }])
  const updateExpense = (i: number, field: keyof EditableExpense, value: string | number) =>
    setExpenses(prev => prev.map((exp, idx) => idx === i ? { ...exp, [field]: value } : exp))
  const removeExpense = (i: number) => setExpenses(prev => prev.filter((_, idx) => idx !== i))

  // Bill helpers
  const addBill = () => setBills(prev => [...prev, { customer_name: '', amount: 0, original_amount: 0, notes: '' }])
  const updateBill = (i: number, field: keyof EditableBill, value: string | number) =>
    setBills(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: value } : b))
  const removeBill = (i: number) => setBills(prev => prev.filter((_, idx) => idx !== i))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Report Details</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {format(new Date(formData.report_date), 'MMMM dd, yyyy')} · {(report as any).profiles?.full_name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Summary banner */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(16,185,129,.07)', border: '1px solid rgba(16,185,129,.2)' }}>
              <p className="text-xs text-emerald-700 font-medium mb-1">Cash at Hand</p>
              <p className="text-xl font-bold font-mono text-emerald-600">{cashAtHand.toLocaleString()}</p>
            </div>
            <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(220,38,38,.05)', border: '1px solid rgba(220,38,38,.18)' }}>
              <p className="text-xs text-red-600 font-medium mb-1">Expenses</p>
              <p className="text-xl font-bold font-mono text-red-600">{totalExpenses.toLocaleString()}</p>
            </div>
            <div className="rounded-xl px-4 py-3 text-center"
              style={{
                background: cashAtHand - totalExpenses >= 0 ? 'rgba(16,185,129,.07)' : 'rgba(220,38,38,.05)',
                border: `1px solid ${cashAtHand - totalExpenses >= 0 ? 'rgba(16,185,129,.2)' : 'rgba(220,38,38,.18)'}`,
              }}>
              <p className="text-xs font-medium mb-1" style={{ color: cashAtHand - totalExpenses >= 0 ? '#065f46' : '#991b1b' }}>Net Cash</p>
              <p className={`text-xl font-bold font-mono ${cashAtHand - totalExpenses >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {(cashAtHand - totalExpenses).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Edit notice */}
          {report.is_edited && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)' }}>
              <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-amber-800 font-medium">
                This report was edited
                {report.edited_at && <span className="font-normal text-amber-700 ml-1">on {format(new Date(report.edited_at), 'MMM dd, yyyy HH:mm')}</span>}
              </p>
            </div>
          )}

          {/* Sales inputs */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Sales Figures</p>
            <div className="mb-4">
              <label className="label">Report Date</label>
              <input
                type="date"
                value={formData.report_date}
                onChange={e => setFormData(prev => ({ ...prev, report_date: e.target.value }))}
                className="input-field"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Total Sales', key: 'total_sales' as const },
                { label: 'Cash', key: 'cash' as const },
                { label: 'Airtel Money', key: 'airtel_money' as const },
                { label: 'MTN Money', key: 'mtn_money' as const },
                { label: 'Visa Card', key: 'visa_card' as const },
                { label: 'Complementaries', key: 'complementaries' as const },
                { label: 'Discounts', key: 'discounts' as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData[key] || ''}
                    onChange={e => setFormData(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                    className="input-field"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Expenses — editable */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Expenses
                {totalExpenses > 0 && (
                  <span className="ml-2 font-mono text-red-500">{totalExpenses.toLocaleString()} UGX</span>
                )}
              </p>
              <button
                type="button"
                onClick={addExpense}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: 'rgba(220,38,38,.07)', color: '#dc2626', border: '1px solid rgba(220,38,38,.2)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Expense
              </button>
            </div>

            {expenses.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3 rounded-xl" style={{ border: '1px dashed rgba(220,38,38,.2)', background: 'rgba(220,38,38,.02)' }}>
                No expenses recorded
              </p>
            ) : (
              <div className="space-y-2">
                {expenses.map((exp, i) => (
                  <div key={i} className="flex gap-2 items-end p-3 rounded-xl" style={{ background: 'rgba(220,38,38,.03)', border: '1px solid rgba(220,38,38,.12)' }}>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 mb-1 block">Description</label>
                      <input
                        type="text"
                        value={exp.description}
                        onChange={e => updateExpense(i, 'description', e.target.value)}
                        placeholder="What was this expense for?"
                        className="input-field"
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-xs text-gray-400 mb-1 block">Amount (UGX)</label>
                      <CurrencyInput
                        value={exp.amount}
                        onValueChange={v => updateExpense(i, 'amount', v)}
                        className="input-field"
                      />
                    </div>
                    <div className="w-36">
                      <label className="text-xs text-gray-400 mb-1 block">Paid From</label>
                      <select
                        value={exp.paid_from}
                        onChange={e => updateExpense(i, 'paid_from', e.target.value)}
                        className="input-field"
                      >
                        {ACCOUNTS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExpense(i)}
                      className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors mb-0.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoices (unpaid bills) — editable */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Invoices
                {totalBills > 0 && (
                  <span className="ml-2 font-mono text-amber-600">{totalBills.toLocaleString()} UGX</span>
                )}
              </p>
              <button
                type="button"
                onClick={addBill}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: 'rgba(245,158,11,.08)', color: '#b45309', border: '1px solid rgba(245,158,11,.25)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Invoice
              </button>
            </div>

            {bills.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3 rounded-xl" style={{ border: '1px dashed rgba(245,158,11,.25)', background: 'rgba(245,158,11,.03)' }}>
                No invoices recorded
              </p>
            ) : (
              <div className="space-y-2">
                {bills.map((bill, i) => (
                  <div key={i} className="flex gap-2 items-end p-3 rounded-xl"
                    style={{ background: 'rgba(245,158,11,.04)', border: '1px solid rgba(245,158,11,.18)' }}>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 mb-1 block">Customer Name</label>
                      <input
                        type="text"
                        value={bill.customer_name}
                        onChange={e => updateBill(i, 'customer_name', e.target.value)}
                        placeholder="Customer name"
                        className="input-field"
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-xs text-gray-400 mb-1 block">Amount (UGX)</label>
                      <CurrencyInput
                        value={bill.amount}
                        onValueChange={v => {
                          updateBill(i, 'amount', v)
                          if (!bill.id) updateBill(i, 'original_amount', v)
                        }}
                        className="input-field"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 mb-1 block">Notes</label>
                      <input
                        type="text"
                        value={bill.notes}
                        onChange={e => updateBill(i, 'notes', e.target.value)}
                        placeholder="Optional notes"
                        className="input-field"
                      />
                    </div>
                    {bill.isPaid ? (
                      <div className="flex items-center justify-center w-8 h-8 mb-0.5" title="Paid via Invoices tab">
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 whitespace-nowrap">Paid</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeBill(i)}
                        className="p-2 rounded-lg text-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors mb-0.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin comment */}
          <div>
            <label className="label">Admin Comment <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={formData.admin_comment}
              onChange={e => setFormData(prev => ({ ...prev, admin_comment: e.target.value }))}
              className="input-field h-24"
              placeholder="Add a comment for the employee..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid #f1f5f9' }}>
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: '#0C2340' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
