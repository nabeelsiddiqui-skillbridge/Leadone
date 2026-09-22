import { NextResponse } from "next/server";

import { rollupAllWorkspacesForDay } from "@/lib/usage-rollup";

export const runtime = "nodejs";
export const maxDuration = 60;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayIso() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Rolls up usage_records for every workspace. Meant to be hit by an
 * external scheduler (Vercel Cron, a system crontab, a GitHub Actions
 * schedule, etc.) — this app has no standalone background-loop process of
 * its own (the two that do, services/realtime-voice and
 * services/campaign-worker, are for calling, not batch rollups). Recommended
 * schedule: hourly, rolling up *today* (so in-progress usage stays close to
 * live) plus once daily shortly after midnight UTC for *yesterday* (to
 * catch anything from calls that finished after the last hourly tick).
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` — set CRON_SECRET
 * in the environment and configure your scheduler to send it.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const day = url.searchParams.get("day") ?? (url.searchParams.get("yesterday") === "true" ? yesterdayIso() : todayIso());

  const result = await rollupAllWorkspacesForDay(day);
  return NextResponse.json({ day, ...result });
}
