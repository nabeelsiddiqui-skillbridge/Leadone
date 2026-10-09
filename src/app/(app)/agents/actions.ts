"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAgentTemplate, interpolateTemplate } from "@/lib/agent-templates";
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
  call_direction: "outbound" | "inbound" | "both";
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
    call_direction: values.call_direction,
  } satisfies Partial<AgentInsert>;
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
    call_direction: original.call_direction,
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

export interface ActivateTemplateInput {
  templateSlug: string;
  companyName: string;
  businessDescription: string;
  extraContext: string;
}

/**
 * The "pre-built agent" fast path: turns a template + a couple of answers
 * about the business into a fully-configured, ready-to-use agent (status
 * 'active', not 'draft' - it's meant to work immediately), plus a companion
 * calling list (campaign) so it can actually start dialing once leads are
 * added. The campaign is real and uses the same infrastructure as the
 * classic wizard at /campaigns/new - it's just not surfaced as its own nav
 * section anymore. Reachable afterward from the agent's own detail page.
 */
export async function activateAgentTemplateAction(input: ActivateTemplateInput): Promise<AgentActionResult> {
  const template = getAgentTemplate(input.templateSlug);
  if (!template) return { error: "Unknown agent template." };

  const companyName = input.companyName.trim();
  const businessDescription = input.businessDescription.trim();
  if (!companyName) return { error: "Company name is required." };
  if (!businessDescription) return { error: "Tell us a bit about your business first." };

  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const vars = {
    company_name: companyName,
    business_description: businessDescription,
    extra_context: input.extraContext.trim(),
  };

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .insert({
      workspace_id: workspace.id,
      name: `${template.name} - ${companyName}`,
      company_name: companyName,
      agent_role: template.agentRole,
      persona: template.persona,
      primary_objective: interpolateTemplate(template.primaryObjective, vars),
      opening_greeting: interpolateTemplate(template.openingGreeting, vars),
      system_prompt: interpolateTemplate(template.systemPrompt, vars),
      conversation_instructions: template.conversationInstructions,
      qualification_questions: template.qualificationQuestions,
      objection_handling: template.objectionHandling,
      closing_instructions: template.closingInstructions,
      voicemail_message: interpolateTemplate(template.voicemailMessage, vars),
      language: "en-US",
      voice: template.voice,
      response_length: template.responseLength,
      creativity: template.creativity,
      interruptions_enabled: template.interruptionsEnabled,
      appointment_booking_enabled: template.appointmentBookingEnabled,
      end_call_rules: template.endCallRules,
      call_direction: template.callDirection,
      status: "active",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (agentError || !agent) {
    return { error: agentError?.message ?? "Failed to create agent." };
  }

  // Companion calling list - draft until leads are actually added, same
  // sensible defaults the manual campaign wizard starts with. Skipped for
  // inbound-only templates (e.g. Receptionist): campaigns are an outbound
  // dialer, so there's nothing for one to do on an agent that only answers
  // calls on an assigned phone number instead.
  if (template.callDirection !== "inbound") {
    const { data: defaultNumber } = await supabase
      .from("phone_numbers")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("is_default", true)
      .eq("status", "active")
      .maybeSingle();

    const { error: campaignError } = await supabase.from("campaigns").insert({
      workspace_id: workspace.id,
      agent_id: agent.id,
      phone_number_id: defaultNumber?.id ?? null,
      name: `${template.name} - ${companyName}`,
      status: "draft",
      timezone_mode: "contact_local",
      days_of_week: [1, 2, 3, 4, 5],
      calling_start_time: "09:00",
      calling_end_time: "18:00",
      daily_call_limit: 50,
      concurrency_limit: 2,
      max_attempts: 3,
      retry_no_answer_minutes: 240,
      retry_busy_minutes: 60,
      retry_failed_minutes: 120,
      voicemail_action: "leave_message",
      created_by: user?.id ?? null,
    });
    if (campaignError) {
      // The agent itself was created fine - don't fail the whole flow over
      // its companion calling list, but don't pretend it worked either.
      console.error(`Failed to create companion campaign for agent ${agent.id}:`, campaignError.message);
    }
  }

  revalidatePath("/agents");
  redirect(`/agents/${agent.id}?activated=1`);
}

export type { AgentRow };
