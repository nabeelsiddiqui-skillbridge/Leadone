"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface AdminActionResult {
  error?: string;
  message?: string;
}

/**
 * Suspends or re-activates a user account (profiles.status). This is an
 * ordinary workspace-agnostic table update through the normal RLS-scoped
 * client — profiles' update policy already allows a super_admin caller.
 */
export async function setUserStatusAction(
  userId: string,
  nextStatus: "active" | "suspended"
): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const supabase = await createClient();

  const { data: target, error: fetchError } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("id", userId)
    .single();

  if (fetchError || !target) {
    return { error: "User not found." };
  }

  if (target.status === nextStatus) {
    return { message: nextStatus === "suspended" ? "User already suspended." : "User already active." };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ status: nextStatus })
    .eq("id", userId);

  if (updateError) {
    return { error: updateError.message };
  }

  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: nextStatus === "suspended" ? "user.suspend" : "user.activate",
    target_type: "user",
    target_id: userId,
    metadata: { previous_status: target.status, new_status: nextStatus },
  });

  if (auditError) {
    return { error: `Status updated, but the audit log entry failed: ${auditError.message}` };
  }

  revalidatePath("/super-admin/users");
  revalidatePath(`/super-admin/users/${userId}`);

  return { message: nextStatus === "suspended" ? "User suspended." : "User activated." };
}

/**
 * Permanently deletes a user's auth.users row via the Supabase Auth Admin
 * API. Postgres RLS cannot do this — it isn't a table row — so this is the
 * one operation in this module that needs the service-role client. FK
 * cascades/set-nulls already declared on the schema handle owned data;
 * deleting a user who solely owns a workspace (owner_id references
 * profiles(id) on delete restrict) will fail with a clear Postgres error,
 * which is surfaced to the caller rather than worked around here.
 */
/**
 * Triggers the same "forgot password" email a user would send themselves,
 * on an admin's behalf. Still goes through Supabase Auth's configured
 * email delivery, so it inherits whatever SMTP is set up for the project.
 */
export async function sendPasswordResetEmailAction(userId: string): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();

  const serviceClient = createServiceRoleClient();
  const { data: userData, error: lookupError } = await serviceClient.auth.admin.getUserById(userId);
  if (lookupError || !userData.user?.email) {
    return { error: "Could not find an email address for this user." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(userData.user.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/reset-password`,
  });
  if (error) {
    return { error: error.message };
  }

  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "user.password_reset_email_sent",
    target_type: "user",
    target_id: userId,
    metadata: {},
  });
  if (auditError) {
    return { error: `Reset email sent, but the audit log entry failed: ${auditError.message}` };
  }

  return { message: `Reset link sent to ${userData.user.email}.` };
}

/**
 * Sets a user's password directly, bypassing email entirely — useful when
 * SMTP isn't configured yet, or the user can't access their inbox. The
 * password itself is never written to the audit log.
 */
export async function setUserPasswordAction(userId: string, newPassword: string): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) {
    return { error: error.message };
  }

  const supabase = await createClient();
  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "user.password_set_by_admin",
    target_type: "user",
    target_id: userId,
    metadata: {},
  });
  if (auditError) {
    return { error: `Password updated, but the audit log entry failed: ${auditError.message}` };
  }

  return { message: "Password updated." };
}

export async function deleteUserAction(userId: string): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();

  if (admin.id === userId) {
    return { error: "You cannot delete your own super admin account." };
  }

  const serviceClient = createServiceRoleClient();
  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  const supabase = await createClient();
  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "user.delete",
    target_type: "user",
    target_id: userId,
    metadata: {},
  });

  if (auditError) {
    return { error: `User deleted, but the audit log entry failed: ${auditError.message}` };
  }

  revalidatePath("/super-admin/users");

  return { message: "User deleted." };
}

/**
 * One-click plan change: copies the chosen plan's limits onto the
 * workspace's own `limits` jsonb column (what campaign/agent-creation
 * limit checks actually read) and sets `plan` to the plan's key.
 */
export async function assignWorkspacePlanAction(workspaceId: string, planKey: string): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const supabase = await createClient();

  const { data: plan, error: planError } = await supabase.from("plans").select("*").eq("key", planKey).single();
  if (planError || !plan) return { error: "Plan not found." };

  const { error: updateError } = await supabase
    .from("workspaces")
    .update({
      plan: plan.key,
      limits: {
        agents: plan.max_agents,
        campaigns: plan.max_campaigns,
        contacts: plan.max_contacts,
        concurrent_calls: plan.concurrent_calls,
        monthly_minutes: plan.monthly_minutes,
      },
    })
    .eq("id", workspaceId);

  if (updateError) return { error: updateError.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "workspace.plan_change",
    target_type: "workspace",
    target_id: workspaceId,
    metadata: { plan: plan.key },
  });

  revalidatePath("/super-admin/users");
  return { message: `Plan changed to ${plan.name}.` };
}
