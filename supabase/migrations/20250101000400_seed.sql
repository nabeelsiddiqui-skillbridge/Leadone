-- Default platform configuration. Safe to re-run.

insert into public.feature_flags (key, enabled, description) values
  ('AI_CALLING', true, 'Master switch for outbound AI calling'),
  ('CALL_RECORDING', true, 'Record calls via Twilio'),
  ('GOOGLE_CALENDAR', true, 'Google Calendar appointment booking'),
  ('CALL_TRANSFER', true, 'Allow agents to transfer calls to a human'),
  ('SMS', false, 'Outbound SMS via Twilio'),
  ('EMAIL', false, 'Outbound email via SMTP integration'),
  ('INBOUND_CALLS', false, 'Accept inbound calls to workspace numbers'),
  ('KNOWLEDGE_BASE', true, 'Knowledge base retrieval during calls'),
  ('CAMPAIGN_AUTODIALER', true, 'Background campaign worker auto-dialing')
on conflict (key) do nothing;

insert into public.system_settings (key, value) values
  ('registration_enabled', 'true'),
  ('maintenance_mode', 'false'),
  ('default_plan', '"trial"'),
  ('default_limits', '{
    "agents": 5,
    "campaigns": 10,
    "contacts": 5000,
    "concurrent_calls": 3,
    "monthly_minutes": 1000
  }'),
  ('openai_defaults', '{
    "realtime_model": "gpt-realtime",
    "fallback_model": "gpt-4o-realtime-preview",
    "voice": "alloy"
  }'),
  ('twilio_defaults', '{
    "webhook_base_url": "",
    "media_stream_base_url": ""
  }')
on conflict (key) do nothing;

-- Indicative pricing; edit from /super-admin/settings/apis. Units: cents
-- per minute for voice, cents per 1K tokens for OpenAI text/audio tokens.
insert into public.pricing_settings (provider, unit, unit_cost_micros) values
  ('twilio', 'voice_minute_usd', 14000),
  ('openai', 'realtime_audio_input_minute_usd', 100000),
  ('openai', 'realtime_audio_output_minute_usd', 200000)
on conflict (provider, unit) do nothing;
