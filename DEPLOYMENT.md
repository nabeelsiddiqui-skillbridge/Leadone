# Deploying LeadOne

LeadOne is four deployable pieces plus one managed service:

| Piece | What it is | Where it can run |
|---|---|---|
| **Web app** (`/`) | Next.js 16 app: customer UI, Super Admin UI, API routes, Twilio webhooks | Vercel, or any Node 20+ host |
| **`services/realtime-voice`** | Standalone WebSocket server bridging Twilio ↔ OpenAI Realtime, one connection per live call | A host that supports long-lived connections: Fly.io, Railway, Render, an ECS/Kubernetes service, or a plain VM. **Not** Vercel/AWS Lambda-style serverless — see its own README for why. |
| **`services/campaign-worker`** | Standalone background worker that scans campaigns and places calls | Same category as `realtime-voice` — any host that runs a long-lived process. |
| **Redis** | Job queue backing `campaign-worker` (BullMQ) | Upstash Redis, Railway Redis, AWS ElastiCache, or a self-hosted instance. |
| **Supabase** | Postgres + Auth + Storage | supabase.com (managed) or self-hosted Supabase. |

Local development: `npm run dev` for the web app, `npm run dev` in each `services/*` directory (uses `tsx watch`), and `docker compose up` (repo root) for Redis + both services together — see `docker-compose.yml`.

## 1. Supabase project

1. Create a project at supabase.com (or `supabase init && supabase start` for local dev).
2. Apply every file in `supabase/migrations/` **in filename order** — either `supabase db push` with the Supabase CLI linked to your project, or paste each file into the SQL editor in order. They're numbered so the order is unambiguous.
3. Enable the `vector` extension if your project doesn't already have it (the first migration does this, but confirm under Database → Extensions if you applied migrations manually).
4. Create a Storage bucket named `knowledge-base-files` (Storage → New bucket) for knowledge base file uploads.
5. Copy the project's URL, anon key, and service_role key (Settings → API) — you'll need all three below.

## 2. Environment variables

Copy `.env.example` to `.env.local` (web app) and to `.env` in each `services/*` directory, then fill in real values. Every variable is documented inline in `.env.example`; the ones worth calling out specifically:

- `ENCRYPTION_KEY` — generate once with `openssl rand -hex 32` and **never change it after credentials have been encrypted with it** (integration_credentials/calendar_connections rows become undecryptable — you'd have to have every workspace/admin re-enter their keys).
- `CAMPAIGN_WORKER_SECRET` — generate with `openssl rand -hex 32`; must be identical in the web app's env and `services/campaign-worker`'s env.
- `CRON_SECRET` — generate the same way; used to authorize the usage-rollup endpoint (§7 below).
- `SUPABASE_SERVICE_ROLE_KEY` — full-access, bypasses Row Level Security. It's used by: the web app's server-only credential-resolution/webhook code, `services/realtime-voice`, and `services/campaign-worker`. Never put it in a `NEXT_PUBLIC_*` variable or send it to a Client Component.
- `TWILIO_WEBHOOK_BASE_URL` / `NEXT_PUBLIC_APP_URL` — must be the web app's real public URL once deployed (not `localhost`) — Twilio needs to reach it.
- `REALTIME_WEBSOCKET_URL` — the public `wss://` URL of your deployed `realtime-voice` service (not `localhost`) — the web app's Twilio voice webhook embeds this in the TwiML it returns.

## 3. Deploy the web app

Any Node 20+ host works; Vercel is the path of least resistance for Next.js. Set every web-app-relevant variable from `.env.example` in your host's environment settings — `NEXT_PUBLIC_*` ones are needed at build time too.

## 4. Deploy `services/realtime-voice`

Build with the included `Dockerfile`, or `npm ci && npm run build && npm start` directly on a VM. It listens on `REALTIME_VOICE_PORT` (default 8080) at path `/media-stream`, and exposes `/health` for health checks (the Dockerfile's `HEALTHCHECK` already uses it). Whatever platform you use, it needs:

- A stable public `wss://` URL (most platforms terminate TLS for you and proxy to your container's plain `ws://` port — confirm yours does, since Twilio requires `wss://`).
- The same `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`ENCRYPTION_KEY`/`OPENAI_API_KEY`/`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` as the web app.
- No inbound access needed other than the WebSocket port — it never receives HTTP traffic besides `/health` and `/media-stream`.

Set the web app's `REALTIME_WEBSOCKET_URL` to this service's public `wss://` URL once deployed.

## 5. Deploy `services/campaign-worker`

Same hosting category as above (build with its `Dockerfile`, or `npm ci && npm run build && npm start`). It needs:

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL` pointing at your Redis instance
- `APP_INTERNAL_URL` — the web app's URL, reachable from wherever this worker runs
- `CAMPAIGN_WORKER_SECRET` — must match the web app's value

No inbound access needed at all — it only makes outbound calls to Supabase, Redis, and the web app's `POST /api/calls`.

## 6. Twilio

Buy or port in a number in the Twilio console, then add it in the app itself at `/phone-numbers` (this repo doesn't yet sync numbers automatically — see that page's own note). **No webhook URLs need to be configured in the Twilio console** — the app sets `url`/`statusCallback`/`recordingStatusCallback` programmatically on every `calls.create()` call (see `src/lib/place-call.ts`), each one-time and specific to that call.

## 7. Google Calendar OAuth

In Google Cloud Console: create an OAuth 2.0 Client ID (Web application), add `${APP_URL}/api/integrations/google-calendar/callback` as an authorized redirect URI, enable the Google Calendar API for the project. Set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` in the web app's environment. A workspace admin then connects their calendar from `/integrations`.

## 8. Usage rollup cron

`POST /api/cron/rollup-usage` (bearer-token protected by `CRON_SECRET`) needs an external scheduler — this app has no standalone background loop of its own for batch jobs like this (the two services do, but they're for calling, not rollups). Recommended: hourly for *today* plus once daily for *yesterday*, e.g. with Vercel Cron (`vercel.json`):

```json
{
  "crons": [
    { "path": "/api/cron/rollup-usage", "schedule": "0 * * * *" },
    { "path": "/api/cron/rollup-usage?yesterday=true", "schedule": "5 0 * * *" }
  ]
}
```

(Vercel Cron doesn't send custom headers, so if you use it, adjust the route to also accept the secret as a query param, or trigger it from a platform that lets you set an `Authorization` header — a plain system crontab with `curl` works too: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://yourapp.com/api/cron/rollup-usage`.)

## 9. First Super Admin

After registering your own account through the app, promote it in the Supabase SQL editor:

```sql
update public.profiles set platform_role = 'super_admin' where id = '<your auth.users id>';
```

## 10. Smoke test

Once everything above is live, walk through: register → create an agent → connect Twilio (add a phone number) → connect a calendar → create a knowledge base with some content → create a campaign → upload a few leads → start the campaign → confirm the campaign worker picks it up and a call gets placed → confirm the call shows up in `/calls` with a transcript and (if recording is on) a recording → confirm an appointment booked during the call shows up in `/appointments` and on the connected Google Calendar. That's the full path described in the product spec's end-to-end test, and it's the fastest way to catch a misconfigured env var before real leads get called.
