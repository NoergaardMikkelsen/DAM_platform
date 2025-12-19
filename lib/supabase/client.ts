import { createBrowserClient } from "@supabase/ssr"

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

// Custom storage adapter that uses cookies with correct domain
function createCookieStorage() {
  const cookieDomain = process.env.NODE_ENV === 'production' ? '.brandassets.space' : '.localhost'
  
  return {
    getItem: (key: string): string | null => {
      if (typeof document === 'undefined') return null
      const cookies = document.cookie.split(';')
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=')
        if (name === key) {
          return decodeURIComponent(value)
        }
      }
      return null
    },
    setItem: (key: string, value: string): void => {
      if (typeof document === 'undefined') return
      const maxAge = 60 * 60 * 24 * 7 // 7 days
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
      const cookieString = `${key}=${encodeURIComponent(value)}; domain=${cookieDomain}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`
      
      document.cookie = cookieString
    },
    removeItem: (key: string): void => {
      if (typeof document === 'undefined') return
      document.cookie = `${key}=; domain=${cookieDomain}; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    },
  }
}

export function createClient() {
  if (supabaseClient) {
    return supabaseClient
  }

  supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: createCookieStorage(),
        storageKey: 'sb-auth-token',
        persistSession: true,
      },
      global: {
        headers: {
          'X-Client-Info': 'brandassets-platform',
        },
      },
    }
  )

  return supabaseClient
}
