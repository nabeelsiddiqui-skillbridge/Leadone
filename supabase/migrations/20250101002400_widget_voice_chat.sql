-- ============================================================================
-- In-browser voice chat for the embeddable widget (ElevenLabs-style): a
-- visitor talks to the agent directly through their mic/speaker, no phone
-- number involved. Reuses the existing realtime-voice server and
-- OpenAIRealtimeSession as-is - that server is already direction/transport
-- agnostic (see src/app/api/webhooks/twilio/voice-inbound/route.ts's own
-- comment to this effect), it only ever needed a `calls` row to read the
-- agent/contact from and a WebSocket that speaks its "start"/"media"/"stop"
-- JSON protocol. `channel` here is purely descriptive (for the calls list UI
-- and analytics) - it has no bearing on how the realtime-voice server
-- handles the session.
-- ============================================================================

alter table public.calls
  add column channel text not null default 'phone' check (channel in ('phone', 'web_widget'));

alter table public.chat_widgets
  add column voice_chat_enabled boolean not null default false;
