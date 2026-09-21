import type { Metadata } from "next";
import Link from "next/link";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { AgentRowActions } from "@/components/agents/agent-row-actions";
import type { AgentStatus, Database } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Agents" };

type AgentRow = Database["public"]["Tables"]["agents"]["Row"];
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const STATUS_VARIANT: Record<AgentStatus, "success" | "secondary" | "outline"> = {
  active: "success",
  inactive: "secondary",
  draft: "outline",
};

/**
 * Counts rows per agent_id for a workspace-scoped table. Supabase-js has no
 * group-by, so this pulls the foreign key column for the workspace's agents
 * and tallies it client-side — fine at tenant scale, avoids an RPC/migration.
 */
async function countsByAgentId(
  supabase: SupabaseServerClient,
  table: "campaigns" | "calls" | "appointments",
  workspaceId: string,
  agentIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (agentIds.length === 0) {
    return counts;
  }

  const { data } = await supabase
    .from(table)
    .select("agent_id")
    .eq("workspace_id", workspaceId)
    .in("agent_id", agentIds);

  for (const row of (data ?? []) as { agent_id: string | null }[]) {
    if (!row.agent_id) continue;
    counts.set(row.agent_id, (counts.get(row.agent_id) ?? 0) + 1);
  }
  return counts;
}

export default async function AgentsPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: agentsData } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  const agents: AgentRow[] = agentsData ?? [];
  const agentIds = agents.map((agent) => agent.id);

  const [campaignCounts, callCounts, appointmentCounts] = await Promise.all([
    countsByAgentId(supabase, "campaigns", workspace.id, agentIds),
    countsByAgentId(supabase, "calls", workspace.id, agentIds),
    countsByAgentId(supabase, "appointments", workspace.id, agentIds),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Reusable AI personas — voice, prompt, and behavior — you assign to campaigns.
          </p>
        </div>
        <Button asChild>
          <Link href="/agents/new">New agent</Link>
        </Button>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          title="No agents yet"
          description="Create an AI agent persona to start calling leads once a campaign is assigned to it."
          actionHref="/agents/new"
          actionLabel="New agent"
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Voice</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Campaigns Using Agent</TableHead>
                <TableHead>Calls Made</TableHead>
                <TableHead>Appointments Booked</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">
                    <Link href={`/agents/${agent.id}`} className="hover:underline">
                      {agent.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[agent.status]}>{agent.status}</Badge>
                  </TableCell>
                  <TableCell>{agent.voice}</TableCell>
                  <TableCell>{agent.language}</TableCell>
                  <TableCell>{campaignCounts.get(agent.id) ?? 0}</TableCell>
                  <TableCell>{callCounts.get(agent.id) ?? 0}</TableCell>
                  <TableCell>{appointmentCounts.get(agent.id) ?? 0}</TableCell>
                  <TableCell>{new Date(agent.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <AgentRowActions id={agent.id} status={agent.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
