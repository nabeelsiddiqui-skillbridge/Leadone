# LeadOne

AI-powered outbound calling platform. Businesses create AI voice agents, load lead lists into campaigns, and the platform dials, has real phone conversations, qualifies prospects, answers questions from a knowledge base, books appointments, and reports on results — plus a Super Admin console to run the whole SaaS.

## Architecture

- **Web app** — Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + hand-rolled shadcn/ui-style components, in `src/`.
- **Database / Auth / Storage** — Supabase (Postgres + Row Level Security, Supabase Auth, Supabase Storage). Schema and RLS policies live in `supabase/migrations/`.
- **Realtime voice server** — a standalone, always-on Node process in `services/realtime-voice` that bridges a Twilio Media Stream to the OpenAI Realtime API for a single call. Deliberately **not** a serverless function — a phone call needs a persistent bidirectional socket for its whole duration.
- **Campaign worker** — a BullMQ/Redis-backed background worker (`services/campaign-worker`) that finds eligible campaigns, respects calling hours/concurrency/DNC/retry rules, and starts calls via the Twilio REST API.
- **Telephony** — Twilio Voice, phone numbers, Bidirectional Media Streams, recordings.
- **AI voice** — OpenAI Realtime API, one session per active call, maintained by the realtime voice server for the call's whole lifetime.

## Multi-tenancy

Every customer belongs to one or more **workspaces**. All customer-owned data (agents, campaigns, contacts, calls, knowledge bases, phone numbers, integrations) is scoped to a workspace and isolated via Postgres RLS (`public.is_workspace_member()` / `is_workspace_admin()` in `supabase/migrations/20250101000200_functions_triggers.sql`). A separate **Super Admin** area (`/super-admin`, gated on `profiles.platform_role = 'super_admin'`) can see and manage everything across every workspace.

## Getting started

1. Create a [Supabase](https://supabase.com) project.
2. Apply the migrations in `supabase/migrations/` in order (via `supabase db push` with the Supabase CLI, or by pasting each file into the SQL editor in filename order).
3. Copy `.env.example` to `.env.local` and fill in Supabase, OpenAI, Twilio, Google OAuth, Redis and encryption values. See the comments in that file for what each one is for and how it's used.
4. `npm install`
5. `npm run dev` — starts the Next.js app at http://localhost:3000.
6. To promote your own account to Super Admin once you've registered, run in the Supabase SQL editor:
   ```sql
   update public.profiles set platform_role = 'super_admin' where id = '<your auth.users id>';
   ```

The realtime voice server and campaign worker are separate long-running processes; see their own READMEs under `services/` for how to run them (added as those phases land — see the implementation log below).

## Implementation status

This platform is being built in phases (see the task list Claude maintains during the build). Each phase is only reported done once it compiles, passes lint, and — where credentials are available — has been exercised against a real Supabase/Twilio/OpenAI project. Anything not yet wired to a real backend is called out explicitly rather than left as a silently-fake button.
