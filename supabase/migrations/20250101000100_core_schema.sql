-- ============================================================================
-- LeadOne core schema: identity, workspaces, agents, campaigns, contacts,
-- calls, knowledge base, appointments, integrations, platform admin tables.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create type public.platform_role as enum ('user', 'super_admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  platform_role public.platform_role not null default 'user',
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth.users row. platform_role=super_admin grants access to /super-admin.';

-- ---------------------------------------------------------------------------
-- Workspaces (tenants)
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  plan text not null default 'trial',
  limits jsonb not null default '{
    "agents": 5,
    "campaigns": 10,
    "contacts": 5000,
    "concurrent_calls": 3,
    "monthly_minutes": 1000
  }'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.workspace_role as enum ('owner', 'admin', 'member');

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'member',
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- ---------------------------------------------------------------------------
-- Phone numbers
-- ---------------------------------------------------------------------------

create table public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  phone_number text not null,
  friendly_name text,
  twilio_sid text,
  country text,
  capabilities jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'inactive', 'error')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, phone_number)
);

-- ---------------------------------------------------------------------------
-- Knowledge base
-- ---------------------------------------------------------------------------

create table public.knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid not null references public.knowledge_bases (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  source_type text not null check (source_type in ('text', 'file', 'url')),
  source_url text,
  storage_path text,
  mime_type text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  knowledge_base_id uuid not null references public.knowledge_bases (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chunk_index integer not null default 0,
  content text not null,
  token_count integer,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index knowledge_chunks_kb_idx on public.knowledge_chunks (knowledge_base_id);

-- ---------------------------------------------------------------------------
-- Agents
-- ---------------------------------------------------------------------------

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  company_name text,
  agent_role text,
  persona text,
  primary_objective text,
  opening_greeting text,
  system_prompt text,
  conversation_instructions text,
  qualification_questions jsonb not null default '[]'::jsonb,
  objection_handling text,
  closing_instructions text,
  voicemail_message text,
  language text not null default 'en-US',
  accent text,
  voice text not null default 'alloy',
  response_length text not null default 'concise' check (response_length in ('concise', 'balanced', 'detailed')),
  creativity numeric(3, 2) not null default 0.30,
  interruptions_enabled boolean not null default true,
  appointment_booking_enabled boolean not null default false,
  call_transfer_enabled boolean not null default false,
  transfer_phone_number text,
  max_call_duration_seconds integer not null default 900,
  silence_timeout_seconds integer not null default 10,
  end_call_rules text,
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agents_workspace_idx on public.agents (workspace_id);

create table public.agent_knowledge_bases (
  agent_id uuid not null references public.agents (id) on delete cascade,
  knowledge_base_id uuid not null references public.knowledge_bases (id) on delete cascade,
  primary key (agent_id, knowledge_base_id)
);

create table public.agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  snapshot jsonb not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  first_name text,
  last_name text,
  company text,
  phone text not null,
  email text,
  website text,
  job_title text,
  timezone text,
  country text,
  industry text,
  custom_fields jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in (
    'new', 'queued', 'calling', 'connected', 'qualified', 'appointment_booked',
    'follow_up', 'not_interested', 'no_answer', 'busy', 'voicemail',
    'wrong_number', 'do_not_call', 'failed'
  )),
  lead_score integer not null default 0,
  owner_id uuid references public.profiles (id),
  last_called_at timestamptz,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_workspace_idx on public.contacts (workspace_id);
create index contacts_phone_idx on public.contacts (workspace_id, phone);

create table public.contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_id uuid references public.profiles (id),
  note text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Do Not Call
-- ---------------------------------------------------------------------------

create table public.do_not_call (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  phone text not null,
  reason text,
  source_call_id uuid,
  created_at timestamptz not null default now(),
  unique (workspace_id, phone)
);

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete restrict,
  phone_number_id uuid references public.phone_numbers (id) on delete set null,
  name text not null,
  description text,
  status text not null default 'draft' check (status in (
    'draft', 'scheduled', 'running', 'paused', 'completed', 'stopped', 'error'
  )),
  timezone_mode text not null default 'contact_local' check (timezone_mode in ('contact_local', 'fixed')),
  fixed_timezone text,
  days_of_week int[] not null default '{1,2,3,4,5}',
  calling_start_time time not null default '09:00',
  calling_end_time time not null default '17:00',
  start_date date,
  end_date date,
  daily_call_limit integer not null default 200,
  concurrency_limit integer not null default 3,
  max_attempts integer not null default 3,
  retry_no_answer_minutes integer not null default 1440,
  retry_busy_minutes integer not null default 120,
  retry_failed_minutes integer not null default 1440,
  retry_excluded_statuses text[] not null default '{do_not_call,wrong_number}',
  voicemail_action text not null default 'hang_up' check (voicemail_action in ('hang_up', 'leave_message')),
  created_by uuid references public.profiles (id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaigns_workspace_idx on public.campaigns (workspace_id);
create index campaigns_status_idx on public.campaigns (status);

create table public.campaign_schedules (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null
);

create table public.campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending', 'queued', 'in_progress', 'completed', 'skipped', 'do_not_call'
  )),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  added_at timestamptz not null default now(),
  unique (campaign_id, contact_id)
);

create index campaign_contacts_dialable_idx
  on public.campaign_contacts (campaign_id, status, next_attempt_at);

