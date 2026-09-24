import { db } from "./db.js";
import { config } from "./config.js";
import { isWithinCallingWindow, resolveTimezone, type CallingWindow } from "./callingHours.js";
import type { Queue } from "bullmq";
import type { PlaceCallJobData } from "./placeCall.js";

const ACTIVE_CALL_STATUSES = ["queued", "initiated", "ringing", "in_progress"];

interface CampaignRow extends CallingWindow {
  id: string;
  workspace_id: string;
  agent_id: string;
  phone_number_id: string | null;
  status: string;
  daily_call_limit: number;
  concurrency_limit: number;
  max_attempts: number;
  retry_failed_minutes: number;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function releaseClaim(campaignContactId: string, opts: { requeueAt?: string; markCompleted?: boolean; incrementAttempts?: boolean }) {
  const patch: Record<string, unknown> = { locked_at: null, locked_by: null };
  if (opts.markCompleted) {
    patch.status = "completed";
  } else {
    patch.status = "queued";
    if (opts.requeueAt) patch.next_attempt_at = opts.requeueAt;
  }

  if (opts.incrementAttempts) {
    const { data: current } = await db.from("campaign_contacts").select("attempts").eq("id", campaignContactId).single();
    patch.attempts = (current?.attempts ?? 0) + 1;
  }

  await db.from("campaign_contacts").update(patch).eq("id", campaignContactId);
}

async function countCallsToday(campaignId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await db
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .gte("created_at", startOfDay.toISOString());
  return count ?? 0;
}

async function countActiveCalls(campaignId: string): Promise<number> {
  const { count } = await db
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ACTIVE_CALL_STATUSES);
  return count ?? 0;
}

/**
 * One tick of the campaign scanner: for every `running` campaign, works out
 * how many more calls it may start right now (concurrency limit minus calls
 * already in flight, daily limit minus calls already made today), and for
 * each available slot atomically claims the next dialable lead and enqueues
 * a start_call job for it. See supabase/migrations/20250101000600_campaign_worker.sql
 * for the SKIP LOCKED claim function this relies on to avoid double-dialing.
 */
export async function scanCampaignsOnce(queue: Queue<PlaceCallJobData>): Promise<{ enqueued: number; campaignsScanned: number }> {
  const { data: campaigns } = await db
    .from("campaigns")
    .select(
      "id, workspace_id, agent_id, phone_number_id, status, timezone_mode, fixed_timezone, days_of_week, calling_start_time, calling_end_time, start_date, end_date, daily_call_limit, concurrency_limit, max_attempts, retry_failed_minutes"
    )
    .in("status", ["running", "scheduled"]);

  let enqueued = 0;

  for (const campaign of (campaigns ?? []) as CampaignRow[]) {
    if (campaign.status === "scheduled") {
      // A campaign the user "started" from the wizard lands here as
      // 'scheduled', not 'running' - promote it to 'running' the first tick
      // its start_date (if any) has arrived. The .eq("status", "scheduled")
      // guard below no-ops the update if it was paused/stopped concurrently.
      if (campaign.start_date && campaign.start_date > todayIsoDate()) continue;
      const { error } = await db
        .from("campaigns")
        .update({ status: "running" })
        .eq("id", campaign.id)
        .eq("status", "scheduled");
      if (error) continue;
      campaign.status = "running";
    }

    // "always" matches neither branch below, so it's dialable at any hour on
    // any day - the intentional bypass for a campaign that should start
    // calling immediately instead of waiting for a calling-hours window.
    if (campaign.timezone_mode === "fixed") {
      const tz = resolveTimezone(campaign, null);
      if (!tz || !isWithinCallingWindow(campaign, tz)) continue;
    }

    const [callsToday, activeCalls] = await Promise.all([countCallsToday(campaign.id), countActiveCalls(campaign.id)]);
    const dailyRemaining = campaign.daily_call_limit - callsToday;
    const concurrencyRemaining = campaign.concurrency_limit - activeCalls;
    const slots = Math.max(0, Math.min(dailyRemaining, concurrencyRemaining));

    for (let i = 0; i < slots; i++) {
      const { data: claimed } = await db.rpc("claim_next_campaign_contact", {
        p_campaign_id: campaign.id,
        p_worker_id: config.workerId,
      });
      const claim = claimed?.[0];
      if (!claim) break; // nothing left to dial in this campaign right now

      let timezone: string | null = null;
      if (campaign.timezone_mode === "contact_local") {
        const { data: contact } = await db.from("contacts").select("timezone").eq("id", claim.contact_id).maybeSingle();
        timezone = resolveTimezone(campaign, contact?.timezone ?? null);
        if (!timezone || !isWithinCallingWindow(campaign, timezone)) {
          // Not callable right now (unknown timezone, or outside their local
          // hours) - release without penalizing attempts; a later tick will
          // pick it back up once it's actually within hours.
          await releaseClaim(claim.id, {});
          continue;
        }
      }

      try {
        await queue.add(
          "start_call",
          {
            workspaceId: campaign.workspace_id,
            agentId: campaign.agent_id,
            contactId: claim.contact_id,
            phoneNumberId: campaign.phone_number_id,
            campaignId: campaign.id,
            campaignContactId: claim.id,
            maxAttempts: campaign.max_attempts,
            retryFailedMinutes: campaign.retry_failed_minutes,
          } satisfies PlaceCallJobData,
          { removeOnComplete: 500, removeOnFail: 500 }
        );
        enqueued += 1;
      } catch (err) {
        console.error(`[campaign ${campaign.id}] failed to enqueue start_call`, err);
        await releaseClaim(claim.id, {});
      }
    }
  }

  return { enqueued, campaignsScanned: campaigns?.length ?? 0 };
}

export { releaseClaim };
