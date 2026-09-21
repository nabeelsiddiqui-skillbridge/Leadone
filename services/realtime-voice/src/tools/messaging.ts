import { z } from "zod";
import twilio from "twilio";

import { db } from "../db.js";
import { config } from "../config.js";
import type { ToolExecutionContext, ToolResult } from "../types.js";

const twilioClient =
  config.twilioAccountSid && config.twilioAuthToken
    ? twilio(config.twilioAccountSid, config.twilioAuthToken)
    : null;

async function isFeatureEnabled(key: string): Promise<boolean> {
  const { data } = await db.from("feature_flags").select("enabled").eq("key", key).maybeSingle();
  return data?.enabled ?? false;
}

const sendSmsSchema = z.object({ message: z.string().min(1).max(1500) });

export async function sendSms(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  if (!ctx.contact) return { status: "error", message: "No contact attached to this call." };
  const parsed = sendSmsSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  if (!(await isFeatureEnabled("SMS"))) {
    return { status: "unavailable", message: "SMS follow-ups are disabled for this platform." };
  }
  if (!twilioClient) {
    return { status: "unavailable", message: "Twilio isn't configured, can't send an SMS." };
  }

  const { data: phoneNumber } = await db
    .from("phone_numbers")
    .select("phone_number")
    .eq("workspace_id", ctx.contact.workspace_id)
    .eq("is_default", true)
    .maybeSingle();

  if (!phoneNumber) return { status: "unavailable", message: "No workspace phone number configured to send from." };

  try {
    await twilioClient.messages.create({
      from: phoneNumber.phone_number,
      to: ctx.contact.phone,
      body: parsed.data.message,
    });
  } catch (err) {
    return { status: "error", message: `SMS failed: ${(err as Error).message}` };
  }

  return { status: "success", message: "Text message sent." };
}

const sendEmailSchema = z.object({ subject: z.string().min(1), body: z.string().min(1) });

export async function sendEmail(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  if (!ctx.contact) return { status: "error", message: "No contact attached to this call." };
  const parsed = sendEmailSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  if (!(await isFeatureEnabled("EMAIL"))) {
    return { status: "unavailable", message: "Email follow-ups are disabled for this platform." };
  }
  if (!ctx.contact.email) {
    return { status: "unavailable", message: "This contact has no email on file." };
  }

  // No SMTP/email-provider integration exists yet (it's part of the
  // Integrations page, not yet built). Report that honestly rather than
  // pretending to send.
  return {
    status: "unavailable",
    message: "Email sending isn't configured on this platform yet.",
  };
}
