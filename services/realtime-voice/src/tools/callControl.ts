import { z } from "zod";
import twilio from "twilio";

import { config } from "../config.js";
import type { ToolExecutionContext, ToolResult } from "../types.js";

const twilioClient =
  config.twilioAccountSid && config.twilioAuthToken
    ? twilio(config.twilioAccountSid, config.twilioAuthToken)
    : null;

const endCallSchema = z.object({ reason: z.string().optional() });

export async function endCall(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  const parsed = endCallSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  // Deliberately does NOT hang up via the Twilio REST API here - that used to
  // happen synchronously in this handler and would terminate the call before
  // Twilio had actually finished playing out the agent's goodbye (sending
  // audio bytes to the Twilio websocket is near-instant; Twilio then plays
  // them out over the real phone line in real time, so an immediate REST
  // hangup raced ahead of that and cut the farewell off mid-sentence,
  // confirmed against live call transcripts - "says booked but the call
  // cuts before saying thanks"). The call loop (callSession.ts) now tears
  // the connection down itself, after the model's response audio has
  // actually finished sending plus a drain buffer for Twilio's own
  // playback queue - see the `end_call` case in wireOpenAIEvents.
  ctx.session.outcome = parsed.data.reason ?? ctx.session.outcome ?? "completed";
  ctx.session.ended = true;

  return { status: "success", message: "Ending the call now." };
}

const transferCallSchema = z.object({ reason: z.string().optional() });

export async function transferCall(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  const parsed = transferCallSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  if (!ctx.agent.call_transfer_enabled || !ctx.agent.transfer_phone_number) {
    return { status: "unavailable", message: "Call transfer isn't configured for this agent." };
  }
  if (!twilioClient || !ctx.session.twilioCallSid) {
    return { status: "unavailable", message: "Twilio isn't configured, can't transfer this call." };
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Transferring you now.</Say><Dial>${ctx.agent.transfer_phone_number}</Dial></Response>`;

  try {
    await twilioClient.calls(ctx.session.twilioCallSid).update({ twiml });
  } catch (err) {
    return { status: "error", message: `Transfer failed: ${(err as Error).message}` };
  }

  ctx.session.outcome = "transferred";
  return { status: "success", message: `Transferring the call to ${ctx.agent.transfer_phone_number}.` };
}
