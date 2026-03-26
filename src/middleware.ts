import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          )
          // Re-create response so it picks up the new request cookies
          res = NextResponse.next({ request: req })
          // Set cookies on the response (sent back to browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session — this writes updated cookies to the response
  const { data: { session } } = await supabase.auth.getSession()

  // Redirect to login if accessing protected routes without a session
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/admin') ||
                           req.nextUrl.pathname.startsWith('/employee')

  if (!session && isProtectedRoute) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
