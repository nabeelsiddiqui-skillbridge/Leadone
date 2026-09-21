"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AgentStatus, Database } from "@/lib/supabase/database.types";

type AgentRow = Database["public"]["Tables"]["agents"]["Row"];
type AgentInsert = Database["public"]["Tables"]["agents"]["Insert"];

export interface AgentActionResult {
  error?: string;
}

/** Shape submitted by the agent form; used for both create and update. */
export interface AgentFormValues {
  name: string;
  company_name: string | null;
  agent_role: string | null;
  primary_objective: string | null;
  language: string;
  accent: string | null;
  voice: string;
  opening_greeting: string | null;
  system_prompt: string | null;
  conversation_instructions: string | null;
  qualification_questions: string[];
  objection_handling: string | null;
  closing_instructions: string | null;
  voicemail_message: string | null;
  response_length: "concise" | "balanced" | "detailed";
  creativity: number;
  interruptions_enabled: boolean;
  appointment_booking_enabled: boolean;
  call_transfer_enabled: boolean;
  transfer_phone_number: string | null;
  max_call_duration_seconds: number;
  silence_timeout_seconds: number;
  end_call_rules: string | null;
  knowledge_base_ids: string[];
}

function toAgentFields(values: AgentFormValues) {
  return {
    name: values.name,
    company_name: values.company_name || null,
    agent_role: values.agent_role || null,
    primary_objective: values.primary_objective || null,
    language: values.language,
    accent: values.accent || null,
    voice: values.voice,
    opening_greeting: values.opening_greeting || null,
    system_prompt: values.system_prompt || null,
    conversation_instructions: values.conversation_instructions || null,
    qualification_questions: values.qualification_questions,
    objection_handling: values.objection_handling || null,
    closing_instructions: values.closing_instructions || null,
    voicemail_message: values.voicemail_message || null,
    response_length: values.response_length,
    creativity: values.creativity,
    interruptions_enabled: values.interruptions_enabled,
    appointment_booking_enabled: values.appointment_booking_enabled,
    call_transfer_enabled: values.call_transfer_enabled,
    transfer_phone_number: values.transfer_phone_number || null,
    max_call_duration_seconds: values.max_call_duration_seconds,
    silence_timeout_seconds: values.silence_timeout_seconds,
    end_call_rules: values.end_call_rules || null,
  } satisfies Partial<AgentInsert>;
}

async function syncKnowledgeBaseLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agentId: string,
  knowledgeBaseIds: string[]
) {
  // Simplest correct approach: replace the full set of links every save.
  const { error: deleteError } = await supabase
    .from("agent_knowledge_bases")
    .delete()
    .eq("agent_id", agentId);
  if (deleteError) {
    return deleteError.message;
  }

  if (knowledgeBaseIds.length === 0) {
    return null;
  }

  const { error: insertError } = await supabase.from("agent_knowledge_bases").insert(
    knowledgeBaseIds.map((knowledgeBaseId) => ({
      agent_id: agentId,
      knowledge_base_id: knowledgeBaseId,
    }))
  );
  return insertError?.message ?? null;
}

export async function createAgentAction(values: AgentFormValues): Promise<AgentActionResult> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agent, error } = await supabase
    .from("agents")
    .insert({
      ...toAgentFields(values),
      workspace_id: workspace.id,
      status: "draft",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !agent) {
    return { error: error?.message ?? "Failed to create agent." };
  }

  if (values.knowledge_base_ids.length > 0) {
    await supabase.from("agent_knowledge_bases").insert(
      values.knowledge_base_ids.map((knowledgeBaseId) => ({
        agent_id: agent.id,
        knowledge_base_id: knowledgeBaseId,
      }))
    );
  }

  revalidatePath("/agents");
  redirect(`/agents/${agent.id}`);
}

export async function updateAgentAction(
  agentId: string,
  values: AgentFormValues
): Promise<AgentActionResult> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: agent, error } = await supabase
    .from("agents")
    .update(toAgentFields(values))
    .eq("id", agentId)
    .eq("workspace_id", workspace.id)
    .select("id")
    .single();

  if (error || !agent) {
    return { error: error?.message ?? "Failed to update agent." };
  }

  const kbError = await syncKnowledgeBaseLinks(supabase, agentId, values.knowledge_base_ids);
  if (kbError) {
    return { error: `Agent saved, but knowledge base links failed to update: ${kbError}` };
  }

  revalidatePath("/agents");
  revalidatePath(`/agents/${agentId}`);
  return {};
}

export async function duplicateAgentAction(agentId: string): Promise<AgentActionResult> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: original, error: fetchError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("workspace_id", workspace.id)
    .single();

  if (fetchError || !original) {
    return { error: "Agent not found." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const copy: AgentInsert = {
    workspace_id: workspace.id,
    name: `${original.name} (Copy)`,
    company_name: original.company_name,
    agent_role: original.agent_role,
    persona: original.persona,
    primary_objective: original.primary_objective,
    opening_greeting: original.opening_greeting,
    system_prompt: original.system_prompt,
    conversation_instructions: original.conversation_instructions,
    qualification_questions: original.qualification_questions,
    objection_handling: original.objection_handling,
    closing_instructions: original.closing_instructions,
    voicemail_message: original.voicemail_message,
    language: original.language,
    accent: original.accent,
    voice: original.voice,
    response_length: original.response_length,
    creativity: original.creativity,
    interruptions_enabled: original.interruptions_enabled,
    appointment_booking_enabled: original.appointment_booking_enabled,
    call_transfer_enabled: original.call_transfer_enabled,
    transfer_phone_number: original.transfer_phone_number,
    max_call_duration_seconds: original.max_call_duration_seconds,
    silence_timeout_seconds: original.silence_timeout_seconds,
    end_call_rules: original.end_call_rules,
    status: "draft",
    created_by: user?.id ?? null,
  };

  const { error: insertError } = await supabase.from("agents").insert(copy);
  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath("/agents");
  return {};
}

export async function setAgentStatusAction(
  agentId: string,
  status: Extract<AgentStatus, "active" | "inactive">
): Promise<AgentActionResult> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agents")
    .update({ status })
    .eq("id", agentId)
    .eq("workspace_id", workspace.id)
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to update agent status." };
  }

  revalidatePath("/agents");
  revalidatePath(`/agents/${agentId}`);
  return {};
}

export async function deleteAgentAction(agentId: string): Promise<AgentActionResult> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agents")
    .delete()
    .eq("id", agentId)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) {
    return { error: "Only workspace admins can delete agents." };
  }

  // RLS silently filters rows a non-admin can't delete rather than erroring,
  // so an empty result here means the delete was blocked, not that nothing matched.
  if (!data || data.length === 0) {
    return { error: "Only workspace admins can delete agents." };
  }

  revalidatePath("/agents");
  return {};
}

export type { AgentRow };
