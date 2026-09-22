# LeadOne campaign worker

A standalone Node.js background process that turns a `running` campaign
into actual outbound calls. It does not talk to Twilio or OpenAI directly —
it decides *when* and *who* to call, then asks the Next.js app's
`POST /api/calls` to do the actual dialing (the same endpoint the UI uses
for manual "Call now"/test calls), authenticated with a shared secret
instead of a user session.

## What it does, every `CAMPAIGN_SCAN_INTERVAL_MS` (default 15s)

1. **Campaign scan** (`src/scanner.ts`): for every campaign with
   `status = 'running'`, computes how many more calls it's allowed to start
   right now — `concurrency_limit` minus calls already in flight,
   `daily_call_limit` minus calls already made today — and for each
   available slot, atomically claims the next dialable lead via the
   `claim_next_campaign_contact` Postgres function (`SELECT ... FOR UPDATE
   SKIP LOCKED`, see `supabase/migrations/20250101000600_campaign_worker.sql`)
   so two ticks (or two worker instances) never grab the same contact twice.
   For `timezone_mode: 'contact_local'` campaigns, the claimed contact's own
   calling-hours window is checked (`src/callingHours.ts`) *after* claiming
   — if they're outside their local hours right now, the claim is released
   without counting against `max_attempts` and picked up again later.
2. **Callback scan** (`src/callbackScanner.ts`): independently claims due
   rows from `callbacks` (created by the `schedule_callback` tool in
   `services/realtime-voice` when a caller asks to be called back) via
   `claim_due_callback`, and enqueues them the same way.
3. Both scans enqueue a `start_call` BullMQ job (`src/startCallWorker.ts`),
   processed with concurrency 10, which POSTs to
   `${APP_INTERNAL_URL}/api/calls`. On failure (the call never got a Twilio
   SID at all — misconfiguration, network error, etc.), the worker itself
   advances `campaign_contacts.attempts`/`next_attempt_at` or marks the
   callback `missed`, since no Twilio status webhook will ever fire for a
   call that was never placed. On success, the campaign lead stays
   `in_progress` — the Next app's Twilio status webhook
   (`src/lib/campaign-progress.ts`) is the single source of truth for the
   real outcome (connected/busy/no-answer/failed) once the call actually
   runs, and advances retry scheduling from there.

## Running it

```bash
cd services/campaign-worker
npm install
cp ../../.env.example .env   # then fill in real values
npm run dev
```

Requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`,
`CAMPAIGN_WORKER_SECRET` (must match the Next app's env var of the same
name), `APP_INTERNAL_URL` (the Next app's own base URL, reachable from
wherever this worker runs).

## What's real vs. what needs a live stack to verify

Every piece of logic here — claiming, calling-hours math, concurrency/daily
limits, retry scheduling on dial failure — runs against the real schema and
will work once Supabase, Redis, and the Next app are actually deployed and
reachable from each other. It has not been exercised end-to-end in this
environment (no live Supabase project, no Redis instance, no phone
network) — that would need a real deployment to confirm timing behavior
under load.
