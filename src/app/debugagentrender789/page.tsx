import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PhoneCall, Plus, PartyPopper, Users, CalendarClock, TrendingUp } from "lucide-react";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AgentForm, type AgentKnowledgeBase } from "@/components/agents/agent-form";
import { AddLeadsDialog } from "@/components/campaigns/add-leads-dialog";
import { CampaignDetailActions } from "@/components/campaigns/campaign-detail-actions";
import { RenameCampaignDialog } from "@/components/campaigns/rename-campaign-dialog";
import { StatCard } from "@/components/dashboard/stat-card";
import type { AgentStatus, CampaignStatus, Database } from "@/lib/supabase/database.types";

// TEMPORARY: full faithful reproduction of agents/[id]/page.tsx, using the
// service-role client (no session needed) so it can be hit directly to
// reproduce the real production render for a real agent id. Secret-gated via
// query param. Delete once the real cause is found and fixed.

const AVAILABLE_CONTACTS_LIMIT = 200;

const STATUS_VARIANT: Record<AgentStatus, "success" | "secondary" | "outline"> = {
  active: "success",
  inactive: "secondary",
  draft: "outline",
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

const CAMPAIGN_STATUS_VARIANT: Record<CampaignStatus, "success" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  scheduled: "secondary",
  running: "success",
  paused: "secondary",
  completed: "secondary",
  stopped: "secondary",
  error: "destructive",
};

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 150 * (i + 1)));
    }
  }
  throw lastError;
}

