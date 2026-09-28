-- ============================================================================
-- Subscription packages (super_admin managed, one-click assignable to a
-- workspace) and a workspace <-> platform support ticket system.
-- ============================================================================

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  price_cents integer not null default 0,
  max_agents integer not null,
  max_campaigns integer not null,
  max_contacts integer not null,
  concurrent_calls integer not null,
  monthly_minutes integer not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plans (key, name, description, price_cents, max_agents, max_campaigns, max_contacts, concurrent_calls, monthly_minutes, sort_order) values
  ('starter', 'Starter', 'For small teams just getting started with AI calling.', 9900, 5, 10, 5000, 3, 1000, 1),
  ('growth', 'Growth', 'For teams running multiple active campaigns.', 29900, 15, 30, 25000, 10, 5000, 2),
  ('scale', 'Scale', 'For high-volume outbound operations.', 79900, 50, 100, 100000, 25, 20000, 3)
on conflict (key) do nothing;

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_workspace_idx on public.support_tickets (workspace_id, created_at desc);
create index support_tickets_status_idx on public.support_tickets (status);

-- Denormalizes workspace_id (rather than joining through ticket_id) so this
-- table fits the same generic per-workspace RLS policy loop every other
-- child table uses - see 20250101000300_rls.sql and its own precedent
-- (call_transcripts, call_events, etc. do the same for their parent call).
create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  is_from_admin boolean not null default false,
  message text not null,
  created_at timestamptz not null default now()
);

create index support_ticket_messages_ticket_idx on public.support_ticket_messages (ticket_id, created_at asc);
create index support_ticket_messages_workspace_idx on public.support_ticket_messages (workspace_id);

create trigger set_updated_at before update on public.plans for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.support_tickets for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

create policy "plans_select_authenticated" on public.plans
  for select using (auth.role() = 'authenticated');
create policy "plans_write_super_admin" on public.plans
  for insert with check (public.is_super_admin());
create policy "plans_update_super_admin" on public.plans
  for update using (public.is_super_admin());
create policy "plans_delete_super_admin" on public.plans
  for delete using (public.is_super_admin());

do $$
declare
  t text;
begin
  foreach t in array array['support_tickets', 'support_ticket_messages']
  loop
    execute format(
      'create policy "%1$s_select_member" on public.%1$s for select using (public.is_workspace_member(workspace_id));',
      t
    );
    execute format(
      'create policy "%1$s_insert_member" on public.%1$s for insert with check (public.is_workspace_member(workspace_id));',
      t
    );
    execute format(
      'create policy "%1$s_update_member" on public.%1$s for update using (public.is_workspace_member(workspace_id));',
      t
    );
    execute format(
      'create policy "%1$s_delete_admin" on public.%1$s for delete using (public.is_workspace_admin(workspace_id));',
      t
    );
  end loop;
end;
$$;
