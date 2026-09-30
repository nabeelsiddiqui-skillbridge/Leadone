-- Lead Discovery needs new credential providers: 'anthropic' (Claude
-- qualification), and one per API-backed discovery source
-- (google_places/hunter_io/job_postings/news_funding) so super admin can
-- store/validate each source's key the same way every other integration
-- already works. integration_credentials.provider has a check constraint
-- limiting it to the providers that existed before this feature.
alter table public.integration_credentials drop constraint integration_credentials_provider_check;
alter table public.integration_credentials add constraint integration_credentials_provider_check
  check (provider in ('openai', 'twilio', 'google', 'smtp', 'webhook', 'anthropic', 'google_places', 'hunter_io', 'job_postings', 'news_funding'));
