import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { estimateCostCents } from "@/lib/pricing";

/**
 * Computes one workspace's usage_records row for one UTC day from the raw
 * call/event tables, and upserts it. Approximates ai_audio_input/output
 * seconds as the call's full duration_seconds each — OpenAI Realtime
 * streams audio continuously in both directions for a live call's whole
 * length, so this is a reasonable estimate, not a guess; token counts are
 * exact, summed from the `openai_usage` call_events the realtime voice
 * server logs after every model response (see
 * services/realtime-voice/src/callSession.ts).
 */
export async function rollupWorkspaceUsageForDay(workspaceId: string, dayIso: string): Promise<void> {
  const db = createServiceRoleClient();
  const startOfDay = new Date(`${dayIso}T00:00:00.000Z`);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const { data: calls } = await db
    .from("calls")
    .select("id, status, duration_seconds")
    .eq("workspace_id", workspaceId)
    .gte("created_at", startOfDay.toISOString())
    .lt("created_at", endOfDay.toISOString());

  const callIds = (calls ?? []).map((c) => c.id);
  const callsCount = calls?.length ?? 0;
  const connectedCallsCount = (calls ?? []).filter((c) => c.status === "completed").length;
  const callSeconds = (calls ?? []).reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0);

  const [{ count: recordingsCount }, { count: toolCallsCount }, { count: appointmentsCount }, { data: usageEvents }] =
    await Promise.all([
      db
        .from("call_recordings")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", startOfDay.toISOString())
        .lt("created_at", endOfDay.toISOString()),
      db
        .from("call_tool_calls")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", startOfDay.toISOString())
        .lt("created_at", endOfDay.toISOString()),
      db
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", startOfDay.toISOString())
        .lt("created_at", endOfDay.toISOString()),
      callIds.length > 0
        ? db
            .from("call_events")
            .select("payload")
            .eq("workspace_id", workspaceId)
            .eq("event_type", "openai_usage")
            .in("call_id", callIds)
        : Promise.resolve({ data: [] as { payload: Record<string, unknown> }[] }),
    ]);

  const openaiTokens = (usageEvents ?? []).reduce((sum, row) => {
    const payload = row.payload as Record<string, unknown> | null;
    const total = payload?.total_tokens;
    return sum + (typeof total === "number" ? total : 0);
  }, 0);

  const twilioMinutes = Math.round((callSeconds / 60) * 100) / 100;
  const aiAudioInputSeconds = callSeconds;
  const aiAudioOutputSeconds = callSeconds;

  const estimatedCostCents = await estimateCostCents({
    callSeconds,
    twilioMinutes,
    aiAudioInputSeconds,
    aiAudioOutputSeconds,
  });

  await db.from("usage_records").upsert(
    {
      workspace_id: workspaceId,
      period_date: dayIso,
      calls_count: callsCount,
      connected_calls_count: connectedCallsCount,
      call_seconds: callSeconds,
      ai_audio_input_seconds: aiAudioInputSeconds,
      ai_audio_output_seconds: aiAudioOutputSeconds,
      openai_tokens: openaiTokens,
      twilio_minutes: twilioMinutes,
      recordings_count: recordingsCount ?? 0,
      storage_bytes: 0, // not yet tracked - would need Supabase Storage object metadata
      tool_calls_count: toolCallsCount ?? 0,
      appointments_count: appointmentsCount ?? 0,
      estimated_cost_cents: estimatedCostCents,
    },
    { onConflict: "workspace_id,period_date" }
  );
}

/** Rolls up every workspace with any call activity for the given day. */
export async function rollupAllWorkspacesForDay(dayIso: string): Promise<{ workspacesRolledUp: number }> {
  const db = createServiceRoleClient();
  const { data: workspaces } = await db.from("workspaces").select("id");

  for (const workspace of workspaces ?? []) {
    await rollupWorkspaceUsageForDay(workspace.id, dayIso);
  }

  return { workspacesRolledUp: workspaces?.length ?? 0 };
}
