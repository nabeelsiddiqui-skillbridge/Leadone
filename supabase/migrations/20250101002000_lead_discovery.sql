-- ============================================================================
-- AI Lead Discovery Agent: a workspace defines a target-customer profile
-- (ICP), runs discovery jobs against pluggable source connectors (starting
-- with a customer-provided company list; API-backed sources are stubbed
-- until a super admin configures their credentials), Claude qualifies each
-- discovered company against evidence only, and an approved lead converts
-- into a real `contacts` row and gets added to an existing calling
-- campaign + agent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Target-customer profiles ("who are we looking for")
-- ---------------------------------------------------------------------------

create table public.discovery_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  product_description text not null,
  icp_description text,
  target_industries text[] not null default '{}',
  target_locations text[] not null default '{}',
  company_size_min int,
  company_size_max int,
  keywords text[] not null default '{}',
  exclusions text[] not null default '{}',
  -- 'call' is the only channel this profile can actually hand off to today
  -- (LeadOne campaigns are calling-only) - 'email'/'both' are still
  -- capturable as an intent for when email outreach ships, but the convert
  -- action only offers calling campaigns regardless of this value.
  preferred_channel text not null default 'call' check (preferred_channel in ('call', 'email', 'both')),
  signals_to_monitor text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'paused')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index discovery_profiles_workspace_idx on public.discovery_profiles (workspace_id);

-- ---------------------------------------------------------------------------
-- Source connector catalog - a global (not per-workspace) reference table.
-- Seeded below. status is maintained by super admin as credentials are (or
-- aren't) configured; the UI must only ever treat 'connected' sources as
-- live, everything else renders as "needs API key" / "coming soon".
-- ---------------------------------------------------------------------------

create table public.discovery_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  category text not null check (category in ('customer_provided', 'business_directory', 'contact_enrichment', 'hiring_signal', 'news_signal')),
  status text not null default 'needs_api_key' check (status in ('connected', 'needs_api_key', 'coming_soon', 'disabled')),
  -- Matches a CredentialProvider key in src/lib/credentials.ts, so admin can
  -- check "is this actually configured" the same way every other
  -- integration in the app already does. Null for sources needing none
  -- (customer_csv).
  credential_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.discovery_sources (key, name, description, category, status, credential_provider) values
  ('customer_csv', 'Your own company list', 'Upload a CSV of companies/contacts you already have permission to reach out to. Always available - no API key required.', 'customer_provided', 'connected', null),
  ('google_places', 'Google Places', 'Finds local businesses by industry, location, and keywords via the Google Places API.', 'business_directory', 'needs_api_key', 'google_places'),
  ('hunter_io', 'Hunter.io', 'Finds and verifies professional email addresses for a company domain.', 'contact_enrichment', 'needs_api_key', 'hunter_io'),
  ('job_postings', 'Job posting signals', 'Detects hiring activity (open roles matching your keywords) as a buying signal.', 'hiring_signal', 'needs_api_key', 'job_postings'),
  ('news_funding', 'News & funding signals', 'Detects funding announcements, launches, and relevant public news for a company.', 'news_signal', 'needs_api_key', 'news_funding');

-- ---------------------------------------------------------------------------
-- Discovery job runs
-- ---------------------------------------------------------------------------

create table public.discovery_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  discovery_profile_id uuid not null references public.discovery_profiles (id) on delete cascade,
  source_key text not null references public.discovery_sources (key),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  trigger text not null default 'manual' check (trigger in ('manual', 'scheduled')),
  companies_found int not null default 0,
  leads_created int not null default 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index discovery_jobs_workspace_idx on public.discovery_jobs (workspace_id, created_at desc);
create index discovery_jobs_profile_idx on public.discovery_jobs (discovery_profile_id);

-- ---------------------------------------------------------------------------
-- Discovered companies (deduplicated per workspace via dedup_key, which is
-- the normalized domain when known, else a slugified name)
-- ---------------------------------------------------------------------------

create table public.discovered_companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  discovery_profile_id uuid not null references public.discovery_profiles (id) on delete cascade,
  name text not null,
  website text,
  domain text,
  industry text,
  location text,
  company_size text,
  dedup_key text not null,
  source_key text not null references public.discovery_sources (key),
  source_url text,
  first_observed_at timestamptz not null default now(),
  raw_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (workspace_id, dedup_key)
);

