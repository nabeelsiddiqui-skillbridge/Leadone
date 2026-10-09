-- ElevenLabs as an alternate voice/conversation engine for agents (see
-- services/realtime-voice). Same pattern as the earlier Lead Discovery
-- provider widening: integration_credentials.provider has a check
-- constraint that needs the new value added.
alter table public.integration_credentials drop constraint integration_credentials_provider_check;
alter table public.integration_credentials add constraint integration_credentials_provider_check
  check (provider in ('openai', 'twilio', 'google', 'smtp', 'webhook', 'anthropic', 'google_places', 'hunter_io', 'job_postings', 'news_funding', 'elevenlabs'));
