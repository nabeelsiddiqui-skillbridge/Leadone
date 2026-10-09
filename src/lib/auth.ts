import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
type WorkspaceRole = Database["public"]["Enums"]["workspace_role"];

/**
 * A single page render calls this (directly or via requireUser/getProfile/
 * requireCurrentWorkspace) several times - each one used to be a separate
 * network round trip to Supabase Auth to validate the session, so a single
 * transient hiccup on any of those calls (not just a real "no session")
 * surfaced as an uncaught exception and crashed the whole page (React error
 * #441). `cache()` collapses them into one call per request, and a failed
 * call is treated the same as "no session" (redirect to login) instead of
 * taking the page down.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    console.error("supabase.auth.getUser() failed", err);
    return null;
  }
});

/** Redirects to /login if unauthenticated. Use at the top of protected pages/layouts. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data;
});

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
 * to none, which should only happen if the signup trigger failed. Cached per
 * request - a page's layout and the page itself both call this, and before
 * this it ran its query twice (plus two separate getUser() round trips).
 */
export const requireCurrentWorkspace = cache(async (): Promise<CurrentWorkspace> => {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(*)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });

  if (error) {
    console.error("Failed to load workspace memberships", error);
    redirect("/login");
  }

  const first = memberships?.[0];
  if (!first || !first.workspace) {
    redirect("/onboarding");
  }

  return { workspace: first.workspace as unknown as Workspace, role: first.role };
});
