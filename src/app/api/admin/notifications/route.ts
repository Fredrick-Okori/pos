import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Check if user is Fred (superadmin)
async function verifySuperFred() {
  const supabaseAuth = createServerSupabaseClient()
  const { data: { session } } = await supabaseAuth.auth.getSession()

  if (!session) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const userEmail = session.user.email?.toLowerCase()
  if (profile?.role !== 'superadmin' || userEmail !== 'fred.okori@kayeai.com') {
    return { error: 'Forbidden: Only fred.okori@kayeai.com has access to Notifications management', status: 403 }
  }

  return { session, user: session.user }
}

export async function GET() {
  try {
    const authCheck = await verifySuperFred()
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const admin = getAdminClient()

    // Always fetch organizations and their managers first
    const [{ data: orgs }, { data: managers }] = await Promise.all([
      admin.from('organizations').select('id, name, slug, is_active').order('name'),
      admin.from('profiles').select('id, full_name, email, role, organization_id').eq('role', 'manager'),
    ])

    // Then fetch notifications if table exists
    const { data: notifications, error } = await admin
      .from('notifications')
      .select('*, organizations(id, name, slug)')
      .order('created_at', { ascending: false })

    const tableMissing = Boolean(
      error &&
        (error.code === '42P01' ||
          error.code === 'PGRST205' ||
          error.message?.includes('does not exist'))
    )

    if (error && !tableMissing) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      notifications: tableMissing ? [] : (notifications || []),
      tableMissing,
      organizations: orgs || [],
      managers: managers || [],
      message: tableMissing
        ? 'The notifications table has not been created yet. Please execute supabase_notifications_migration.sql in Supabase SQL Editor.'
        : undefined
    })
  } catch (err: any) {
    console.error('Error fetching notifications:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifySuperFred()
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const body = await req.json()
    const {
      organizationIds,
      amount = 250000,
      currency = 'UGX',
      billingMonth,
      dueDate,
      title = 'Monthly System Utilization Fee - 250,000 UGX',
      message,
      paymentInstructions,
      sendEmail = true,
      isTest = false,
      testRecipient
    } = body

    const numAmount = Number(amount) || 250000
    const defaultMsg = message || `Please be reminded that the monthly system subscription fee of ${numAmount.toLocaleString()} ${currency} is due for ${billingMonth || 'this month'} to maintain active system access.`
    const defaultInstructions = paymentInstructions || `Payment Methods:
1. Stanbic Bank: Account Name: SEIV Systems | Account No: 9030012345678
2. Mobile Money: Airtel / MTN to +256 700 000 000 (Fred Okori)
Reference: [Organization Name] - Monthly Fee`

    // Handler for test emails to Fred
    if (isTest) {
      const recipient = testRecipient || authCheck.user.email || 'fred.okori@kayeai.com'
      if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 })
      }
      const resend = new Resend(process.env.RESEND_API_KEY)
      const formattedDueDate = dueDate
        ? new Date(dueDate).toLocaleDateString('en-UG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
        : 'Due upon receipt'

      const { data: emailData, error: emailErr } = await resend.emails.send({
        from: 'SEIV <finance@alloninc.com>',
        to: [recipient],
        subject: `[TEST] Payment Reminder: Monthly System Utilization Fee (${numAmount.toLocaleString()} ${currency}) - Test Organization`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>System Utilization Fee Notice (Test)</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#f8fafc">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e293b;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg, #0C2340 0%, #1A3A62 100%);border-bottom:1px solid rgba(201,168,76,0.3)">
              <table width="100%">
                <tr>
                  <td>
                    <div style="display:inline-block;padding:2px 8px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);border-radius:4px;font-size:10px;font-weight:700;color:#f87171;text-transform:uppercase;margin-bottom:6px">
                      Test Preview
                    </div>
                    <div style="font-size:22px;font-weight:700;letter-spacing:1px;color:#C9A84C">SEIV POS SYSTEM</div>
                    <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7)">Official Monthly Subscription & System Utilization Notice</p>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;padding:6px 12px;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);border-radius:6px;font-size:12px;font-weight:600;color:#C9A84C">
                      ${billingMonth || 'November 2026'}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px">
              <h2 style="margin:0 0 16px;font-size:18px;color:#ffffff">Hello Manager (Test Organization),</h2>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#cbd5e1">
                ${defaultMsg}
              </p>

              <!-- Amount Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(12,35,64,0.6);border:1px solid rgba(201,168,76,0.25);border-radius:8px;margin-bottom:24px">
                <tr>
                  <td style="padding:20px">
                    <table width="100%">
                      <tr>
                        <td>
                          <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8">Amount Due</span>
                          <div style="font-size:26px;font-weight:700;color:#f8fafc;margin-top:4px">
                            ${numAmount.toLocaleString()} <span style="font-size:16px;color:#C9A84C">${currency}</span>
                          </div>
                        </td>
                        <td align="right">
                          <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8">Due Date</span>
                          <div style="font-size:14px;font-weight:600;color:#e2e8f0;margin-top:4px">
                            ${formattedDueDate}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Payment Instructions -->
              <div style="background-color:#0f172a;border-radius:8px;padding:20px;border:1px solid rgba(255,255,255,0.08);margin-bottom:24px">
                <span style="font-size:12px;font-weight:700;color:#C9A84C;text-transform:uppercase;letter-spacing:0.05em">Payment Instructions</span>
                <pre style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#e2e8f0;white-space:pre-wrap;font-family:inherit">${defaultInstructions}</pre>
              </div>

              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5">
                After making payment, please log into your SEIV Manager account to confirm payment or contact Fred Okori directly.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#0b1329;border-top:1px solid rgba(255,255,255,0.05);text-align:center">
              <p style="margin:0;font-size:11px;color:#64748b">
                This is a test notification dispatched to ${recipient} • Sent by Fred Okori
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      })

      if (emailErr) {
        return NextResponse.json({ error: emailErr.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        isTest: true,
        recipient,
        emailId: emailData?.id,
        message: `Test email sent to ${recipient}`
      })
    }

    if (!organizationIds || !Array.isArray(organizationIds) || organizationIds.length === 0) {
      return NextResponse.json({ error: 'Please select at least one organization' }, { status: 400 })
    }

    if (!billingMonth) {
      return NextResponse.json({ error: 'Billing month is required (e.g. November 2026)' }, { status: 400 })
    }

    const admin = getAdminClient()

    // Fetch selected organizations
    const { data: orgs, error: orgError } = await admin
      .from('organizations')
      .select('id, name, slug')
      .in('id', organizationIds)

    if (orgError || !orgs || orgs.length === 0) {
      return NextResponse.json({ error: 'Selected organizations could not be found' }, { status: 400 })
    }

    // Fetch managers for these orgs
    const { data: managers } = await admin
      .from('profiles')
      .select('id, full_name, email, organization_id')
      .in('organization_id', organizationIds)
      .eq('role', 'manager')

    const createdNotifications: any[] = []

    // Insert one notification per organization
    for (const org of orgs) {
      const { data: notif, error: insertError } = await admin
        .from('notifications')
        .insert({
          organization_id: org.id,
          sender_id: authCheck.user.id,
          sender_email: authCheck.user.email?.toLowerCase() || 'fred.okori@kayeai.com',
          target_role: 'manager',
          title: title.trim(),
          message: defaultMsg.trim(),
          amount: numAmount,
          currency,
          billing_month: billingMonth.trim(),
          due_date: dueDate || null,
          status: 'pending',
          payment_instructions: defaultInstructions.trim(),
        })
        .select('*, organizations(id, name, slug)')
        .single()

      if (insertError) {
        if (insertError.code === '42P01' || insertError.message?.includes('does not exist')) {
          return NextResponse.json({
            error: 'Database table "notifications" has not been created yet. Please execute supabase_notifications_migration.sql in Supabase SQL Editor.',
            tableMissing: true
          }, { status: 400 })
        }
        console.error('Error inserting notification for org', org.id, insertError)
        continue
      }

      createdNotifications.push(notif)
    }

    // Send emails via Resend if enabled
    let emailsSent = 0
    if (sendEmail && process.env.RESEND_API_KEY && managers && managers.length > 0) {
      const resend = new Resend(process.env.RESEND_API_KEY)

      for (const org of orgs) {
        const orgManagers = managers.filter(m => m.organization_id === org.id && m.email)
        const recipientEmails = orgManagers.map(m => m.email)

        if (recipientEmails.length === 0) continue

        const formattedDueDate = dueDate
          ? new Date(dueDate).toLocaleDateString('en-UG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
          : 'Due upon receipt'

        try {
          await resend.emails.send({
            from: 'SEIV <finance@alloninc.com>',
            to: recipientEmails,
            subject: `Payment Reminder: Monthly System Utilization Fee (${numAmount.toLocaleString()} ${currency}) - ${org.name}`,
            html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>System Utilization Fee Notice</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#f8fafc">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e293b;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg, #0C2340 0%, #1A3A62 100%);border-bottom:1px solid rgba(201,168,76,0.3)">
              <table width="100%">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:700;letter-spacing:1px;color:#C9A84C">SEIV POS SYSTEM</span>
                    <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7)">Official Monthly Subscription & System Utilization Notice</p>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;padding:6px 12px;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);border-radius:6px;font-size:12px;font-weight:600;color:#C9A84C">
                      ${billingMonth}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px">
              <h2 style="margin:0 0 16px;font-size:18px;color:#ffffff">Hello Manager (${org.name}),</h2>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#cbd5e1">
                ${defaultMsg}
              </p>

              <!-- Amount Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(12,35,64,0.6);border:1px solid rgba(201,168,76,0.25);border-radius:8px;margin-bottom:24px">
                <tr>
                  <td style="padding:20px">
                    <table width="100%">
                      <tr>
                        <td>
                          <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8">Amount Due</span>
                          <div style="font-size:26px;font-weight:700;color:#f8fafc;margin-top:4px">
                            ${numAmount.toLocaleString()} <span style="font-size:16px;color:#C9A84C">${currency}</span>
                          </div>
                        </td>
                        <td align="right">
                          <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8">Due Date</span>
                          <div style="font-size:14px;font-weight:600;color:#e2e8f0;margin-top:4px">
                            ${formattedDueDate}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Payment Instructions -->
              <div style="background-color:#0f172a;border-radius:8px;padding:20px;border:1px solid rgba(255,255,255,0.08);margin-bottom:24px">
                <span style="font-size:12px;font-weight:700;color:#C9A84C;text-transform:uppercase;letter-spacing:0.05em">Payment Instructions</span>
                <pre style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#e2e8f0;white-space:pre-wrap;font-family:inherit">${defaultInstructions}</pre>
              </div>

              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5">
                After making payment, please log into your SEIV Manager account to confirm payment or contact Fred Okori directly.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#0b1329;border-top:1px solid rgba(255,255,255,0.05);text-align:center">
              <p style="margin:0;font-size:11px;color:#64748b">
                Sent by Fred Okori (fred.okori@kayeai.com) • SEIV Multi-Tenant Management
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
            `
          })
          emailsSent += recipientEmails.length
        } catch (emailErr) {
          console.error('Failed to send email to', recipientEmails, emailErr)
        }
      }
    }

    return NextResponse.json({
      success: true,
      createdCount: createdNotifications.length,
      emailsSent,
      notifications: createdNotifications
    }, { status: 201 })
  } catch (err: any) {
    console.error('Error creating notification:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authCheck = await verifySuperFred()
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const body = await req.json()
    const { id, status, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 })
    }

    const admin = getAdminClient()
    const updates: any = { updated_at: new Date().toISOString() }

    if (status) updates.status = status
    if (notes !== undefined) updates.notes = notes

    const { data: updated, error } = await admin
      .from('notifications')
      .update(updates)
      .eq('id', id)
      .select('*, organizations(id, name, slug)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notification: updated })
  } catch (err: any) {
    console.error('Error updating notification:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

