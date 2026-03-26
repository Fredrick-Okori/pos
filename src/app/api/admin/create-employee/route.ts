import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Verify the caller is a superadmin
  const supabaseAuth = createServerSupabaseClient()
  const { data: { session } } = await supabaseAuth.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (profile?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Parse request body
  const { email, password, full_name, organization_id } = await req.json()

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Use admin client with service role key
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Create the user with admin API (auto-confirms email)
  const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name,
      role: 'employee',
      organization_id: organization_id || null,
    },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  // Ensure the profile exists with correct organization
  const userId = userData.user.id
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  if (!existingProfile) {
    await supabaseAdmin.from('profiles').insert({
      id: userId,
      email,
      full_name,
      role: 'employee',
      organization_id: organization_id || null,
    })
  } else if (organization_id) {
    await supabaseAdmin
      .from('profiles')
      .update({ organization_id })
      .eq('id', userId)
  }

  return NextResponse.json({ user: userData.user })
}
