'use client'

import { useState } from 'react'
import { DailyReport } from '@/types'
import { format } from 'date-fns'

interface EditModalProps {
  report: DailyReport
  onClose: () => void
  onSave: (data: Partial<DailyReport>) => void
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

  const expenses = report.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
  const unpaidBills = report.unpaid_bills?.reduce((sum, b) => sum + Number(b.amount), 0) || 0
  const cashAtHand = Number(formData.total_sales) - Number(formData.airtel_money) - Number(formData.mtn_money) -
                     Number(formData.visa_card) - Number(formData.cash) - Number(formData.complementaries) - Number(formData.discounts)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

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

          {/* Calculated summary banner */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(16,185,129,.07)', border: '1px solid rgba(16,185,129,.2)' }}>
              <p className="text-xs text-emerald-700 font-medium mb-1">Cash at Hand</p>
              <p className="text-xl font-bold font-mono text-emerald-600">{cashAtHand.toLocaleString()}</p>
            </div>
            <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(220,38,38,.05)', border: '1px solid rgba(220,38,38,.18)' }}>
              <p className="text-xs text-red-600 font-medium mb-1">Expenses</p>
              <p className="text-xl font-bold font-mono text-red-600">{expenses.toLocaleString()}</p>
            </div>
            <div className="rounded-xl px-4 py-3 text-center"
              style={{
                background: cashAtHand - expenses >= 0 ? 'rgba(16,185,129,.07)' : 'rgba(220,38,38,.05)',
                border: `1px solid ${cashAtHand - expenses >= 0 ? 'rgba(16,185,129,.2)' : 'rgba(220,38,38,.18)'}`,
              }}>
              <p className="text-xs font-medium mb-1" style={{ color: cashAtHand - expenses >= 0 ? '#065f46' : '#991b1b' }}>Net Cash</p>
              <p className={`text-xl font-bold font-mono ${cashAtHand - expenses >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {(cashAtHand - expenses).toLocaleString()}
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

          {/* Expenses list */}
          {report.expenses && report.expenses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Expenses</p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(220,38,38,.15)' }}>
                {report.expenses.map((expense, i) => (
                  <div key={expense.id} className="flex items-center justify-between px-4 py-2.5 text-sm"
                    style={{ background: i % 2 === 0 ? 'rgba(220,38,38,.03)' : 'transparent', borderTop: i > 0 ? '1px solid rgba(220,38,38,.08)' : undefined }}>
                    <span className="text-gray-600">{expense.description}</span>
                    <span className="font-mono font-semibold text-red-600">{Number(expense.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoices list */}
          {report.unpaid_bills && report.unpaid_bills.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Invoices</p>
                <span className="text-xs font-mono font-semibold text-amber-600">{unpaidBills.toLocaleString()} UGX total</span>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(245,158,11,.2)' }}>
                {report.unpaid_bills.map((bill, i) => (
                  <div key={bill.id} className="flex items-center justify-between px-4 py-2.5 text-sm"
                    style={{ background: i % 2 === 0 ? 'rgba(245,158,11,.04)' : 'transparent', borderTop: i > 0 ? '1px solid rgba(245,158,11,.1)' : undefined }}>
                    <div>
                      <span className="font-medium text-gray-800">{bill.customer_name}</span>
                      {bill.notes && <span className="text-gray-400 ml-2 text-xs">({bill.notes})</span>}
                    </div>
                    <span className="font-mono font-semibold text-amber-600">{Number(bill.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
