import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  try {
    const supabaseAuth = createServerSupabaseClient()
    const { data: { session } } = await supabaseAuth.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('id, full_name, email, role, organization_id')
      .eq('id', session.user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Managers or superadmins can access
    const admin = getAdminClient()
    let query = admin
      .from('notifications')
      .select('*, organizations(id, name, slug)')
      .order('created_at', { ascending: false })

    if (profile.role !== 'superadmin' && profile.organization_id) {
      query = query.or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
    }

    const { data: notifications, error } = await query

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ notifications: [], pendingCount: 0 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const pending = (notifications || []).filter(n => n.status === 'pending')

    return NextResponse.json({
      notifications: notifications || [],
      pendingCount: pending.length,
      latestPending: pending[0] || null
    })
  } catch (err: any) {
    console.error('Error fetching manager notifications:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = createServerSupabaseClient()
    const { data: { session } } = await supabaseAuth.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('id, full_name, email, role, organization_id')
      .eq('id', session.user.id)
      .single()

    if (!profile || (profile.role !== 'manager' && profile.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Only managers can acknowledge notifications' }, { status: 403 })
    }

    const body = await req.json()
    const { id, referenceNotes } = body

    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 })
    }

    const admin = getAdminClient()
    const { data: notif, error: fetchErr } = await admin
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !notif) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    // Verify manager belongs to this org (unless superadmin)
    if (profile.role !== 'superadmin' && notif.organization_id && notif.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Unauthorized for this organization' }, { status: 403 })
    }

    const updatedNotes = referenceNotes
      ? (notif.notes ? `${notif.notes}\n[Manager Note]: ${referenceNotes}` : `[Manager Note]: ${referenceNotes}`)
      : notif.notes

    const { data: updated, error: updateErr } = await admin
      .from('notifications')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: profile.id,
        acknowledged_by_name: profile.full_name || profile.email,
        notes: updatedNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*, organizations(id, name, slug)')
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, notification: updated })
  } catch (err: any) {
    console.error('Error acknowledging notification:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

