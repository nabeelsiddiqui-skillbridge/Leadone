import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Checks this workspace's usage this calendar month against the platform's
 * discovery_defaults system setting (Super Admin -> Settings -> APIs ->
 * System). A limit of 0 or unset means unlimited - this only ever blocks
 * when an admin has actually set a positive number.
 */
export async function checkDiscoveryLimits(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<{ error?: string }> {
  // system_settings is RLS-locked to super_admin only, so a regular
  // workspace member's session client can never read it - without this,
  // the setting would look unset (limits = {}) for every ordinary user and
  // the limit would silently never apply. This read alone needs to bypass
  // RLS; the usage-count queries below stay on the caller's own client
  // since a workspace member can already read their own workspace's rows.
  const { data: setting } = await createServiceRoleClient()
    .from("system_settings")
    .select("value")
    .eq("key", "discovery_defaults")
    .maybeSingle();
  const limits = (setting?.value as Record<string, number> | null) ?? {};
  const jobsLimit = limits.monthly_jobs_limit ?? 0;
  const leadsLimit = limits.monthly_leads_limit ?? 0;
  if (!jobsLimit && !leadsLimit) return {};

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  if (jobsLimit > 0) {
    const { count } = await supabase
      .from("discovery_jobs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", monthStart.toISOString());
    if ((count ?? 0) >= jobsLimit) {
      return { error: `This workspace has reached its discovery job limit for this month (${jobsLimit}). Contact support to raise it.` };
    }
  }

  if (leadsLimit > 0) {
    const { count } = await supabase
      .from("discovered_leads")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", monthStart.toISOString());
    if ((count ?? 0) >= leadsLimit) {
      return { error: `This workspace has reached its new-lead limit for this month (${leadsLimit}). Contact support to raise it.` };
    }
  }

  return {};
}
