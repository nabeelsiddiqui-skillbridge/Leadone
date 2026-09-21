import { z } from "zod";

import { db } from "../db.js";
import type { ToolExecutionContext, ToolResult } from "../types.js";

const scheduleCallbackSchema = z.object({
  requested_for: z.string().datetime({ offset: true }).or(z.string().min(1)),
  timezone: z.string().optional(),
});

export async function scheduleCallback(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  if (!ctx.contact) return { status: "error", message: "No contact attached to this call." };
  const parsed = scheduleCallbackSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  const requestedFor = new Date(parsed.data.requested_for);
  if (Number.isNaN(requestedFor.getTime())) {
    return { status: "error", message: "requested_for must be a valid datetime." };
  }

  const { error } = await db.from("callbacks").insert({
    workspace_id: ctx.contact.workspace_id,
    contact_id: ctx.contact.id,
    campaign_id: ctx.session.campaignId,
    agent_id: ctx.session.agentId,
    requested_for: requestedFor.toISOString(),
    timezone: parsed.data.timezone ?? ctx.contact.timezone ?? "UTC",
    created_from_call_id: ctx.session.callId,
  });

  if (error) return { status: "error", message: error.message };
  return { status: "success", message: `Callback scheduled for ${requestedFor.toISOString()}.` };
}
