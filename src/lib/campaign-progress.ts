import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Database } from "@/lib/supabase/database.types";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];

const TWILIO_STATUS_TO_OUTCOME: Record<string, string> = {
  completed: "connected",
  busy: "busy",
  "no-answer": "no_answer",
  failed: "failed",
  canceled: "canceled",
};

/**
 * Called from the Twilio status webhook once a call reaches a terminal
 * status. Records the attempt and, if the call belonged to a campaign,
 * advances that lead's campaign_contacts row: bumps the attempt count and
 * either marks it done or schedules the next attempt per the campaign's
 * retry rules. The campaign worker (a later phase) is what actually places
 * the next call once next_attempt_at arrives — this function only computes
 * when that should be.
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

  const attempts = campaignContact.attempts + 1;

  await db.from("campaign_attempts").insert({
    campaign_id: campaignId,
    contact_id: contactId,
    call_id: callId,
    attempt_number: attempts,
    outcome,
  });

  const isDoneOutcome = outcome === "connected";
  const exhaustedAttempts = attempts >= campaign.max_attempts;
  const excluded = campaign.retry_excluded_statuses.includes(outcome);

  const nextStatus = isDoneOutcome
    ? "completed"
    : exhaustedAttempts || excluded
      ? "completed"
      : "queued";

  const nextAttemptAt =
    nextStatus === "queued" ? computeNextAttemptAt(campaign, outcome) : null;

  await db
    .from("campaign_contacts")
    .update({
      attempts,
      status: nextStatus,
      last_attempt_at: new Date().toISOString(),
      next_attempt_at: nextAttemptAt,
      locked_at: null,
      locked_by: null,
    })
    .eq("id", campaignContact.id);
}

function computeNextAttemptAt(campaign: Campaign, outcome: string): string {
  const minutes =
    outcome === "busy"
      ? campaign.retry_busy_minutes
      : outcome === "no_answer"
        ? campaign.retry_no_answer_minutes
        : campaign.retry_failed_minutes;

  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}
