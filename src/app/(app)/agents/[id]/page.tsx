import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentForm } from "@/components/agents/agent-form";
import type { AgentStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Edit agent" };

const STATUS_VARIANT: Record<AgentStatus, "success" | "secondary" | "outline"> = {
  active: "success",
  inactive: "secondary",
  draft: "outline",
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const [{ data: agent, error: agentError }, { data: knowledgeBases }, { data: linkedKnowledgeBases }] =
    await Promise.all([
      supabase.from("agents").select("*").eq("id", id).eq("workspace_id", workspace.id).single(),
      supabase
        .from("knowledge_bases")
        .select("id, name")
        .eq("workspace_id", workspace.id)
        .order("name", { ascending: true }),
      supabase.from("agent_knowledge_bases").select("knowledge_base_id").eq("agent_id", id),
    ]);

  // RLS already keeps this to the caller's workspace; a failed fetch here
  // means the agent doesn't exist or isn't in this workspace — either way, 404.
  if (agentError || !agent) {
    notFound();
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

      <AgentForm
        mode="edit"
        agentId={agent.id}
        defaultValues={defaultValues}
        knowledgeBases={knowledgeBases ?? []}
      />

      <Card id="test-agent">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Test Agent</CardTitle>
            <Badge variant="secondary">Coming in Phase 2</Badge>
          </div>
          <CardDescription>
            Live agent testing — talking to this agent from your browser microphone, or placing a
            real test phone call — goes live once the realtime voice server ships in Phase 2. This
            agent&apos;s prompt, voice, and behavior settings above are saved and ready for when it
            does.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
