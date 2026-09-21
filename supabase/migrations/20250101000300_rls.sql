-- ============================================================================
-- Row Level Security. Every workspace-scoped table is isolated per tenant via
-- public.is_workspace_member()/is_workspace_admin(); super_admin bypasses all
-- (those helpers already OR in public.is_super_admin()). Platform-only tables
-- (system_settings, feature_flags, admin_audit_logs, impersonation_sessions,
-- pricing_settings, platform-scope integration_credentials) are super_admin
-- only. Service-role (used by the realtime voice server and campaign worker,
-- which run outside a user session) bypasses RLS entirely, as is standard for
-- Supabase's service_role key.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.phone_numbers enable row level security;
alter table public.knowledge_bases enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.agents enable row level security;
alter table public.agent_knowledge_bases enable row level security;
alter table public.agent_versions enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
alter table public.do_not_call enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_schedules enable row level security;
alter table public.campaign_contacts enable row level security;
alter table public.campaign_attempts enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.appointments enable row level security;
alter table public.callbacks enable row level security;
alter table public.calls enable row level security;
alter table public.call_turns enable row level security;
alter table public.call_transcripts enable row level security;
alter table public.call_recordings enable row level security;
alter table public.call_events enable row level security;
alter table public.call_tool_calls enable row level security;
alter table public.integrations enable row level security;
alter table public.integration_credentials enable row level security;
alter table public.webhooks enable row level security;
alter table public.usage_records enable row level security;
alter table public.pricing_settings enable row level security;
alter table public.system_settings enable row level security;
alter table public.feature_flags enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.impersonation_sessions enable row level security;
alter table public.notifications enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy "profiles_select_self_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid() or public.is_super_admin())
  with check (
    id = auth.uid() and (platform_role = 'user' or public.is_super_admin())
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- workspaces / workspace_members
-- ---------------------------------------------------------------------------

create policy "workspaces_select_members" on public.workspaces
  for select using (public.is_workspace_member(id));

create policy "workspaces_insert_owner" on public.workspaces
  for insert with check (owner_id = auth.uid() or public.is_super_admin());

create policy "workspaces_update_admin" on public.workspaces
  for update using (public.is_workspace_admin(id));

create policy "workspaces_delete_super_admin" on public.workspaces
  for delete using (public.is_super_admin());

create policy "workspace_members_select" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

create policy "workspace_members_manage" on public.workspace_members
  for all using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------------
-- Generic workspace-scoped policy helper (applied table by table below):
-- select/insert/update = any workspace member, delete = workspace admin.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'phone_numbers', 'knowledge_bases', 'knowledge_documents', 'agents',
    'contacts', 'contact_notes', 'do_not_call', 'campaigns',
    'campaign_contacts', 'campaign_attempts', 'calendar_connections',
    'appointments', 'callbacks', 'calls', 'call_transcripts',
    'call_recordings', 'call_events', 'call_tool_calls', 'integrations',
    'webhooks', 'usage_records', 'notifications'
  ]
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

-- knowledge_chunks: read-only to app clients (writes happen via service role
-- during ingestion); still workspace-scoped for select.
create policy "knowledge_chunks_select_member" on public.knowledge_chunks
  for select using (public.is_workspace_member(workspace_id));

-- agent_versions: workspace-scoped, insert/select only (immutable history).
create policy "agent_versions_select_member" on public.agent_versions
  for select using (public.is_workspace_member(workspace_id));
create policy "agent_versions_insert_member" on public.agent_versions
  for insert with check (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- Tables without a direct workspace_id column: scope via their parent.
-- ---------------------------------------------------------------------------

create policy "agent_knowledge_bases_all_member" on public.agent_knowledge_bases
  for all using (
    exists (
      select 1 from public.agents
      where agents.id = agent_knowledge_bases.agent_id
        and public.is_workspace_member(agents.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_knowledge_bases.agent_id
        and public.is_workspace_member(agents.workspace_id)
    )
  );

create policy "campaign_schedules_all_member" on public.campaign_schedules
  for all using (
    exists (
      select 1 from public.campaigns
      where campaigns.id = campaign_schedules.campaign_id
        and public.is_workspace_member(campaigns.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.campaigns
      where campaigns.id = campaign_schedules.campaign_id
        and public.is_workspace_member(campaigns.workspace_id)
    )
  );

create policy "call_turns_select_member" on public.call_turns
  for select using (
    exists (
      select 1 from public.calls
      where calls.id = call_turns.call_id
        and public.is_workspace_member(calls.workspace_id)
    )
  );

-- ---------------------------------------------------------------------------
-- integration_credentials: workspace-scoped rows visible/manageable by
-- workspace admins only; platform-scope rows (workspace_id is null) are
-- super_admin only. Application code must still avoid ever selecting
-- ciphertext into a client-rendered response.
-- ---------------------------------------------------------------------------

create policy "integration_credentials_workspace_admin" on public.integration_credentials
  for all using (
    scope = 'workspace' and public.is_workspace_admin(workspace_id)
  )
  with check (
    scope = 'workspace' and public.is_workspace_admin(workspace_id)
  );

create policy "integration_credentials_platform_super_admin" on public.integration_credentials
  for all using (scope = 'platform' and public.is_super_admin())
  with check (scope = 'platform' and public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Platform-admin-only tables
-- ---------------------------------------------------------------------------

create policy "pricing_settings_super_admin" on public.pricing_settings
  for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "system_settings_super_admin" on public.system_settings
  for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "feature_flags_select_all_authenticated" on public.feature_flags
  for select using (auth.role() = 'authenticated');
create policy "feature_flags_write_super_admin" on public.feature_flags
  for insert with check (public.is_super_admin());
create policy "feature_flags_update_super_admin" on public.feature_flags
  for update using (public.is_super_admin());
create policy "feature_flags_delete_super_admin" on public.feature_flags
  for delete using (public.is_super_admin());

create policy "admin_audit_logs_super_admin" on public.admin_audit_logs
  for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "impersonation_sessions_super_admin" on public.impersonation_sessions
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- notifications: a user only sees their own, regardless of workspace role.
-- ---------------------------------------------------------------------------

drop policy if exists "notifications_select_member" on public.notifications;
drop policy if exists "notifications_insert_member" on public.notifications;
drop policy if exists "notifications_update_member" on public.notifications;
drop policy if exists "notifications_delete_admin" on public.notifications;

create policy "notifications_select_owner" on public.notifications
  for select using (user_id = auth.uid() or public.is_super_admin());
create policy "notifications_update_owner" on public.notifications
  for update using (user_id = auth.uid() or public.is_super_admin());
create policy "notifications_insert_member" on public.notifications
  for insert with check (public.is_workspace_member(workspace_id));
create policy "notifications_delete_owner" on public.notifications
  for delete using (user_id = auth.uid() or public.is_super_admin());
