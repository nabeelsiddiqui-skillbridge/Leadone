import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminAgentRowActions } from "@/components/super-admin/admin-agent-row-actions";

export const metadata: Metadata = { title: "Super Admin | Agents" };

export default async function SuperAdminAgentsPage() {
  // No workspace_id filter: RLS already grants a super_admin caller every
  // workspace's rows through the normal client (see src/app/super-admin/page.tsx).
  const supabase = await createClient();

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, status, voice, language, created_at, updated_at, workspace:workspaces(id, name)")
    .order("created_at", { ascending: false })
    .limit(500);

  const agentIds = (agents ?? []).map((a) => a.id);
  const [{ data: campaignRows }, { data: callRows }] = await Promise.all([
    agentIds.length
      ? supabase.from("campaigns").select("agent_id").in("agent_id", agentIds)
      : Promise.resolve({ data: [] as { agent_id: string }[] }),
    agentIds.length
      ? supabase.from("calls").select("agent_id").in("agent_id", agentIds)
      : Promise.resolve({ data: [] as { agent_id: string | null }[] }),
  ]);

  const campaignCounts = new Map<string, number>();
  for (const row of campaignRows ?? []) {
    campaignCounts.set(row.agent_id, (campaignCounts.get(row.agent_id) ?? 0) + 1);
  }
  const callCounts = new Map<string, number>();
  for (const row of callRows ?? []) {
    if (!row.agent_id) continue;
    callCounts.set(row.agent_id, (callCounts.get(row.agent_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Agents" description="Every AI agent across every workspace on the platform." />

      {!agents || agents.length === 0 ? (
        <EmptyState title="No agents yet" description="Agents created by any workspace will show up here." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Voice</TableHead>
                <TableHead>Campaigns</TableHead>
                <TableHead>Calls</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => {
                const workspace = agent.workspace as unknown as { id: string; name: string } | null;
                return (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>{workspace?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={agent.status === "active" ? "success" : "secondary"}>{agent.status}</Badge>
                    </TableCell>
                    <TableCell>{agent.voice}</TableCell>
                    <TableCell>{campaignCounts.get(agent.id) ?? 0}</TableCell>
                    <TableCell>{callCounts.get(agent.id) ?? 0}</TableCell>
                    <TableCell>{new Date(agent.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <AdminAgentRowActions id={agent.id} status={agent.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
