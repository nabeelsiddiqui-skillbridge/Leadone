import { config } from "./config.js";

export interface PlaceCallJobData {
  workspaceId: string;
  agentId: string;
  contactId: string;
  phoneNumberId: string | null;
  campaignId: string | null;
  /** Set when this call is for a lead sitting in a campaign queue. */
  campaignContactId?: string;
  maxAttempts?: number;
  retryFailedMinutes?: number;
  /** Set when this call is a promised callback rather than a campaign dial. */
  callbackId?: string;
}

/**
 * Calls back into the Next.js app's POST /api/calls — the single place that
 * actually talks to Twilio — authenticated as the worker via a shared
 * secret header rather than a user session. See src/app/api/calls/route.ts
 * for the matching server-side auth branch.
 */
export async function placeCallViaApp(job: PlaceCallJobData): Promise<{ callId: string; twilioCallSid: string }> {
  const response = await fetch(`${config.appInternalUrl}/api/calls`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": config.workerSecret,
    },
    body: JSON.stringify({
      workspaceId: job.workspaceId,
      agentId: job.agentId,
      contactId: job.contactId,
      phoneNumberId: job.phoneNumberId ?? undefined,
      campaignId: job.campaignId ?? undefined,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { callId?: string; twilioCallSid?: string; error?: string };

  if (!response.ok || !payload.callId) {
    throw new Error(payload.error ?? `Call placement failed with status ${response.status}`);
  }

  return { callId: payload.callId, twilioCallSid: payload.twilioCallSid ?? "" };
}
