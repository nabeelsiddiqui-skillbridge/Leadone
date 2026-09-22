# LeadOne

AI-powered outbound calling platform. Businesses create AI voice agents, load lead lists into campaigns, and the platform dials, has real phone conversations, qualifies prospects, answers questions from a knowledge base, books appointments, and reports on results — plus a Super Admin console to run the whole SaaS.

## Architecture

- **Web app** — Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + hand-rolled shadcn/ui-style components, in `src/`.
- **Database / Auth / Storage** — Supabase (Postgres + Row Level Security, Supabase Auth, Supabase Storage). Schema and RLS policies live in `supabase/migrations/`.
- **Realtime voice server** (`services/realtime-voice`) — a standalone, always-on Node process that bridges a Twilio Media Stream to the OpenAI Realtime API for a single call: barge-in, live transcript + latency logging, the full tool-calling framework (appointment booking against Google Calendar, knowledge base search, DNC, callbacks, call transfer), and fire-and-forget post-call AI analysis. Deliberately **not** a serverless function — a phone call needs a persistent bidirectional socket for its whole duration.
- **Campaign worker** (`services/campaign-worker`) — a BullMQ/Redis-backed background worker that scans running campaigns every 15s, respects calling-hours/concurrency/daily-limit/DNC/retry rules, atomically claims the next dialable lead (Postgres `SELECT ... FOR UPDATE SKIP LOCKED`) so nothing gets double-dialed, and places calls via the web app's `/api/calls`.
- **Telephony** — Twilio Voice, phone numbers, Bidirectional Media Streams, recordings.
- **AI voice** — OpenAI Realtime API, one session per active call, maintained by the realtime voice server for the call's whole lifetime.

## Multi-tenancy

Every customer belongs to one or more **workspaces**. All customer-owned data (agents, campaigns, contacts, calls, knowledge bases, phone numbers, integrations) is scoped to a workspace and isolated via Postgres RLS (`public.is_workspace_member()` / `is_workspace_admin()` in `supabase/migrations/20250101000200_functions_triggers.sql`). A separate **Super Admin** area (`/super-admin`, gated on `profiles.platform_role = 'super_admin'`) can see and manage everything across every workspace — the same RLS helper functions grant a super_admin session cross-tenant reads/writes automatically.

## Getting started (local development)

1. Create a [Supabase](https://supabase.com) project (or run one locally with the Supabase CLI: `supabase init && supabase start`).
2. Apply the migrations in `supabase/migrations/` in order (via `supabase db push`, or by pasting each file into the SQL editor in filename order).
3. Create a Storage bucket named `knowledge-base-files`.
4. Copy `.env.example` to `.env.local` (web app) and to `.env` inside `services/realtime-voice/` and `services/campaign-worker/`, filling in real values. Every variable is documented inline.
5. `npm install`, then `npm run dev` — starts the Next.js app at http://localhost:3000.
6. In `services/realtime-voice` and `services/campaign-worker`: `npm install`, then `npm run dev`. Or run both plus Redis together with `docker compose up --build` from the repo root.
7. Promote your own account to Super Admin after registering:
   ```sql
   update public.profiles set platform_role = 'super_admin' where id = '<your auth.users id>';
   ```

For a real deployment (hosting, Twilio/Google OAuth setup, the usage-rollup cron, etc.), see **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## Testing

- `npm test` (repo root) runs the web app's unit tests (Vitest).
- `npm test` inside `services/realtime-voice` and `services/campaign-worker` runs each service's own tests.
- `npm run lint` / `npx tsc --noEmit` for linting and type-checking; each service also has its own `npm run typecheck`.

Unit tests cover pure business logic that doesn't need a live database: credential encryption, cost estimation, campaign retry-scheduling decisions, knowledge base text chunking, campaign calling-hours windows, realtime voice prompt assembly, and the appointment-booking guardrail that refuses to book any time `check_availability` didn't actually return. Row Level Security / tenant-isolation behavior needs a real Postgres instance to verify meaningfully and isn't covered by these — that requires a live or local Supabase project (`supabase test db`, or a scripted RLS check against a real project) as a follow-up.

## What's real vs. what needs configuration

Every feature in this repo is implemented against the real schema and will work end-to-end once real Supabase/Twilio/OpenAI/Google/Redis credentials are configured — nothing is a mocked stand-in for a missing feature. A few things specifically need setup before they do anything (rather than being incomplete code):

- **Calendar booking** (`check_availability`/`book_appointment`) returns an honest "calendar not connected" result until a workspace connects Google Calendar from `/integrations`.
- **Knowledge base search** does a real pgvector similarity search but returns empty until documents are uploaded and ingested for a given knowledge base.
- **SMS follow-ups** are feature-flagged off by default (`/super-admin/settings/apis` → Feature Flags); **email follow-ups** have no provider integration yet and always report as unavailable.
- **Phone number provisioning** is manual entry of numbers you already own in Twilio — automatic Twilio number search/purchase isn't built.
- **Usage/cost dashboards** show real data once `POST /api/cron/rollup-usage` has been scheduled to run (see DEPLOYMENT.md) — before that they show an honest "not rolled up yet" notice instead of fabricated numbers.
