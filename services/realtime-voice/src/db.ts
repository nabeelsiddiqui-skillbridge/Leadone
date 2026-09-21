import { createClient } from "@supabase/supabase-js";

import { config } from "./config.js";

/**
 * Service-role Supabase client. This process has no end-user session (it's
 * woken up by a Twilio WebSocket connection, not a logged-in browser), so it
 * always operates with full access and must do its own authorization: every
 * query here is already scoped by a `call_id`/`workspace_id` we resolved
 * from the call row itself, never from anything the caller/model can spoof.
 */
export const db = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
