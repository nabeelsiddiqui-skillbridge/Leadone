import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Database } from "@/lib/supabase/database.types";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
type CampaignContactStatus = Database["public"]["Tables"]["campaign_contacts"]["Row"]["status"];

const TWILIO_STATUS_TO_OUTCOME: Record<string, string> = {
  completed: "connected",
  busy: "busy",
  "no-answer": "no_answer",
  failed: "failed",
  canceled: "canceled",
};

export interface RetryDecision {
  attempts: number;
  status: CampaignContactStatus;
  nextAttemptAt: string | null;
}

/**
 * Pure retry-scheduling decision, split out from recordCallCompletion so
 * it's unit-testable without a database. Given a campaign's retry rules,
 * the lead's attempt count *before* this call, and this call's outcome,
 * decides whether the lead goes back in the queue (and when) or is done.
 */
export function decideNextCampaignContactState(
  campaign: Pick<Campaign, "max_attempts" | "retry_excluded_statuses" | "retry_busy_minutes" | "retry_no_answer_minutes" | "retry_failed_minutes">,
  attemptsBefore: number,
  outcome: string,
  now: Date = new Date()
): RetryDecision {
  const attempts = attemptsBefore + 1;
  const isDoneOutcome = outcome === "connected";
  const exhaustedAttempts = attempts >= campaign.max_attempts;
  const excluded = campaign.retry_excluded_statuses.includes(outcome);

  const status: CampaignContactStatus = isDoneOutcome || exhaustedAttempts || excluded ? "completed" : "queued";

  if (status !== "queued") {
    return { attempts, status, nextAttemptAt: null };
  }

  const minutes =
    outcome === "busy"
      ? campaign.retry_busy_minutes
      : outcome === "no_answer"
        ? campaign.retry_no_answer_minutes
        : campaign.retry_failed_minutes;

  return { attempts, status, nextAttemptAt: new Date(now.getTime() + minutes * 60 * 1000).toISOString() };
}

/**
 * Called from the Twilio status webhook once a call reaches a terminal
 * status. Records the attempt and, if the call belonged to a campaign,
 * advances that lead's campaign_contacts row per decideNextCampaignContactState.
 * The campaign worker is what actually places the next call once
 * next_attempt_at arrives - this function only computes when that should be.
 */
export async function recordCallCompletion(params: {
  callId: string;
  workspaceId: string;
  campaignId: string | null;
  contactId: string | null;
  twilioStatus: string;
}): Promise<void> {
  const { callId, campaignId, contactId, twilioStatus } = params;
  const db = createServiceRoleClient();
  const outcome = TWILIO_STATUS_TO_OUTCOME[twilioStatus] ?? twilioStatus;

  if (!campaignId || !contactId) return;

  const { data: campaign } = await db.from("campaigns").select("*").eq("id", campaignId).maybeSingle();
  const { data: campaignContact } = await db
    .from("campaign_contacts")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (!campaign || !campaignContact) return;

  const decision = decideNextCampaignContactState(campaign, campaignContact.attempts, outcome);

  await db.from("campaign_attempts").insert({
    campaign_id: campaignId,
    contact_id: contactId,
    call_id: callId,
    attempt_number: decision.attempts,
    outcome,
  });

  await db
    .from("campaign_contacts")
    .update({
      attempts: decision.attempts,
      status: decision.status,
      last_attempt_at: new Date().toISOString(),
      next_attempt_at: decision.nextAttemptAt,
      locked_at: null,
      locked_by: null,
    })
    .eq("id", campaignContact.id);
}
