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
