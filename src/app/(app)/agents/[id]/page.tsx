import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PhoneCall, Plus, PartyPopper } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AgentForm } from "@/components/agents/agent-form";
import { AddLeadsDialog } from "@/components/campaigns/add-leads-dialog";
import { CampaignDetailActions } from "@/components/campaigns/campaign-detail-actions";
import { RenameCampaignDialog } from "@/components/campaigns/rename-campaign-dialog";
import type { AgentStatus, CampaignStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Edit agent" };

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

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ activated?: string }>;
}) {
  const { id } = await params;
  const { activated } = await searchParams;
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const [{ data: agent, error: agentError }, { data: knowledgeBases }, { data: linkedKnowledgeBases }, { data: campaigns }] =
    await Promise.all([
      supabase.from("agents").select("*").eq("id", id).eq("workspace_id", workspace.id).single(),
      supabase
        .from("knowledge_bases")
        .select("id, name")
        .eq("workspace_id", workspace.id)
        .order("name", { ascending: true }),
      supabase.from("agent_knowledge_bases").select("knowledge_base_id").eq("agent_id", id),
      supabase
        .from("campaigns")
        .select("id, name, status, created_at, contacts:campaign_contacts(count)")
        .eq("workspace_id", workspace.id)
        .eq("agent_id", id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  // RLS already keeps this to the caller's workspace; a failed fetch here
  // means the agent doesn't exist or isn't in this workspace — either way, 404.
  if (agentError || !agent) {
    notFound();
  }

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const [{ data: existingLinks }, { data: candidateContacts }] = await Promise.all([
    campaignIds.length > 0
      ? supabase.from("campaign_contacts").select("campaign_id, contact_id").in("campaign_id", campaignIds)
      : Promise.resolve({ data: [] as { campaign_id: string; contact_id: string }[] }),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, company, phone, email")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

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

  const linkedIds = new Set((linkedKnowledgeBases ?? []).map((row) => row.knowledge_base_id));

  const defaultValues = {
    name: agent.name,
    company_name: agent.company_name ?? "",
    agent_role: agent.agent_role ?? "",
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
    knowledge_base_ids: Array.from(linkedIds),
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to agents
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
          <Badge variant={STATUS_VARIANT[agent.status]}>{agent.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Edit this agent&apos;s persona, conversation behavior, and knowledge.
        </p>
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

      <AgentForm
        mode="edit"
        agentId={agent.id}
        defaultValues={defaultValues}
        knowledgeBases={knowledgeBases ?? []}
      />

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
                      <AddLeadsDialog
                        campaignId={c.id}
                        availableContacts={availableContactsFor(c.id)}
                        contactsCapped={false}
                      />
                      <CampaignDetailActions campaignId={c.id} campaignName={c.name} status={c.status} size="sm" />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No calling list yet. Create one to start adding leads for this agent.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
