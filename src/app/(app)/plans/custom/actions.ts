"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentWorkspace, requireUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface ActionState {
  error?: string;
  message?: string;
}

/**
 * The one write a workspace member can make on custom_plans: flip their own
 * workspace's draft offer to "requested". Routed through the service-role
 * client because custom_plans RLS is super_admin-write-only (see the
 * 20250101000900_custom_plans migration) - a looser member policy would let
 * them edit price/limits themselves, not just request the offer as-is. This
 * action re-derives everything server-side instead: it loads the row itself,
 * checks it belongs to the caller's workspace and is still a draft, and only
 * then flips the status - nothing from the client is trusted but the token.
 */
export async function requestCustomPlanAction(token: string): Promise<ActionState> {
  const user = await requireUser();
  const { workspace } = await requireCurrentWorkspace();
  const db = createServiceRoleClient();

  const { data: customPlan, error: fetchError } = await db
    .from("custom_plans")
    .select("id, workspace_id, status")
    .eq("token", token)
    .single();

  if (fetchError || !customPlan) return { error: "This package link is invalid." };
  if (customPlan.workspace_id !== workspace.id) {
    return { error: "This package isn't available on this account." };
  }
  if (customPlan.status !== "draft") {
    return { error: "This package has already been requested or is no longer available." };
  }

  const { error } = await db
    .from("custom_plans")
    .update({ status: "requested", requested_by: user.id, requested_at: new Date().toISOString() })
    .eq("id", customPlan.id);

  if (error) return { error: error.message };

  revalidatePath(`/plans/custom/${token}`);
  return { message: "Requested — we'll activate it as soon as it's approved." };
}
