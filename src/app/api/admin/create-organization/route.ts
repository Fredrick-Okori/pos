import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // 1. Verify caller is authenticated superadmin
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

    const userEmail = session.user.email?.toLowerCase()
    if (profile?.role !== 'superadmin' || userEmail !== 'fred.okori@kayeai.com') {
      return NextResponse.json(
        { error: 'Forbidden: Only fred.okori@kayeai.com can create organizations' },
        { status: 403 }
      )
    }

    // 2. Parse and validate input
    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const rawSlug = typeof body.slug === 'string' ? body.slug.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : null

    if (!name) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
    }

    // Auto-generate slug from name if not provided, and sanitize
    const slug = (rawSlug || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    if (!slug) {
      return NextResponse.json({ error: 'A valid slug could not be generated' }, { status: 400 })
    }

    // 3. Use admin service role client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check if slug already exists
    const { data: existing } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `An organization with slug "${slug}" already exists ("${existing.name}")` },
        { status: 409 }
      )
    }

    // Insert organization
    const { data: newOrg, error: insertError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        slug,
        description: description || null,
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating organization:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ organization: newOrg }, { status: 201 })
  } catch (err: any) {
    console.error('Unexpected error in create-organization:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