create index discovered_companies_workspace_idx on public.discovered_companies (workspace_id);
create index discovered_companies_profile_idx on public.discovered_companies (discovery_profile_id);

-- ---------------------------------------------------------------------------
-- Evidence: signals observed for a company (why it's a candidate)
-- ---------------------------------------------------------------------------

create table public.discovered_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.discovered_companies (id) on delete cascade,
  signal_type text not null check (signal_type in ('new_location', 'hiring', 'funding', 'product_launch', 'public_post', 'website_issue', 'customer_provided', 'other')),
  description text not null,
  evidence_url text,
  source_key text not null references public.discovery_sources (key),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index discovered_signals_company_idx on public.discovered_signals (company_id);

-- ---------------------------------------------------------------------------
-- Contacts found at a discovered company. Every field but name is nullable
-- on purpose - a connector that doesn't know an email/phone must leave it
-- null, never fabricate one.
-- ---------------------------------------------------------------------------

create table public.discovered_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.discovered_companies (id) on delete cascade,
  name text,
  title text,
  email text,
  phone text,
  source_url text,
  verified boolean not null default false,
  raw_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index discovered_contacts_company_idx on public.discovered_contacts (company_id);

-- ---------------------------------------------------------------------------
-- Discovered leads: the reviewable unit shown on the Discover dashboard.
-- One row per (company, profile). Qualification fields are null until
-- Claude has actually scored it; qualification_status distinguishes
-- "not yet run" / "scored" / "Claude unavailable" so the UI never shows a
-- fabricated score.
-- ---------------------------------------------------------------------------

create table public.discovered_leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  discovery_profile_id uuid not null references public.discovery_profiles (id) on delete cascade,
  company_id uuid not null references public.discovered_companies (id) on delete cascade,
  primary_contact_id uuid references public.discovered_contacts (id) on delete set null,
  job_id uuid references public.discovery_jobs (id) on delete set null,
  fit_score int check (fit_score >= 0 and fit_score <= 100),
  confidence_level text check (confidence_level in ('low', 'medium', 'high')),
  detected_signal_summary text,
  reason text,
  suggested_outreach_angle text,
  qualification_status text not null default 'pending' check (qualification_status in ('pending', 'qualified', 'unavailable', 'error')),
  qualification_model text,
  qualified_at timestamptz,
  status text not null default 'new' check (status in ('new', 'approved', 'rejected', 'converted')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text,
  converted_contact_id uuid references public.contacts (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  agent_id uuid references public.agents (id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, company_id, discovery_profile_id)
);

create index discovered_leads_workspace_idx on public.discovered_leads (workspace_id, created_at desc);
create index discovered_leads_status_idx on public.discovered_leads (workspace_id, status);

create trigger set_updated_at before update on public.discovery_profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.discovered_leads for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.discovery_sources for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.discovery_profiles enable row level security;
alter table public.discovery_jobs enable row level security;
alter table public.discovered_companies enable row level security;
alter table public.discovered_signals enable row level security;
alter table public.discovered_contacts enable row level security;
alter table public.discovered_leads enable row level security;
alter table public.discovery_sources enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['discovery_profiles', 'discovery_jobs', 'discovered_companies', 'discovered_signals', 'discovered_contacts', 'discovered_leads']
  loop
    execute format('create policy "%1$s_select_member" on public.%1$s for select using (public.is_workspace_member(workspace_id));', t);
    execute format('create policy "%1$s_insert_member" on public.%1$s for insert with check (public.is_workspace_member(workspace_id));', t);
    execute format('create policy "%1$s_update_member" on public.%1$s for update using (public.is_workspace_member(workspace_id));', t);
    execute format('create policy "%1$s_delete_admin" on public.%1$s for delete using (public.is_workspace_admin(workspace_id));', t);
  end loop;
end;
$$;

-- discovery_sources is a global catalog, not workspace-scoped: any signed-in
-- workspace member can read it (to see what's connected), only super admins
-- (via is_super_admin(), which is_workspace_admin/is_workspace_member also
-- fold in, but this table has no workspace_id to check against) can write.
create policy "discovery_sources_select_authenticated" on public.discovery_sources for select using (auth.uid() is not null);
create policy "discovery_sources_write_super_admin" on public.discovery_sources for all using (public.is_super_admin()) with check (public.is_super_admin());
