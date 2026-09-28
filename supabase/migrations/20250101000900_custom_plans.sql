-- ============================================================================
-- Per-workspace custom packages: super_admin builds a one-off plan for a
-- specific workspace, shares a link to it, the workspace requests it, and
-- super_admin approves to activate it (no payment processor - "buy" means
-- "request", "approved" means "applied to the workspace").
-- ============================================================================

create table public.custom_plans (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null,
  description text,
  price_cents integer not null default 0,
  max_agents integer not null,
  max_campaigns integer not null,
  max_contacts integer not null,
  concurrent_calls integer not null,
  monthly_minutes integer not null,
  status text not null default 'draft' check (status in ('draft', 'requested', 'active', 'rejected')),
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index custom_plans_workspace_idx on public.custom_plans (workspace_id, created_at desc);
create index custom_plans_token_idx on public.custom_plans (token);

create trigger set_updated_at before update on public.custom_plans for each row execute function public.set_updated_at();

alter table public.custom_plans enable row level security;

-- Members (incl. super_admin, via is_workspace_member()'s bypass) can read
-- their workspace's custom plan(s) - needed both for the admin's queue view
-- and for the workspace side to see the personalized package at its link.
-- All writes go through public.is_super_admin() at the RLS layer; the one
-- member-initiated write ("request activation") is a narrow, validated
-- service-role action - see requestCustomPlanAction - rather than a looser
-- RLS policy that would let a member edit their own price/limits.
create policy "custom_plans_select_member" on public.custom_plans
  for select using (public.is_workspace_member(workspace_id));

create policy "custom_plans_insert_super_admin" on public.custom_plans
  for insert with check (public.is_super_admin());

create policy "custom_plans_update_super_admin" on public.custom_plans
  for update using (public.is_super_admin());

create policy "custom_plans_delete_super_admin" on public.custom_plans
  for delete using (public.is_super_admin());
