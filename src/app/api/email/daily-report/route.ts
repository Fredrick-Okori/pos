import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

interface Expense {
  description: string
  amount: number
  paidFrom: string
}

interface UnpaidBill {
  customerName: string
  amount: number
  notes?: string
}

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping email')
    return NextResponse.json({ skipped: true })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const {
      employeeName,
      reportDate,
      organizationName,
      organizationId,
      totalSales,
      cash,
      airtelMoney,
      mtnMoney,
      visaCard,
      usdAmount,
      exchangeRate,
      barSales,
      kitchenSales,
      shishaSales,
      complementaries,
      discounts,
      expenses,
      unpaidBills,
      reconStatus,
      reconDiff,
      notes,
    }: {
      employeeName: string
      reportDate: string
      organizationName: string
      organizationId?: string | null
      totalSales: number
      cash: number
      airtelMoney: number
      mtnMoney: number
      visaCard: number
      usdAmount: number
      exchangeRate: number
      barSales: number
      kitchenSales: number
      shishaSales: number
      complementaries: number
      discounts: number
      expenses: Expense[]
      unpaidBills: UnpaidBill[]
      reconStatus: 'RECONCILED' | 'SHORTAGE' | 'EXCESS' | null
      reconDiff: number
      notes: string
    } = await req.json()

    const formattedDate = new Date(reportDate).toLocaleDateString('en-UG', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    const totalUnpaid = unpaidBills.reduce((s, b) => s + b.amount, 0)
    const totalDeductions = complementaries + discounts
    const usdInUgx = Math.round(usdAmount * exchangeRate)
    const totalPayments = cash + airtelMoney + mtnMoney + visaCard + usdInUgx

    const reconColor =
      reconStatus === 'RECONCILED' ? '#34d399' :
      reconStatus === 'EXCESS'     ? '#fbbf24' : '#f87171'
    const reconBg =
      reconStatus === 'RECONCILED' ? 'rgba(16,185,129,.12)' :
      reconStatus === 'EXCESS'     ? 'rgba(245,158,11,.12)' : 'rgba(239,68,68,.12)'
    const reconBorder =
      reconStatus === 'RECONCILED' ? 'rgba(52,211,153,.3)' :
      reconStatus === 'EXCESS'     ? 'rgba(251,191,36,.3)' : 'rgba(248,113,113,.3)'

    const paymentMethods = [
      { label: 'Cash',         value: cash },
      { label: 'Airtel Money', value: airtelMoney },
      { label: 'MTN Money',    value: mtnMoney },
      { label: 'Visa Card',    value: visaCard },
      ...(usdAmount > 0 ? [{ label: `USD $${usdAmount.toLocaleString()} × ${exchangeRate.toLocaleString()}`, value: usdInUgx }] : []),
    ].filter(p => p.value > 0)

    const salesBreakdown = [
      { label: 'Bar',     value: barSales },
      { label: 'Kitchen', value: kitchenSales },
      { label: 'Shisha',  value: shishaSales },
    ].filter(s => s.value > 0)

    const row = (label: string, value: string, valueColor = '#f1f5f9') => `
      <tr>
        <td style="padding:10px 0;font-size:13px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,.05)">${label}</td>
        <td style="padding:10px 0;font-size:13px;font-weight:700;color:${valueColor};text-align:right;border-bottom:1px solid rgba(255,255,255,.05)">${value}</td>
      </tr>`

    const expensesHtml = expenses.length === 0 ? '' : `
      <!-- Expenses -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
        <tr>
          <td style="padding:18px 0 10px">
            <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em">Expenses (${expenses.length})</p>
          </td>
        </tr>
        <tr>
          <td style="background:#0f172a;border-radius:10px;border:1px solid rgba(255,255,255,.06);padding:0 16px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${expenses.map(e => row(
                `${e.description} <span style="color:#475569;font-weight:400;font-size:11px">(${e.paidFrom})</span>`,
                `UGX ${e.amount.toLocaleString()}`,
                '#fca5a5',
              )).join('')}
              ${row('<strong>Total Expenses</strong>', `UGX ${totalExpenses.toLocaleString()}`, '#f87171')}
            </table>
          </td>
        </tr>
      </table>`

    const billsHtml = unpaidBills.length === 0 ? '' : `
      <!-- Invoices -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
        <tr>
          <td style="padding:18px 0 10px">
            <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em">Invoices (${unpaidBills.length})</p>
          </td>
        </tr>
        <tr>
          <td style="background:#0f172a;border-radius:10px;border:1px solid rgba(255,255,255,.06);padding:0 16px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${unpaidBills.map(b => row(
                b.notes ? `${b.customerName} <span style="color:#475569;font-size:11px">(${b.notes})</span>` : b.customerName,
                `UGX ${b.amount.toLocaleString()}`,
                '#fcd34d',
              )).join('')}
              ${row('<strong>Total Unpaid</strong>', `UGX ${totalUnpaid.toLocaleString()}`, '#fbbf24')}
            </table>
          </td>
        </tr>
      </table>`

    let toList: string[] = []
    if (organizationId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: managers } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('organization_id', organizationId)
        .in('role', ['manager', 'superadmin'])
      if (managers) {
        toList = managers
          .map((p: { email: string | null }) => p.email)
          .filter((e): e is string => !!e)
      }
    }
    if (toList.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'no recipients' })
    }

    const { data, error } = await resend.emails.send({
      from: 'SEIV <finance@alloninc.com>',
      to: toList,
      subject: `${organizationName} - Daily Report - ${employeeName} - ${formattedDate}`,
      html: `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Daily Report</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=Questrial&display=swap');</style>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Questrial','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:48px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">

          <!-- Brand label -->
          <tr>
            <td style="padding-bottom:24px;text-align:center">
              <p style="margin:0 0 4px;font-size:28px;font-weight:800;color:#C9A84C;letter-spacing:-.5px;line-height:1">SEIV</p>
              <p style="margin:0;font-size:10px;font-weight:600;color:rgba(201,168,76,.55);letter-spacing:.22em;text-transform:uppercase">See Clearly</p>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background:#1e293b;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,.07)">

              <!-- Hero -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(160deg,#0C2340 0%,#1a3a5c 100%);padding:40px 40px 36px;text-align:center">

                    <!-- Icon -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px">
                      <tr>
                        <td style="width:72px;height:72px;border-radius:36px;background:linear-gradient(135deg,#C9A84C,#f0d980);text-align:center;vertical-align:middle">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="#0C2340" stroke-width="2" stroke-linecap="round"/>
                            <rect x="9" y="3" width="6" height="4" rx="1" stroke="#0C2340" stroke-width="2"/>
                            <path d="M9 12h6M9 16h4" stroke="#0C2340" stroke-width="2" stroke-linecap="round"/>
                          </svg>
                        </td>
                      </tr>
                    </table>

                    <!-- Badge -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px">
                      <tr>
                        <td style="padding:6px 16px 6px 12px;border-radius:30px;background:rgba(201,168,76,.18);border:1px solid rgba(201,168,76,.35)">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="vertical-align:middle;padding-right:7px">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="3" y="4" width="18" height="18" rx="3" stroke="#C9A84C" stroke-width="2"/>
                                  <path d="M3 9h18" stroke="#C9A84C" stroke-width="2"/>
                                  <path d="M8 2v4M16 2v4" stroke="#C9A84C" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                              </td>
                              <td style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;vertical-align:middle;white-space:nowrap">Daily Report</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <h1 style="margin:0 0 4px;color:#f8fafc;font-size:26px;font-weight:800;letter-spacing:-.5px">${formattedDate}</h1>
                    <p style="margin:0 0 6px;color:rgba(148,163,184,.65);font-size:13px">Submitted by ${employeeName}</p>
                    <p style="margin:0;display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.3);color:#C9A84C">${organizationName}</p>

                    <!-- Total Sales block -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px">
                      <tr>
                        <td style="padding:24px;background:rgba(0,0,0,.28);border-radius:14px;border:1px solid rgba(255,255,255,.06);text-align:center">
                          <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:rgba(148,163,184,.55);text-transform:uppercase;letter-spacing:.14em">Total Sales</p>
                          <p style="margin:0;font-size:42px;font-weight:800;color:#34d399;letter-spacing:-1px;line-height:1.1">UGX ${totalSales.toLocaleString()}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Reconciliation badge -->
                    ${reconStatus ? `
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 0">
                      <tr>
                        <td style="padding:8px 20px;border-radius:30px;background:${reconBg};border:1px solid ${reconBorder}">
                          <p style="margin:0;font-size:12px;font-weight:700;color:${reconColor};letter-spacing:.08em;text-transform:uppercase">
                            ${reconStatus === 'RECONCILED' ? 'Reconciled' : reconStatus === 'EXCESS' ? `Excess &nbsp;+UGX ${Math.abs(reconDiff).toLocaleString()}` : `Shortage &nbsp;-UGX ${Math.abs(reconDiff).toLocaleString()}`}
                          </p>
                        </td>
                      </tr>
                    </table>` : ''}

                  </td>
                </tr>
              </table>

              <!-- Body -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:32px 40px">

                    <!-- Payment Methods -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
                      <tr>
                        <td style="padding-bottom:10px">
                          <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em">Payment Received</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#0f172a;border-radius:10px;border:1px solid rgba(255,255,255,.06);padding:0 16px">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            ${paymentMethods.map(p => row(p.label, `UGX ${p.value.toLocaleString()}`)).join('')}
                            ${row('<strong>Total Received</strong>', `UGX ${totalPayments.toLocaleString()}`, '#34d399')}
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Deductions -->
                    ${(complementaries > 0 || discounts > 0) ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
                      <tr>
                        <td style="padding:18px 0 10px">
                          <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em">Deductions</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#0f172a;border-radius:10px;border:1px solid rgba(255,255,255,.06);padding:0 16px">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            ${complementaries > 0 ? row('Complementaries', `UGX ${complementaries.toLocaleString()}`, '#c4b5fd') : ''}
                            ${discounts > 0 ? row('Discounts', `UGX ${discounts.toLocaleString()}`, '#c4b5fd') : ''}
                            ${row('<strong>Total Deductions</strong>', `UGX ${totalDeductions.toLocaleString()}`, '#a78bfa')}
                          </table>
                        </td>
                      </tr>
                    </table>` : ''}

                    <!-- Sales Breakdown -->
                    ${salesBreakdown.length > 0 ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
                      <tr>
                        <td style="padding:18px 0 10px">
                          <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em">Sales Breakdown</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#0f172a;border-radius:10px;border:1px solid rgba(255,255,255,.06);padding:0 16px">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            ${salesBreakdown.map(s => row(s.label, `UGX ${s.value.toLocaleString()}`)).join('')}
                          </table>
                        </td>
                      </tr>
                    </table>` : ''}

                    ${expensesHtml}
                    ${billsHtml}

                    <!-- Notes -->
                    ${notes ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:18px 0 10px">
                          <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em">Notes</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#0f172a;border-radius:10px;border:1px solid rgba(255,255,255,.06);padding:14px 16px">
                          <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6">${notes}</p>
                        </td>
                      </tr>
                    </table>` : ''}

                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:0 40px"><div style="height:1px;background:rgba(255,255,255,.05)"></div></td></tr>
              </table>

              <!-- Footer -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:22px 40px;text-align:center">
                    <p style="margin:0 0 4px;font-size:12px;color:#334155;font-weight:700;text-transform:uppercase;letter-spacing:.1em">${organizationName} &nbsp;&middot;&nbsp; Management System</p>
                    <p style="margin:0;font-size:11px;color:#1e293b">${organizationName} Point of Sale &nbsp;&middot;&nbsp; Automated Report Notification</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Bottom note -->
          <tr>
            <td style="padding-top:20px;text-align:center">
              <p style="margin:0;font-size:11px;color:#1e3a5f">This is an automated notification. Do not reply to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err: any) {
    console.error('Daily report email error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
