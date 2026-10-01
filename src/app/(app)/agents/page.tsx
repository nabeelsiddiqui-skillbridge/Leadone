import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AgentRowActions } from "@/components/agents/agent-row-actions";
import { TemplateCard } from "@/components/agents/template-card";
import { CampaignDetailActions } from "@/components/campaigns/campaign-detail-actions";
import { AGENT_TEMPLATES } from "@/lib/agent-templates";
import type { AgentStatus, CampaignStatus, Database } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Agents" };

type AgentRow = Database["public"]["Tables"]["agents"]["Row"];
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const STATUS_VARIANT: Record<AgentStatus, "success" | "secondary" | "outline"> = {
  active: "success",
  inactive: "secondary",
  draft: "outline",
};

const CAMPAIGN_STATUS_VARIANT: Record<CampaignStatus, "success" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  scheduled: "secondary",
  running: "success",
  paused: "secondary",
  completed: "secondary",
  stopped: "secondary",
  error: "destructive",
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

  const [callCounts, appointmentCounts, { data: agentCampaigns }] = await Promise.all([
    countsByAgentId(supabase, "calls", workspace.id, agentIds),
    countsByAgentId(supabase, "appointments", workspace.id, agentIds),
    agentIds.length > 0
      ? supabase
          .from("campaigns")
          .select("id, agent_id, name, status")
          .eq("workspace_id", workspace.id)
          .in("agent_id", agentIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; agent_id: string; name: string; status: CampaignStatus }[] }),
  ]);

  // One primary calling list per agent — the most recently created, since
  // that's the one someone just activated a template or added leads to.
  const primaryCampaignByAgent = new Map<string, { id: string; name: string; status: CampaignStatus }>();
  for (const c of agentCampaigns ?? []) {
    if (!c.agent_id || primaryCampaignByAgent.has(c.agent_id)) continue;
    primaryCampaignByAgent.set(c.agent_id, { id: c.id, name: c.name, status: c.status });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Your AI personas — each one ready to answer calls and chats on its own.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/agents/new">Build from scratch</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Pre-built AI Agents</h2>
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Sparkles className="size-3" /> Ready in minutes
          </span>
        </div>
        <p className="-mt-2 max-w-2xl text-sm text-muted-foreground">
          Pick the role you need - every prompt, question, and objection response is already written. Tell it about your
          business and it&apos;s ready to start calling.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {AGENT_TEMPLATES.map((template) => (
            <TemplateCard key={template.slug} templateSlug={template.slug} />
          ))}
        </div>
      </div>

      {agents.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Your Agents</h2>
          <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Calling Status</TableHead>
                <TableHead>Voice</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Calls Made</TableHead>
                <TableHead>Appointments Booked</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => {
                const campaign = primaryCampaignByAgent.get(agent.id);
                return (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">
                      <Link href={`/agents/${agent.id}`} className="hover:underline">
                        {agent.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[agent.status]}>{agent.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {campaign ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={CAMPAIGN_STATUS_VARIANT[campaign.status]}>{campaign.status}</Badge>
                          <CampaignDetailActions
                            campaignId={campaign.id}
                            campaignName={campaign.name}
                            status={campaign.status}
                            size="sm"
                          />
                        </div>
                      ) : (
                        <Link href={`/agents/${agent.id}#calling`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                          No calling list — add one
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{agent.voice}</TableCell>
                    <TableCell>{agent.language}</TableCell>
                    <TableCell>{callCounts.get(agent.id) ?? 0}</TableCell>
                    <TableCell>{appointmentCounts.get(agent.id) ?? 0}</TableCell>
                    <TableCell>{new Date(agent.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <AgentRowActions id={agent.id} status={agent.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
