import "server-only";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
type WorkspaceRole = Database["public"]["Enums"]["workspace_role"];

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Redirects to /login if unauthenticated. Use at the top of protected pages/layouts. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data;
}

/** Redirects to /dashboard if the user is not a super_admin. */
export async function requireSuperAdmin() {
  const user = await requireUser();
  const profile = await getProfile();
  if (profile?.platform_role !== "super_admin") {
    redirect("/dashboard");
  }
  return { user, profile };
}

export interface CurrentWorkspace {
  workspace: Workspace;
  role: WorkspaceRole;
}

/**
 * Returns the caller's active workspace (the one they own, or their first
 * membership) plus their role in it. Redirects to onboarding if they belong
 * to none, which should only happen if the signup trigger failed.
 */
export async function requireCurrentWorkspace(): Promise<CurrentWorkspace> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(*)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });

  const first = memberships?.[0];
  if (!first || !first.workspace) {
    redirect("/onboarding");
  }

  return { workspace: first.workspace as unknown as Workspace, role: first.role };
}
