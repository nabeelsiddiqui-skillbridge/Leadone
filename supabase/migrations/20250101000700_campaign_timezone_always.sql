-- Adds an "always" timezone_mode so a campaign can start dialing immediately
-- rather than waiting for a calling-hours window: services/campaign-worker's
-- scanner only gates dialing for 'fixed' (campaign-wide window check) and
-- 'contact_local' (per-contact window check) - 'always' matches neither, so
-- no calling-hours code change is needed, just widening the allowed values.

alter table public.campaigns
  drop constraint campaigns_timezone_mode_check;

alter table public.campaigns
  add constraint campaigns_timezone_mode_check
  check (timezone_mode in ('contact_local', 'fixed', 'always'));
