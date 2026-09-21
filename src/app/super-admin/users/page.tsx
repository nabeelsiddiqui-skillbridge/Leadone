import type { Metadata } from "next";

import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UsersTable, type AdminUserRow } from "@/components/super-admin/users-table";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Super Admin | Users" };

interface WorkspaceRef {
  id: string;
  name: string;
}

export default async function SuperAdminUsersPage() {
  const { user: admin } = await requireSuperAdmin();
  // Normal RLS-scoped client: profiles/workspace_members' select policies OR
  // in is_super_admin(), so this already returns every user across every
  // workspace with no workspace_id filter needed.
  const supabase = await createClient();

  const [{ data: profiles }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase
      .from("workspace_members")
      .select("user_id, joined_at, workspace:workspaces(id, name)")
      .order("joined_at", { ascending: true }),
  ]);

  // First membership per user (by joined_at) stands in for their "primary" workspace.
  const primaryWorkspaceByUser = new Map<string, WorkspaceRef>();
  for (const membership of memberships ?? []) {
    const workspace = membership.workspace as unknown as WorkspaceRef | null;
    if (!workspace) continue;
    if (!primaryWorkspaceByUser.has(membership.user_id)) {
      primaryWorkspaceByUser.set(membership.user_id, workspace);
    }
  }

  const rows: AdminUserRow[] = await Promise.all(
    (profiles ?? []).map(async (profile) => {
      const workspace = primaryWorkspaceByUser.get(profile.id) ?? null;

      let agentCount = 0;
      let campaignCount = 0;
      let callCount = 0;

      if (workspace) {
        const [{ count: agents }, { count: campaigns }, { count: calls }] = await Promise.all([
          supabase
            .from("agents")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspace.id),
          supabase
            .from("campaigns")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspace.id),
          supabase
            .from("calls")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspace.id),
        ]);
        agentCount = agents ?? 0;
        campaignCount = campaigns ?? 0;
        callCount = calls ?? 0;
      }

      return {
        id: profile.id,
        fullName: profile.full_name,
        status: profile.status,
        platformRole: profile.platform_role,
        createdAt: profile.created_at,
        workspaceName: workspace?.name ?? null,
        agentCount,
        campaignCount,
        callCount,
      };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Every registered account across the platform. Profiles don&apos;t store email — open
          an account to look one up.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No users yet" description="Registered users will show up here." />
      ) : (
        <div className="rounded-lg border">
          <UsersTable users={rows} currentAdminId={admin.id} />
        </div>
      )}
    </div>
  );
}
