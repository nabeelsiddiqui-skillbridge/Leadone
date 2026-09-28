"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface AdminActionResult {
  error?: string;
  message?: string;
}

export interface PlanPatch {
  name: string;
  priceCents: number;
  maxAgents: number;
  maxCampaigns: number;
  maxContacts: number;
  concurrentCalls: number;
  monthlyMinutes: number;
}

/**
 * Edits a package's price/limits. Does not touch any workspace already on
 * this plan - a workspace's actual enforced limits live on workspaces.limits
 * (set at assignment time via assignWorkspacePlanAction) so existing
 * customers aren't silently changed by an admin tweaking the catalog.
 */
export async function updatePlanAction(planKey: string, patch: PlanPatch): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const db = createServiceRoleClient();

  const { error } = await db
    .from("plans")
    .update({
      name: patch.name,
      price_cents: patch.priceCents,
      max_agents: patch.maxAgents,
      max_campaigns: patch.maxCampaigns,
      max_contacts: patch.maxContacts,
      concurrent_calls: patch.concurrentCalls,
      monthly_minutes: patch.monthlyMinutes,
    })
    .eq("key", planKey);

  if (error) return { error: error.message };

  await db.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "plan.update",
    target_type: "plan",
    target_id: planKey,
    metadata: { ...patch },
  });

  revalidatePath("/super-admin/plans");
  return { message: "Plan saved." };
}
