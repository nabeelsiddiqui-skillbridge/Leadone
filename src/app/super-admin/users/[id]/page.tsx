import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserDetailActions } from "@/components/super-admin/user-detail-actions";

export const metadata: Metadata = { title: "Super Admin | User" };

interface WorkspaceRef {
  id: string;
  name: string;
  plan: string;
  status: string;
}

export default async function SuperAdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user: admin } = await requireSuperAdmin();
  // Normal RLS-scoped client: as a super_admin caller its policies already
  // grant reads across every workspace, with no workspace_id filter needed.
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (!profile) notFound();

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, joined_at, workspace:workspaces(id, name, plan, status)")
    .eq("user_id", id)
    .order("joined_at", { ascending: true });

  const workspaces: { role: string; workspace: WorkspaceRef }[] = [];
  for (const membership of memberships ?? []) {
    const workspace = membership.workspace as unknown as WorkspaceRef | null;
    if (workspace) {
      workspaces.push({ role: membership.role, workspace });
    }
  }

  const primaryWorkspace = workspaces[0]?.workspace ?? null;

  let counts = { agents: 0, campaigns: 0, contacts: 0, calls: 0, appointments: 0 };
  let recentCalls: Array<{
    id: string;
    status: string;
    outcome: string | null;
    created_at: string;
    agentName: string | null;
    contactLabel: string | null;
  }> = [];

  if (primaryWorkspace) {
    const [
      { count: agents },
      { count: campaigns },
      { count: contacts },
      { count: calls },
      { count: appointments },
      { data: recent },
    ] = await Promise.all([
      supabase
        .from("agents")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", primaryWorkspace.id),
      supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", primaryWorkspace.id),
      supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", primaryWorkspace.id),
      supabase
        .from("calls")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", primaryWorkspace.id),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", primaryWorkspace.id),
      supabase
        .from("calls")
        .select(
          "id, status, outcome, created_at, agent:agents(name), contact:contacts(first_name,last_name)"
        )
        .eq("workspace_id", primaryWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    counts = {
      agents: agents ?? 0,
      campaigns: campaigns ?? 0,
      contacts: contacts ?? 0,
      calls: calls ?? 0,
      appointments: appointments ?? 0,
    };

    recentCalls = (recent ?? []).map((call) => {
      const agent = call.agent as unknown as { name: string } | null;
      const contact = call.contact as unknown as {
        first_name: string | null;
        last_name: string | null;
      } | null;
      return {
        id: call.id,
        status: call.status,
        outcome: call.outcome,
        created_at: call.created_at,
        agentName: agent?.name ?? null,
        contactLabel: [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || null,
      };
    });
  }

  // profiles doesn't store email; look it up lazily via the Auth Admin API,
  // which requires the service-role client (RLS can't reach auth.users).
  let email: string | null = null;
  try {
    const serviceClient = createServiceRoleClient();
    const { data } = await serviceClient.auth.admin.getUserById(id);
    email = data.user?.email ?? null;
  } catch {
    // No live Supabase project / service-role key configured in this
    // environment — leave the email blank rather than fail the page.
    email = null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/super-admin/users"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to users
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {profile.full_name || "Unnamed user"}
            </h1>
            <p className="text-sm text-muted-foreground">{email ?? "Email unavailable"}</p>
          </div>
          <UserDetailActions
            userId={profile.id}
            fullName={profile.full_name}
            status={profile.status}
            isSelf={profile.id === admin.id}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={profile.status === "active" ? "success" : "destructive"}>
                {profile.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Platform role</span>
              <Badge variant={profile.platform_role === "super_admin" ? "warning" : "secondary"}>
                {profile.platform_role === "super_admin" ? "Super Admin" : "User"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Registered</span>
              <span>{new Date(profile.created_at).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Workspaces</CardTitle>
            <CardDescription>
              {workspaces.length === 0
                ? "Not a member of any workspace."
                : `Member of ${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {workspaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="divide-y">
                {workspaces.map(({ role, workspace }) => (
                  <li
                    key={workspace.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="font-medium">{workspace.name}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {role}
                      <Badge variant={workspace.status === "active" ? "success" : "destructive"}>
                        {workspace.status}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {primaryWorkspace && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            { label: "Agents", value: counts.agents },
            { label: "Campaigns", value: counts.campaigns },
            { label: "Contacts", value: counts.contacts },
            { label: "Calls", value: counts.calls },
            { label: "Appointments", value: counts.appointments },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-2">
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>
            Last {recentCalls.length || 10} calls
            {primaryWorkspace ? ` in ${primaryWorkspace.name}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calls yet.</p>
          ) : (
            <ul className="divide-y">
              {recentCalls.map((call) => (
                <li key={call.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{call.contactLabel ?? "Unknown contact"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {call.agentName ?? "—"} · {new Date(call.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={call.status === "completed" ? "success" : "secondary"}>
                    {call.outcome ?? call.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
