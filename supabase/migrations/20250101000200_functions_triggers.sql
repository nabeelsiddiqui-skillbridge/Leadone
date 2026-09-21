-- ============================================================================
-- Helper functions, triggers: workspace bootstrap on signup, updated_at,
-- auth helpers used throughout RLS policies.
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'workspaces', 'phone_numbers', 'knowledge_bases',
    'knowledge_documents', 'agents', 'contacts', 'campaigns',
    'calendar_connections', 'appointments', 'integrations',
    'integration_credentials'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- auth.uid() helpers used across RLS policies
-- ---------------------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and platform_role = 'super_admin'
  );
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid()
  ) or public.is_super_admin();
$$;

create or replace function public.workspace_role(target_workspace_id uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.workspace_members
  where workspace_id = target_workspace_id and user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_role(target_workspace_id) in ('owner', 'admin')
    or public.is_super_admin();
$$;

-- ---------------------------------------------------------------------------
-- New-user bootstrap: create a profile row, then (unless invited into an
-- existing workspace via metadata) a personal workspace they own.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  workspace_name text;
  workspace_slug text;
begin
  insert into public.profiles (id, full_name, platform_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data ->> 'invite_super_admin' = 'true' then 'super_admin'::public.platform_role
      else 'user'::public.platform_role
    end
  );

  if new.raw_user_meta_data ->> 'workspace_id' is not null then
    -- Joining an existing workspace via invite; membership row created separately
    -- by the invite-accept flow, not here.
    return new;
  end if;

  workspace_name := coalesce(new.raw_user_meta_data ->> 'company_name', split_part(new.email, '@', 1) || '''s Workspace');
  workspace_slug := lower(regexp_replace(workspace_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 8);

  insert into public.workspaces (name, slug, owner_id)
  values (workspace_name, workspace_slug, new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, joined_at)
  values (new_workspace_id, new.id, 'owner', now());

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Contact status auto-updates when marked Do Not Call
-- ---------------------------------------------------------------------------

create or replace function public.apply_do_not_call()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contacts
  set status = 'do_not_call', updated_at = now()
  where workspace_id = new.workspace_id and phone = new.phone;
  return new;
end;
$$;

create trigger do_not_call_apply
  after insert on public.do_not_call
  for each row execute function public.apply_do_not_call();
