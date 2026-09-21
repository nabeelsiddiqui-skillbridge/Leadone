import { db } from "../db.js";
import type { ToolExecutionContext, ToolResult } from "../types.js";
import { TOOL_DEFINITIONS, type ToolName } from "./definitions.js";
import {
  updateContact, saveNote, updateLeadStatus, markDoNotCall, getContactInformation,
} from "./contact.js";
import { scheduleCallback } from "./scheduling.js";
import { checkAvailability, bookAppointment, rescheduleAppointment, cancelAppointment } from "./calendar.js";
import { searchKnowledgeBase } from "./knowledgeBase.js";
import { endCall, transferCall } from "./callControl.js";
import { sendSms, sendEmail } from "./messaging.js";

export { TOOL_DEFINITIONS };

type ToolHandler = (ctx: ToolExecutionContext, args: unknown) => Promise<ToolResult>;

const REGISTRY: Record<ToolName, ToolHandler> = {
  check_availability: checkAvailability,
  book_appointment: bookAppointment,
  reschedule_appointment: rescheduleAppointment,
  cancel_appointment: cancelAppointment,
  update_contact: updateContact,
  save_note: saveNote,
  update_lead_status: updateLeadStatus,
  mark_do_not_call: markDoNotCall,
  schedule_callback: scheduleCallback,
  transfer_call: transferCall,
  send_sms: sendSms,
  send_email: sendEmail,
  end_call: endCall,
  get_contact_information: getContactInformation,
  search_knowledge_base: searchKnowledgeBase,
};

/**
 * Executes a model-requested tool call: validates the name is one we know,
 * runs the handler (which independently zod-validates its own arguments —
 * the model's JSON is never trusted directly), logs the attempt and its
 * latency to call_tool_calls, and always returns a ToolResult, never
 * throws, so a failed tool never crashes the call.
 */
export async function executeTool(
  ctx: ToolExecutionContext,
  toolName: string,
  rawArgs: unknown
): Promise<ToolResult> {
  const startedAt = Date.now();
  const handler = REGISTRY[toolName as ToolName];

  const { data: logRow } = await db
    .from("call_tool_calls")
    .insert({
      call_id: ctx.session.callId,
      workspace_id: ctx.session.workspaceId,
      tool_name: toolName,
      arguments: (rawArgs ?? {}) as Record<string, unknown>,
      status: "pending",
    })
    .select("id")
    .single();

  let result: ToolResult;
  if (!handler) {
    result = { status: "error", message: `Unknown tool: ${toolName}` };
  } else {
    try {
      result = await handler(ctx, rawArgs);
    } catch (err) {
      result = { status: "error", message: `Tool ${toolName} threw: ${(err as Error).message}` };
    }
  }

  const latencyMs = Date.now() - startedAt;

  if (logRow) {
    await db
      .from("call_tool_calls")
      .update({
        status: result.status === "success" ? "success" : "error",
        result: result as unknown as Record<string, unknown>,
        latency_ms: latencyMs,
      })
      .eq("id", logRow.id);
  }

  return result;
}
