import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { placeCall } from "@/lib/place-call";

export const runtime = "nodejs";

const initiateCallSchema = z.object({
  agentId: z.string().uuid(),
  contactId: z.string().uuid(),
  phoneNumberId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  // Only honored on the worker-authenticated path (see below) — a logged-in
  // user's own workspace always comes from their session, never the body.
  workspaceId: z.string().uuid().optional(),
});

/**
 * Places a real outbound call: creates the `calls` row, then asks Twilio to
 * dial out with the voice webhook pointed back at this app (which returns
 * TwiML connecting the call to the realtime voice server).
 *
 * Two callers, two auth paths:
 * 1. A logged-in user (manual "Call now" / agent test call) — normal
 *    session cookie, workspace resolved server-side via
 *    requireCurrentWorkspace(), RLS-scoped client.
 * 2. The campaign worker (services/campaign-worker, a separate process with
 *    no browser session) — a shared secret in the `x-worker-secret` header
 *    matching CAMPAIGN_WORKER_SECRET, and an explicit `workspaceId` in the
 *    body (the worker already resolved it from the campaign row it's
 *    dialing for). Uses the service-role client since there's no user
 *    session to scope RLS to.
 */
export async function POST(request: Request) {
  const workerSecret = request.headers.get("x-worker-secret");
  const isWorkerRequest = Boolean(workerSecret) && workerSecret === process.env.CAMPAIGN_WORKER_SECRET;

  const body = await request.json().catch(() => null);
  const parsed = initiateCallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  let workspaceId: string;
  let supabase;

  if (isWorkerRequest) {
    if (!parsed.data.workspaceId) {
      return NextResponse.json({ error: "workspaceId is required for worker-authenticated requests." }, { status: 400 });
    }
    workspaceId = parsed.data.workspaceId;
    supabase = createServiceRoleClient();
  } else {
    const { workspace } = await requireCurrentWorkspace();
    workspaceId = workspace.id;
    supabase = await createClient();
  }

  const result = await placeCall(supabase, {
    workspaceId,
    agentId: parsed.data.agentId,
    contactId: parsed.data.contactId,
    phoneNumberId: parsed.data.phoneNumberId,
    campaignId: parsed.data.campaignId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ callId: result.callId, twilioCallSid: result.twilioCallSid });
}
