import { createClient } from "@supabase/supabase-js";

import { config } from "./config.js";

/** Service-role client: this process has no end-user session. */
export const db = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
