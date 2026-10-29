import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/** Supabase client for server components and server actions, signed in as the current staff member. */
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(list) {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a server component; the middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
