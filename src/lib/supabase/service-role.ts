import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Full-access client using the service_role key. Bypasses RLS entirely.
 *
 * ONLY use this from trusted server-only contexts that enforce their own
 * authorization: the realtime voice server, the campaign worker, webhook
 * handlers (after signature verification), and Super Admin API routes
 * (after re-checking profiles.platform_role = 'super_admin' on the caller).
 * Never import this into a Client Component or expose it to the browser.
 */
export function createServiceRoleClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use the service-role client."
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
