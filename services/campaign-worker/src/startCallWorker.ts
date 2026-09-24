import { Worker, type Job } from "bullmq";

import { config } from "./config.js";
import { db } from "./db.js";
import { placeCallViaApp, type PlaceCallJobData } from "./placeCall.js";

async function handleStartCall(job: Job<PlaceCallJobData>) {
  const data = job.data;

  try {
    const { callId } = await placeCallViaApp(data);
    console.log(`[${data.campaignId ? `campaign ${data.campaignId}` : "callback"}] placed call ${callId} for contact ${data.contactId}`);

    if (data.callbackId) {
      await db.from("callbacks").update({ status: "completed", locked_at: null, locked_by: null }).eq("id", data.callbackId);
    }
    // Campaign-sourced calls: campaign_contacts stays `in_progress` (set by
    // the claim RPC) until the Twilio status webhook resolves it via
    // recordCallCompletion in the Next app (src/lib/campaign-progress.ts) -
    // that's the single source of truth for the real outcome once the call
    // actually connects (or doesn't).
  } catch (err) {
    console.error(`[${data.campaignId ? `campaign ${data.campaignId}` : "callback"}] start_call failed for contact ${data.contactId}:`, err);

    if (data.callbackId) {
      await db.from("callbacks").update({ status: "missed", locked_at: null, locked_by: null }).eq("id", data.callbackId);
    }

    if (data.campaignContactId) {
      // The call never got a Twilio SID at all (config error, network
      // error, DNC caught late, etc.) - no status webhook will ever fire
      // for it, so this worker is the only thing that will ever resolve
      // this claim. Treat it the same way a "failed" Twilio outcome would be.
      const { data: current } = await db
        .from("campaign_contacts")
        .select("attempts")
        .eq("id", data.campaignContactId)
        .maybeSingle();
      const attempts = (current?.attempts ?? 0) + 1;
      const maxAttempts = data.maxAttempts ?? 3;
      const retryMinutes = data.retryFailedMinutes ?? 1440;
      const exhausted = attempts >= maxAttempts;

      await db
        .from("campaign_contacts")
        .update({
          attempts,
          status: exhausted ? "completed" : "queued",
          locked_at: null,
          locked_by: null,
          last_attempt_at: new Date().toISOString(),
          next_attempt_at: exhausted ? null : new Date(Date.now() + retryMinutes * 60 * 1000).toISOString(),
        })
        .eq("id", data.campaignContactId);

      if (data.campaignId) {
        await db.from("campaign_attempts").insert({
          workspace_id: data.workspaceId,
          campaign_id: data.campaignId,
          contact_id: data.contactId,
          attempt_number: attempts,
          outcome: "dial_failed",
        });
      }
    }

    throw err; // let BullMQ record the job as failed too, for observability
  }
}

export function startCallWorker() {
  return new Worker<PlaceCallJobData>("leadone-start-call", handleStartCall, {
    connection: { url: config.redisUrl },
    concurrency: 10,
  });
}
