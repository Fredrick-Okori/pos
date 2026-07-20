import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping email')
    return NextResponse.json({ skipped: true })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { clientName, amountPaid, remainingBalance, paymentMode, date, organizationName = 'Finance', organizationId } = await req.json()

    const formattedDate = new Date(date).toLocaleDateString('en-UG', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
    const shortDate = new Date(date).toLocaleDateString('en-UG', {
      year: 'numeric', month: 'short', day: 'numeric',
    })

    const modeLabels: Record<string, string> = {
      cash: 'Cash',
      airtel_money: 'Airtel Money',
      mtn_money: 'MTN Money',
      visa_card: 'Visa Card',
      stanbic: 'Stanbic Bank',
    }
    const modeLabel = modeLabels[paymentMode] ?? paymentMode
    const isCleared = Number(remainingBalance) <= 0
    const initials = clientName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

    const baseRecipients = ['elias@alloninc.com', 'fredrick@alloninc.com']
    let orgRecipients: string[] = []
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
        orgRecipients = managers
          .map((p: { email: string | null }) => p.email)
          .filter((e): e is string => !!e)
      }
    }
    const toList = Array.from(new Set([...baseRecipients, ...orgRecipients]))

    const { data, error } = await resend.emails.send({
      from: 'SEIV <finance@alloninc.com>',
      to: toList,
      subject: isCleared
        ? `${organizationName} - Balance Cleared - ${clientName}`
        : `${organizationName} - Payment Received - ${clientName} (UGX ${Number(amountPaid).toLocaleString()})`,
      html: `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${isCleared ? 'Balance Cleared' : 'Payment Received'}</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=Questrial&display=swap');</style>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Questrial','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:48px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

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

                    <!-- Avatar -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px">
                      <tr>
                        <td style="width:72px;height:72px;border-radius:36px;background:linear-gradient(135deg,#C9A84C,#f0d980);text-align:center;vertical-align:middle;font-size:26px;font-weight:800;color:#0C2340;letter-spacing:-.5px">
                          ${initials}
                        </td>
                      </tr>
                    </table>

                    <!-- Status badge with inline SVG icon -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px">
                      <tr>
                        <td style="padding:6px 16px 6px 12px;border-radius:30px;background:${isCleared ? 'rgba(16,185,129,.18)' : 'rgba(59,130,246,.18)'};border:1px solid ${isCleared ? 'rgba(52,211,153,.35)' : 'rgba(96,165,250,.35)'}">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="vertical-align:middle;padding-right:7px">
                                ${isCleared
                                  ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" stroke="#34d399" stroke-width="2"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="#34d399" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
                                  : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="5" width="20" height="14" rx="3" stroke="#60a5fa" stroke-width="2"/><path d="M2 10h20" stroke="#60a5fa" stroke-width="2"/><path d="M6 15h4" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/></svg>`
                                }
                              </td>
                              <td style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${isCleared ? '#34d399' : '#60a5fa'};vertical-align:middle;white-space:nowrap">
                                ${isCleared ? 'Balance Cleared' : 'Payment Received'}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <h1 style="margin:0 0 6px;color:#f8fafc;font-size:28px;font-weight:800;letter-spacing:-.5px">${clientName}</h1>
                    <p style="margin:0 0 8px;color:rgba(148,163,184,.65);font-size:13px">${formattedDate}</p>
                    <p style="margin:0;display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.3);color:#C9A84C">${organizationName}</p>

                    <!-- Amount block -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px">
                      <tr>
                        <td style="padding:24px;background:rgba(0,0,0,.28);border-radius:14px;border:1px solid rgba(255,255,255,.06);text-align:center">
                          <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:rgba(148,163,184,.55);text-transform:uppercase;letter-spacing:.14em">Amount Paid</p>
                          <p style="margin:0;font-size:40px;font-weight:800;color:#34d399;letter-spacing:-1px;line-height:1.1">UGX ${Number(amountPaid).toLocaleString()}</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- Detail rows -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:32px 40px">

                    <!-- Payment Method -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
                      <tr>
                        <td style="padding:14px 18px;background:#0f172a;border-radius:10px;border:1px solid rgba(255,255,255,.06)">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <table role="presentation" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="vertical-align:middle;padding-right:8px">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="5" width="20" height="14" rx="3" stroke="#64748b" stroke-width="2"/><path d="M2 10h20" stroke="#64748b" stroke-width="2"/><path d="M6 15h4" stroke="#64748b" stroke-width="2" stroke-linecap="round"/></svg>
                                    </td>
                                    <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;font-weight:600;vertical-align:middle">Payment Method</td>
                                  </tr>
                                </table>
                              </td>
                              <td style="font-size:14px;color:#f1f5f9;font-weight:700;text-align:right">${modeLabel}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Date Recorded -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
                      <tr>
                        <td style="padding:14px 18px;background:#0f172a;border-radius:10px;border:1px solid rgba(255,255,255,.06)">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <table role="presentation" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="vertical-align:middle;padding-right:8px">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="3" stroke="#64748b" stroke-width="2"/><path d="M3 9h18" stroke="#64748b" stroke-width="2"/><path d="M8 2v4M16 2v4" stroke="#64748b" stroke-width="2" stroke-linecap="round"/></svg>
                                    </td>
                                    <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;font-weight:600;vertical-align:middle">Date Recorded</td>
                                  </tr>
                                </table>
                              </td>
                              <td style="font-size:14px;color:#f1f5f9;font-weight:700;text-align:right">${shortDate}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Remaining Balance -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:14px 18px;background:${isCleared ? 'rgba(16,185,129,.08)' : 'rgba(245,158,11,.08)'};border-radius:10px;border:1px solid ${isCleared ? 'rgba(52,211,153,.22)' : 'rgba(251,191,36,.22)'}">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <table role="presentation" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="vertical-align:middle;padding-right:8px">
                                      ${isCleared
                                        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" stroke="#34d399" stroke-width="2"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="#34d399" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
                                        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" stroke="#fbbf24" stroke-width="2"/><path d="M12 7v5l3 3" stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round"/></svg>`
                                      }
                                    </td>
                                    <td style="font-size:12px;color:${isCleared ? '#6ee7b7' : '#fcd34d'};text-transform:uppercase;letter-spacing:.08em;font-weight:600;vertical-align:middle">Remaining Balance</td>
                                  </tr>
                                </table>
                              </td>
                              <td style="font-size:15px;color:${isCleared ? '#34d399' : '#fbbf24'};font-weight:800;text-align:right">
                                ${isCleared ? 'UGX 0 &mdash; Cleared' : `UGX ${Number(remainingBalance).toLocaleString()}`}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

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
                    <p style="margin:0;font-size:11px;color:#1e293b">${organizationName} Point of Sale &nbsp;&middot;&nbsp; Automated Payment Notification</p>
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
    console.error('Email route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
