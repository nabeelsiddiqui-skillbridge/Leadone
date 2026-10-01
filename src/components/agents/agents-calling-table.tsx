import Link from "next/link";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { AgentRowActions } from "@/components/agents/agent-row-actions";
import { CampaignDetailActions } from "@/components/campaigns/campaign-detail-actions";
import type { AgentStatus, CampaignStatus, Database } from "@/lib/supabase/database.types";

type AgentRow = Database["public"]["Tables"]["agents"]["Row"];

/** A single, plain-language summary of what an agent is doing right now. */
function callingSummary(
  agentStatus: AgentStatus,
  campaign: { status: CampaignStatus } | undefined
): { label: string; variant: "success" | "secondary" | "outline" | "destructive" } {
  if (agentStatus === "inactive") return { label: "Inactive", variant: "secondary" };
  if (!campaign) return { label: "Not calling yet", variant: "outline" };
  switch (campaign.status) {
    case "running":
      return { label: "Calling now", variant: "success" };
    case "scheduled":
      return { label: "Starting soon", variant: "secondary" };
    case "paused":
      return { label: "Paused", variant: "secondary" };
    case "stopped":
    case "completed":
      return { label: "Stopped", variant: "secondary" };
    case "error":
      return { label: "Error", variant: "destructive" };
    default:
      return { label: "Not calling yet", variant: "outline" };
  }
}

/**
 * Every agent in the workspace with its live calling status and one quick
 * action, in one place — this is the "is anything running right now" view.
 * Self-contained: fetches its own data so it can drop into any page.
 */
export async function AgentsCallingTable() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: agentsData } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  const agents: AgentRow[] = agentsData ?? [];
  const agentIds = agents.map((agent) => agent.id);

  const { data: agentCampaigns } =
    agentIds.length > 0
      ? await supabase
          .from("campaigns")
          .select("id, agent_id, name, status, contacts:campaign_contacts(count)")
          .eq("workspace_id", workspace.id)
          .in("agent_id", agentIds)
          .order("created_at", { ascending: false })
      : { data: [] as { id: string; agent_id: string; name: string; status: CampaignStatus; contacts: { count: number }[] }[] };

  const primaryCampaignByAgent = new Map<string, { id: string; name: string; status: CampaignStatus; leadCount: number }>();
  for (const c of agentCampaigns ?? []) {
    if (!c.agent_id || primaryCampaignByAgent.has(c.agent_id)) continue;
    const contacts = c.contacts as unknown as { count: number }[] | null;
    const leadCount = Array.isArray(contacts) ? (contacts[0]?.count ?? 0) : 0;
    primaryCampaignByAgent.set(c.agent_id, { id: c.id, name: c.name, status: c.status, leadCount });
  }

  if (agents.length === 0) {
    return (
      <EmptyState
        title="No agents yet"
        description="Pick a pre-built role - Sales, Support, Appointment Setter, and more - and it's ready to start calling in minutes."
        actionHref="/agents/templates"
        actionLabel="Browse pre-built agents"
      />
    );
  }

  return (
    <Card className="overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Leads</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => {
            const campaign = primaryCampaignByAgent.get(agent.id);
            const summary = callingSummary(agent.status, campaign);
            return (
              <TableRow key={agent.id}>
                <TableCell className="font-medium">
                  <Link href={`/agents/${agent.id}`} className="hover:underline">
                    {agent.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1.5">
                    <Badge variant={summary.variant}>{summary.label}</Badge>
                    {campaign ? (
                      <CampaignDetailActions
                        campaignId={campaign.id}
                        campaignName={campaign.name}
                        status={campaign.status}
                        size="sm"
                        compact
                      />
                    ) : (
                      <Link
                        href={`/agents/${agent.id}#calling`}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Add leads
                      </Link>
                    )}
                  </div>
                </TableCell>
                <TableCell>{campaign?.leadCount ?? 0}</TableCell>
                <TableCell>
                  <AgentRowActions id={agent.id} status={agent.status} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
