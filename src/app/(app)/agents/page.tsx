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

  const { data: agentCampaigns } =
    agentIds.length > 0
      ? await supabase
          .from("campaigns")
          .select("id, agent_id, name, status, contacts:campaign_contacts(count)")
          .eq("workspace_id", workspace.id)
          .in("agent_id", agentIds)
          .order("created_at", { ascending: false })
      : { data: [] as { id: string; agent_id: string; name: string; status: CampaignStatus; contacts: { count: number }[] }[] };

  // One primary calling list per agent — the most recently created, since
  // that's the one someone just activated a template or added leads to.
  const primaryCampaignByAgent = new Map<string, { id: string; name: string; status: CampaignStatus; leadCount: number }>();
  for (const c of agentCampaigns ?? []) {
    if (!c.agent_id || primaryCampaignByAgent.has(c.agent_id)) continue;
    const contacts = c.contacts as unknown as { count: number }[] | null;
    const leadCount = Array.isArray(contacts) ? (contacts[0]?.count ?? 0) : 0;
    primaryCampaignByAgent.set(c.agent_id, { id: c.id, name: c.name, status: c.status, leadCount });
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
        </div>
      )}
    </div>
  );
}
