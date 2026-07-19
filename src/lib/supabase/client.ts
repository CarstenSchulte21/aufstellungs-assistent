import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components (browser).
 * Uses the anon key; all access is governed by Row Level Security.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Implicit-Flow: Der Magic-Link liefert die Tokens im URL-Fragment und
      // braucht keinen browsergebundenen PKCE-Verifier — dadurch funktioniert
      // der Link geräte-/browserübergreifend. Die Session setzen wir in
      // /auth/callback selbst aus dem Fragment.
      auth: { flowType: "implicit", detectSessionInUrl: false },
    }
  );
}
