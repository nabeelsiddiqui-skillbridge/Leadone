import type { Queue } from "bullmq";

import { db } from "./db.js";
import { config } from "./config.js";
import type { PlaceCallJobData } from "./placeCall.js";

/**
 * Callbacks (created by the schedule_callback realtime-voice tool when a
 * caller asks to be called back at a specific time) aren't tied to a
 * campaign's concurrency/daily limits - they're a direct promise made to
 * someone, so this scans and places them independently of scanCampaignsOnce.
 * The callback's `status` only flips to 'completed'/'missed' once
 * startCallWorker's job actually resolves - not here - so a crash between
 * claiming and enqueuing never silently loses a promised callback (the
 * claim's 5-minute staleness window in claim_due_callback lets another tick
 * pick it back up).
 */
export async function scanCallbacksOnce(queue: Queue<PlaceCallJobData>): Promise<number> {
  let placed = 0;

  // Claim due callbacks one at a time until none are left; bounded so one
  // tick can't run forever if a backlog builds up.
  for (let i = 0; i < 50; i++) {
    const { data: claimed } = await db.rpc("claim_due_callback", { p_worker_id: config.workerId });
    const callback = claimed?.[0];
    if (!callback) break;

    if (!callback.agent_id) {
      // No agent recorded on the callback (shouldn't normally happen -
      // schedule_callback always sets one); nothing sensible to dial with,
      // so just mark it missed rather than leaving it locked forever.
      await db.from("callbacks").update({ status: "missed", locked_at: null, locked_by: null }).eq("id", callback.id);
      continue;
    }

    const { data: contact } = await db
      .from("contacts")
      .select("id, status")
      .eq("id", callback.contact_id)
      .maybeSingle();

    if (!contact || contact.status === "do_not_call") {
      await db.from("callbacks").update({ status: "cancelled", locked_at: null, locked_by: null }).eq("id", callback.id);
      continue;
    }

    await queue.add(
      "start_call",
      {
        workspaceId: callback.workspace_id,
        agentId: callback.agent_id,
        contactId: callback.contact_id,
        phoneNumberId: null,
        campaignId: callback.campaign_id,
        callbackId: callback.id,
      } satisfies PlaceCallJobData,
      { removeOnComplete: 500, removeOnFail: 500 }
    );

    placed += 1;
  }

  return placed;
}
