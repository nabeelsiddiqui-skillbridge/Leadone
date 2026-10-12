-- ElevenLabs as an alternate voice/conversation engine for agents (the
-- "brain and voice" together, not just TTS). An agent picks a provider:
--
-- - 'openai' (default, unchanged): this app's own realtime-voice service
--   bridges Twilio <-> OpenAI Realtime, exactly as it does today.
-- - 'elevenlabs': the Twilio webhook instead calls ElevenLabs' "register
--   call" API, which returns TwiML that connects Twilio's Media Stream
--   directly to ElevenLabs' own agent - this app's realtime-voice service
--   is never involved in that call at all. See src/lib/elevenlabs.ts.
--
-- elevenlabs_agent_id is the synced agent on ElevenLabs' side (created/
-- updated whenever this agent is saved with provider='elevenlabs').
-- elevenlabs_voice_id is which ElevenLabs voice that agent uses.
alter table public.agents
  add column voice_provider text not null default 'openai' check (voice_provider in ('openai', 'elevenlabs'));
alter table public.agents
  add column elevenlabs_agent_id text;
alter table public.agents
  add column elevenlabs_voice_id text;

-- Set once a call's post-call webhook arrives from ElevenLabs, so a given
-- conversation can be looked up/reconciled directly if needed.
alter table public.calls
  add column elevenlabs_conversation_id text;
