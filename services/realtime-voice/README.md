# LeadOne realtime voice server

A standalone, always-on Node.js process — deliberately **not** a Next.js API
route or serverless function — that bridges a single phone call's Twilio
Media Stream to an OpenAI Realtime API session for its entire duration.

## Why a separate process

A phone call needs a persistent bidirectional socket that stays open for
minutes at a time, forwarding audio both ways with sub-second latency.
Serverless request/response functions (including Next.js Route Handlers)
are the wrong tool for that: most platforms cap execution time and don't
support long-lived WebSocket upgrades. This service runs as its own
container/process, reachable at a `wss://` URL, and is what Twilio's
`<Connect><Stream>` verb connects to directly.

## How a call ends up here

1. The Next.js app (or the campaign worker) creates a `calls` row and calls
   the Twilio REST API to place an outbound call, pointing Twilio's
   `url` (answer webhook) at `${TWILIO_WEBHOOK_BASE_URL}/api/webhooks/twilio/voice?callId=<uuid>`.
2. When the call connects, Twilio POSTs to that webhook. It responds with
   TwiML: `<Connect><Stream url="${REALTIME_WEBSOCKET_URL}?callId=<uuid>" /></Connect>`.
3. Twilio opens a WebSocket to this service at that URL. This service reads
   `callId` from the query string, loads the call + agent + contact +
   knowledge base from Supabase (service-role client — this process has no
   user session), and opens its own WebSocket session to the OpenAI
   Realtime API.
4. From then on this process is a pure bridge: Twilio media frames in →
   `input_audio_buffer.append` on the OpenAI socket; OpenAI `response.audio.delta`
   frames out → Twilio media frames, streamed as they arrive (never
   buffered until the full response is ready). Barge-in is handled by
   OpenAI's server-side VAD (`input_audio_buffer.speech_started`), which
   triggers a Twilio `clear` event and an OpenAI `response.cancel`.
5. Tool calls the model makes (book_appointment, mark_do_not_call, etc.)
   are validated and executed server-side against Supabase — see
   `src/tools/`. Every turn's transcript and latency numbers are written to
   `call_transcripts` / `call_turns` as the call progresses, not batched at
   the end, so a live call detail page could tail it if one existed.
6. On Twilio's `stop` event (or a socket close), the call row is finalized
   (`status`, `duration_seconds`, `ended_at`) and both sockets are closed.

## Audio format

Twilio Media Streams default to 8kHz mono mu-law (`audio/x-mulaw`), base64
encoded. The OpenAI Realtime API accepts and emits `g711_ulaw` directly, so
this service does **no transcoding** — it passes the base64 payloads
straight through in both directions. If a future OpenAI Realtime model
drops `g711_ulaw` support, this is the file to revisit: `src/openaiRealtime.ts`.

## Running it

```bash
cd services/realtime-voice
npm install
cp ../../.env.example .env   # then fill in real values
npm run dev
```

Requires `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `REALTIME_VOICE_PORT` (default
`8080`). It does not need `NEXT_PUBLIC_*` vars — it never runs in a browser.

## What's real vs. deferred here

Everything in this service — the Twilio bridge, the OpenAI Realtime
session, barge-in, transcript/latency logging, and the tool-call dispatcher
— is fully implemented and will work end-to-end once real Twilio/OpenAI/
Supabase credentials are configured. Two tools (`check_availability`,
`book_appointment`) currently return an honest "not connected yet" result
instead of fabricating a booking, because Google Calendar integration ships
in Phase 3 (`src/tools/calendar.ts` has the TODO). `search_knowledge_base`
does a real pgvector similarity search but returns an empty result set
until the Phase 3 knowledge-base ingestion pipeline populates
`knowledge_chunks`. `send_sms` and `send_email` are feature-flagged off
(`SMS`/`EMAIL` in `feature_flags`) by default and return a "feature
disabled" result rather than silently no-opping.
