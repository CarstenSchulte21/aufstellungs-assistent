import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-seitiger Supabase-Client mit service_role-Key. Umgeht RLS —
 * NUR in serverseitigem Code verwenden (Bot-Webhook, Cron-Jobs), niemals im
 * Browser. Der Key steht ausschließlich in den Umgebungsvariablen.
 */
export function getAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
