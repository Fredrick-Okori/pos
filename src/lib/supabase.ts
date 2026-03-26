import { createBrowserClient } from '@supabase/ssr'

// Create a singleton instance to avoid multiple clients competing for auth locks
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export const createClient = () => {
  if (!supabaseClient) {
    supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return supabaseClient
}