create table public.campaign_attempts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  call_id uuid,
  attempt_number integer not null,
  outcome text,
  attempted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Calendar connections & appointments
-- ---------------------------------------------------------------------------

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null default 'google' check (provider in ('google', 'outlook', 'calendly')),
  email text,
  calendar_id text,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_iv text,
  expires_at timestamptz,
  status text not null default 'connected' check (status in ('connected', 'expired', 'error', 'disconnected')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  agent_id uuid references public.agents (id) on delete set null,
  call_id uuid,
  calendar_connection_id uuid references public.calendar_connections (id) on delete set null,
  title text not null default 'Appointment',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'scheduled' check (status in (
    'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled'
  )),
  external_event_id text,
  created_from_call boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_workspace_idx on public.appointments (workspace_id);

create table public.callbacks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  agent_id uuid references public.agents (id) on delete set null,
  requested_for timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'missed')),
  created_from_call_id uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Calls, transcripts, recordings, events, tool calls
-- ---------------------------------------------------------------------------

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  agent_id uuid references public.agents (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  phone_number_id uuid references public.phone_numbers (id) on delete set null,
  twilio_call_sid text unique,
  twilio_stream_sid text,
  openai_session_id text,
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  status text not null default 'queued' check (status in (
    'queued', 'initiated', 'ringing', 'in_progress', 'completed', 'busy',
    'no_answer', 'failed', 'canceled', 'voicemail'
  )),
  outcome text,
  duration_seconds integer,
  recording_url text,
  recording_sid text,
  summary text,
  qualification jsonb,
  sentiment text,
  interest_level text,
  appointment_id uuid references public.appointments (id) on delete set null,
  cost_cents integer,
  error_message text,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.appointments
  add constraint appointments_call_id_fkey foreign key (call_id) references public.calls (id) on delete set null;
alter table public.callbacks
  add constraint callbacks_call_id_fkey foreign key (created_from_call_id) references public.calls (id) on delete set null;
alter table public.campaign_attempts
  add constraint campaign_attempts_call_id_fkey foreign key (call_id) references public.calls (id) on delete set null;
alter table public.do_not_call
  add constraint do_not_call_call_id_fkey foreign key (source_call_id) references public.calls (id) on delete set null;

create index calls_workspace_idx on public.calls (workspace_id, created_at desc);
create index calls_campaign_idx on public.calls (campaign_id);
create index calls_contact_idx on public.calls (contact_id);

create table public.call_turns (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  turn_number integer not null,
  speaker text not null check (speaker in ('caller', 'agent')),
  caller_speech_started_at timestamptz,
  caller_speech_ended_at timestamptz,
  turn_detection_latency_ms integer,
  model_latency_ms integer,
  first_audio_latency_ms integer,
  tool_latency_ms integer,
  total_turn_latency_ms integer,
  created_at timestamptz not null default now()
);

create table public.call_transcripts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  turn_number integer not null,
  speaker text not null check (speaker in ('caller', 'agent', 'system')),
  message text not null,
  spoken_at timestamptz not null default now()
);

create index call_transcripts_call_idx on public.call_transcripts (call_id, turn_number);

create table public.call_recordings (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  twilio_recording_sid text,
  storage_path text,
  url text,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create table public.call_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.call_tool_calls (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null default 'pending' check (status in ('pending', 'success', 'error')),
  latency_ms integer,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Integrations & credentials
-- ---------------------------------------------------------------------------

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  type text not null check (type in (
    'twilio', 'openai', 'google_calendar', 'smtp', 'webhook', 'crm'
  )),
  status text not null default 'not_connected' check (status in ('connected', 'not_connected', 'error')),
  config jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- scope = 'platform' rows have workspace_id null and are only readable by super admins;
-- scope = 'workspace' rows are resolved before falling back to the platform default.
create table public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('platform', 'workspace')),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('openai', 'twilio', 'google', 'smtp', 'webhook')),
  key_name text not null,
  ciphertext text not null,
  iv text not null,
  last4 text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'platform' and workspace_id is null) or (scope = 'workspace' and workspace_id is not null)),
  unique (scope, workspace_id, provider, key_name)
);

create table public.webhooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  url text not null,
  secret_ciphertext text,
  secret_iv text,
  events text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Usage & cost tracking
-- ---------------------------------------------------------------------------

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period_date date not null,
  calls_count integer not null default 0,
  connected_calls_count integer not null default 0,
  call_seconds integer not null default 0,
  ai_audio_input_seconds integer not null default 0,
  ai_audio_output_seconds integer not null default 0,
  openai_tokens bigint not null default 0,
  twilio_minutes numeric(10, 2) not null default 0,
  recordings_count integer not null default 0,
  storage_bytes bigint not null default 0,
  tool_calls_count integer not null default 0,
  appointments_count integer not null default 0,
  estimated_cost_cents integer not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, period_date)
);

create table public.pricing_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  unit text not null,
  unit_cost_micros bigint not null,
  updated_at timestamptz not null default now(),
  unique (provider, unit)
);

-- ---------------------------------------------------------------------------
-- Platform administration
-- ---------------------------------------------------------------------------

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  enabled boolean not null default true,
  description text,
  updated_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id),
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id),
  target_user_id uuid not null references public.profiles (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