export default async function DebugAgentRenderPage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string; agentId?: string; workspaceId?: string }>;
}) {
  const { secret, agentId, workspaceId } = await searchParams;
  if (secret !== process.env.TEMP_DIAG_SECRET) {
    return <div>unauthorized</div>;
  }
  if (!agentId || !workspaceId) {
    return <div>missing agentId or workspaceId</div>;
  }

  const id = agentId;
  const supabase = createServiceRoleClient();
  const activated = "1";

  const { data: workspace } = await supabase.from("workspaces").select("*").eq("id", workspaceId).single();
  if (!workspace) return <div>workspace not found</div>;

  const [{ data: agent, error: agentError }, { data: linkedKnowledgeBaseLinks }, { data: campaigns }] =
    await withRetry(() =>
      Promise.all([
        supabase.from("agents").select("*").eq("id", id).eq("workspace_id", workspace.id).single(),
        supabase.from("agent_knowledge_bases").select("knowledge_base_id").eq("agent_id", id),
        supabase
          .from("campaigns")
          .select("id, name, status, created_at, contacts:campaign_contacts(count)")
          .eq("workspace_id", workspace.id)
          .eq("agent_id", id)
          .order("created_at", { ascending: false })
          .limit(5),
      ])
    );

  if (agentError || !agent) {
    notFound();
  }

  let agentKnowledgeBases: AgentKnowledgeBase[] = [];
  try {
    const linkedKnowledgeBaseIds = (linkedKnowledgeBaseLinks ?? [])
      .map((link) => link.knowledge_base_id)
      .filter((kbId): kbId is string => typeof kbId === "string");

    const { data: knowledgeBases } =
      linkedKnowledgeBaseIds.length > 0
        ? await supabase
            .from("knowledge_bases")
            .select(
              "id, name, description, created_at, documents:knowledge_documents(id, name, source_type, source_url, status, error_message, created_at, chunks:knowledge_chunks(count))"
            )
            .in("id", linkedKnowledgeBaseIds)
            .order("created_at", { ascending: true })
        : { data: [] as never[] };

    agentKnowledgeBases = (knowledgeBases ?? []).map((kb) => {
      const documents = (Array.isArray(kb.documents) ? kb.documents : []) as unknown as Array<{
        id: string;
        name: string;
        source_type: string;
        source_url: string | null;
        status: Database["public"]["Tables"]["knowledge_documents"]["Row"]["status"];
        error_message: string | null;
        created_at: string;
        chunks: { count: number }[] | null;
      }>;
      return {
        id: kb.id,
        name: kb.name,
        description: kb.description,
        documents: documents
          .map((doc) => ({
            id: doc.id,
            name: doc.name,
            source_type: doc.source_type,
            source_url: doc.source_url,
            status: doc.status,
            error_message: doc.error_message,
            chunkCount: Array.isArray(doc.chunks) ? (doc.chunks[0]?.count ?? 0) : 0,
            createdAt: doc.created_at,
          }))
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      };
    });
  } catch (err) {
    console.error("Failed to load agent knowledge bases", err);
    agentKnowledgeBases = [];
  }

  const [{ count: callsMade }, { count: callsConnected }, { count: appointmentsBooked }] = await withRetry(() =>
    Promise.all([
      supabase.from("calls").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("agent_id", id),
      supabase
        .from("calls")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace.id)
        .eq("agent_id", id)
        .eq("status", "completed"),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("agent_id", id),
    ])
  );
  const conversionRate = callsMade && callsMade > 0 ? `${(((appointmentsBooked ?? 0) / callsMade) * 100).toFixed(1)}%` : "—";

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const [{ data: existingLinks }, { data: candidateContacts }] = await withRetry(() =>
    Promise.all([
      campaignIds.length > 0
        ? supabase.from("campaign_contacts").select("campaign_id, contact_id").in("campaign_id", campaignIds)
        : Promise.resolve({ data: [] as { campaign_id: string; contact_id: string }[] }),
      supabase
        .from("contacts")
        .select("id, first_name, last_name, company, phone, email")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(500),
    ])
  );

  const linksByCampaign = new Map<string, Set<string>>();
  for (const link of existingLinks ?? []) {
    const set = linksByCampaign.get(link.campaign_id) ?? new Set<string>();
    set.add(link.contact_id);
    linksByCampaign.set(link.campaign_id, set);
  }

  function availableContactsFor(campaignId: string) {
    const excluded = linksByCampaign.get(campaignId) ?? new Set<string>();
    return (candidateContacts ?? []).filter((c) => !excluded.has(c.id)).slice(0, AVAILABLE_CONTACTS_LIMIT);
  }

  const defaultValues = {
    name: agent.name,
    company_name: agent.company_name ?? "",
    agent_role: agent.agent_role ?? "",
    call_direction: agent.call_direction as "outbound" | "inbound" | "both",
    primary_objective: agent.primary_objective ?? "",
    language: agent.language,
    accent: agent.accent ?? "",
    voice: agent.voice,
    opening_greeting: agent.opening_greeting ?? "",
    system_prompt: agent.system_prompt ?? "",
    conversation_instructions: agent.conversation_instructions ?? "",
    qualification_questions: toStringArray(agent.qualification_questions).map((value) => ({ value })),
    objection_handling: agent.objection_handling ?? "",
    closing_instructions: agent.closing_instructions ?? "",
    voicemail_message: agent.voicemail_message ?? "",
    response_length: agent.response_length,
    creativity: agent.creativity,
    interruptions_enabled: agent.interruptions_enabled,
    appointment_booking_enabled: agent.appointment_booking_enabled,
    call_transfer_enabled: agent.call_transfer_enabled,
    transfer_phone_number: agent.transfer_phone_number ?? "",
    max_call_duration_seconds: agent.max_call_duration_seconds,
    silence_timeout_seconds: agent.silence_timeout_seconds,
    end_call_rules: agent.end_call_rules ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/agents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to agents
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
          <Badge variant={STATUS_VARIANT[agent.status]}>{agent.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Status, calling activity, and performance for this agent.</p>
      </div>

      {activated === "1" && (
        <Alert className="border-success/40 bg-success/5">
          <PartyPopper className="size-4 text-success" />
          <AlertTitle>Your agent is ready</AlertTitle>
          <AlertDescription>
            {agent.name} is active and fully configured. Add leads to its calling list below to start calling.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Calls Made" value={callsMade ?? 0} icon={PhoneCall} accent />
        <StatCard label="Connected" value={callsConnected ?? 0} icon={Users} />
        <StatCard label="Appointments Booked" value={appointmentsBooked ?? 0} icon={CalendarClock} />
        <StatCard label="Conversion Rate" value={conversionRate} icon={TrendingUp} />
      </div>

      <Card id="calling">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PhoneCall className="size-4" /> Calling
              </CardTitle>
              <CardDescription>Who this agent is calling, and how it&apos;s going.</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/campaigns/new">
                <Plus /> New calling list
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {campaigns && campaigns.length > 0 ? (
            <ul className="flex flex-col divide-y">
              {campaigns.map((c) => {
                const contacts = c.contacts as unknown as { count: number }[] | null;
                const count = Array.isArray(contacts) ? (contacts[0]?.count ?? 0) : 0;
                return (
                  <li key={c.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <Link href={`/campaigns/${c.id}`} className="font-medium text-foreground hover:underline">
                          {c.name}
                        </Link>
                        <RenameCampaignDialog campaignId={c.id} currentName={c.name} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={CAMPAIGN_STATUS_VARIANT[c.status]}>{c.status}</Badge>
                        <p className="text-xs text-muted-foreground">
                          {count} lead{count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AddLeadsDialog campaignId={c.id} availableContacts={availableContactsFor(c.id)} contactsCapped={false} />
                      <CampaignDetailActions campaignId={c.id} campaignName={c.name} status={c.status} size="sm" compact />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No calling list yet. Create one to start adding leads for this agent.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Agent Settings</h2>
          <p className="text-sm text-muted-foreground">Edit this agent&apos;s persona, conversation behavior, and knowledge.</p>
        </div>
        <AgentForm mode="edit" agentId={agent.id} defaultValues={defaultValues} knowledgeBases={agentKnowledgeBases} />
      </div>
    </div>
  );
}
