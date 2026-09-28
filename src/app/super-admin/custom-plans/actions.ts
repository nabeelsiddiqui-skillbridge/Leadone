"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface AdminActionResult {
  error?: string;
  message?: string;
}

export interface CustomPlanPatch {
  name: string;
  description: string;
  priceCents: number;
  maxAgents: number;
  maxCampaigns: number;
  maxContacts: number;
  concurrentCalls: number;
  monthlyMinutes: number;
}

/**
 * Creates a draft custom package for a workspace. Only one row exists per
 * "offer" - callers should only show the create form when the workspace has
 * no existing draft/requested/active custom_plans row (see the users/[id]
 * detail page), so this doesn't attempt to enforce single-active-row itself.
 */
export async function createCustomPlanAction(workspaceId: string, patch: CustomPlanPatch): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const supabase = await createClient();

  if (!patch.name.trim()) return { error: "Name is required." };

  const { error } = await supabase.from("custom_plans").insert({
    workspace_id: workspaceId,
    created_by: admin.id,
    name: patch.name.trim(),
    description: patch.description.trim() || null,
    price_cents: patch.priceCents,
    max_agents: patch.maxAgents,
    max_campaigns: patch.maxCampaigns,
    max_contacts: patch.maxContacts,
    concurrent_calls: patch.concurrentCalls,
    monthly_minutes: patch.monthlyMinutes,
    status: "draft",
  });

  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "custom_plan.create",
    target_type: "workspace",
    target_id: workspaceId,
    metadata: { name: patch.name },
  });

  revalidatePath(`/super-admin/users`);
  return { message: "Custom package created." };
}

/** Edits a draft (pre-request) custom package - name, price, limits, all of it. */
export async function updateCustomPlanAction(id: string, patch: CustomPlanPatch): Promise<AdminActionResult> {
  await requireSuperAdmin();
  const supabase = await createClient();

  if (!patch.name.trim()) return { error: "Name is required." };

  const { data: existing } = await supabase.from("custom_plans").select("status").eq("id", id).single();
  if (!existing) return { error: "Custom package not found." };
  if (existing.status !== "draft") return { error: "Only a draft package can be edited." };

  const { error } = await supabase
    .from("custom_plans")
    .update({
      name: patch.name.trim(),
      description: patch.description.trim() || null,
      price_cents: patch.priceCents,
      max_agents: patch.maxAgents,
      max_campaigns: patch.maxCampaigns,
      max_contacts: patch.maxContacts,
      concurrent_calls: patch.concurrentCalls,
      monthly_minutes: patch.monthlyMinutes,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/super-admin/users`);
  return { message: "Custom package updated." };
}

/** Deletes a draft that hasn't been requested yet, so the admin can start over. */
export async function cancelCustomPlanAction(id: string): Promise<AdminActionResult> {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { data: existing } = await supabase.from("custom_plans").select("status").eq("id", id).single();
  if (!existing) return { error: "Custom package not found." };
  if (existing.status === "active") return { error: "An active custom package can't be canceled here." };

  const { error } = await supabase.from("custom_plans").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/super-admin/users`);
  return { message: "Custom package removed." };
}

/**
 * Approves a requested custom package: applies its limits/name to the
 * workspace (the same shape assignWorkspacePlanAction uses for catalog
 * plans) and marks the row active.
 */
export async function approveCustomPlanAction(id: string): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const supabase = await createClient();

  const { data: customPlan, error: fetchError } = await supabase
    .from("custom_plans")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !customPlan) return { error: "Custom package not found." };
  if (customPlan.status !== "requested") return { error: "This package hasn't been requested yet." };

  const { error: workspaceError } = await supabase
    .from("workspaces")
    .update({
      plan: customPlan.name,
      limits: {
        agents: customPlan.max_agents,
        campaigns: customPlan.max_campaigns,
        contacts: customPlan.max_contacts,
        concurrent_calls: customPlan.concurrent_calls,
        monthly_minutes: customPlan.monthly_minutes,
      },
    })
    .eq("id", customPlan.workspace_id);

  if (workspaceError) return { error: workspaceError.message };

  const { error: statusError } = await supabase
    .from("custom_plans")
    .update({ status: "active", approved_by: admin.id, approved_at: new Date().toISOString() })
    .eq("id", id);

  if (statusError) return { error: statusError.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "custom_plan.approve",
    target_type: "workspace",
    target_id: customPlan.workspace_id,
    metadata: { name: customPlan.name, price_cents: customPlan.price_cents },
  });

  revalidatePath(`/super-admin/users`);
  revalidatePath(`/plans/custom/${customPlan.token}`);
  return { message: `Activated "${customPlan.name}" for the workspace.` };
}

export async function rejectCustomPlanAction(id: string): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const supabase = await createClient();

  const { data: customPlan, error: fetchError } = await supabase
    .from("custom_plans")
    .select("token, status")
    .eq("id", id)
    .single();
  if (fetchError || !customPlan) return { error: "Custom package not found." };

  const { error } = await supabase.from("custom_plans").update({ status: "rejected" }).eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "custom_plan.reject",
    target_type: "custom_plan",
    target_id: id,
    metadata: {},
  });

  revalidatePath(`/super-admin/users`);
  revalidatePath(`/plans/custom/${customPlan.token}`);
  return { message: "Custom package rejected." };
}
