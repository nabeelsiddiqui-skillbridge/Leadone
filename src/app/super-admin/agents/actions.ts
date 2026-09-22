"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface AdminActionResult {
  error?: string;
  message?: string;
}

export async function setAgentStatusAction(
  agentId: string,
  nextStatus: "active" | "inactive"
): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("agents").update({ status: nextStatus }).eq("id", agentId);
  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: nextStatus === "active" ? "agent.activate" : "agent.deactivate",
    target_type: "agent",
    target_id: agentId,
    metadata: {},
  });

  revalidatePath("/super-admin/agents");
  return { message: nextStatus === "active" ? "Agent activated." : "Agent deactivated." };
}

export async function duplicateAgentForTestingAction(agentId: string): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const supabase = await createClient();

  const { data: original, error: fetchError } = await supabase.from("agents").select("*").eq("id", agentId).single();
  if (fetchError || !original) return { error: "Agent not found." };

  const { error: insertError } = await supabase.from("agents").insert({
    workspace_id: original.workspace_id,
    name: `${original.name} (Admin Test Copy)`,
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
  });
  if (insertError) return { error: insertError.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "agent.duplicate_for_testing",
    target_type: "agent",
    target_id: agentId,
    metadata: {},
  });

  revalidatePath("/super-admin/agents");
  return { message: "Duplicated into a draft copy in the same workspace for testing." };
}
