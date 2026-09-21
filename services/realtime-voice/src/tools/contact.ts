import { z } from "zod";

import { db } from "../db.js";
import type { ToolExecutionContext, ToolResult } from "../types.js";

const updateContactSchema = z.object({
  email: z.string().email().optional(),
  company: z.string().optional(),
  job_title: z.string().optional(),
  website: z.string().optional(),
});

export async function updateContact(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  if (!ctx.contact) return { status: "error", message: "No contact attached to this call." };
  const parsed = updateContactSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  const fields = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  if (Object.keys(fields).length === 0) return { status: "success", message: "Nothing to update." };

  const { error } = await db.from("contacts").update(fields).eq("id", ctx.contact.id);
  if (error) return { status: "error", message: error.message };
  return { status: "success", message: "Contact updated." };
}

const saveNoteSchema = z.object({ note: z.string().min(1).max(2000) });

export async function saveNote(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  if (!ctx.contact) return { status: "error", message: "No contact attached to this call." };
  const parsed = saveNoteSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  const { error } = await db.from("contact_notes").insert({
    contact_id: ctx.contact.id,
    workspace_id: ctx.contact.workspace_id,
    note: `[Call ${ctx.session.callId}] ${parsed.data.note}`,
  });
  if (error) return { status: "error", message: error.message };
  return { status: "success", message: "Note saved." };
}

const LEAD_STATUSES = [
  "connected", "qualified", "appointment_booked", "follow_up",
  "not_interested", "wrong_number", "failed",
] as const;

const updateLeadStatusSchema = z.object({
  status: z.enum(LEAD_STATUSES),
  lead_score: z.number().min(0).max(100).optional(),
});

export async function updateLeadStatus(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  if (!ctx.contact) return { status: "error", message: "No contact attached to this call." };
  const parsed = updateLeadStatusSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  const fields: Record<string, unknown> = { status: parsed.data.status };
  if (typeof parsed.data.lead_score === "number") fields.lead_score = Math.round(parsed.data.lead_score);

  const { error } = await db.from("contacts").update(fields).eq("id", ctx.contact.id);
  if (error) return { status: "error", message: error.message };
  return { status: "success", message: `Lead status set to ${parsed.data.status}.` };
}

const markDoNotCallSchema = z.object({ reason: z.string().max(500).optional() });

export async function markDoNotCall(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  if (!ctx.contact) return { status: "error", message: "No contact attached to this call." };
  const parsed = markDoNotCallSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  const { error } = await db.from("do_not_call").upsert(
    {
      workspace_id: ctx.contact.workspace_id,
      phone: ctx.contact.phone,
      reason: parsed.data.reason ?? "Requested during call",
      source_call_id: ctx.session.callId,
    },
    { onConflict: "workspace_id,phone" }
  );
  // The do_not_call_apply trigger (see 20250101000200_functions_triggers.sql)
  // flips contacts.status to 'do_not_call' for us.
  if (error) return { status: "error", message: error.message };
  return { status: "success", message: "Added to the Do Not Call list. This number will not be called again by campaigns." };
}

export async function getContactInformation(ctx: ToolExecutionContext): Promise<ToolResult> {
  if (!ctx.contact) return { status: "error", message: "No contact attached to this call." };
  return {
    status: "success",
    message: "Contact information retrieved.",
    data: {
      first_name: ctx.contact.first_name,
      last_name: ctx.contact.last_name,
      company: ctx.contact.company,
      email: ctx.contact.email,
      job_title: ctx.contact.job_title,
      custom_fields: ctx.contact.custom_fields,
    },
  };
}
