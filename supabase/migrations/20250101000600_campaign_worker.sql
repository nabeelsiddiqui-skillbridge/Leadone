-- ============================================================================
-- Support for the campaign automation worker (services/campaign-worker):
-- atomic, race-safe claiming of the next dialable lead/callback so two
-- worker instances (or two ticks of the same one) never place duplicate
-- simultaneous calls to the same contact, plus cascading a Do Not Call
-- addition into any campaign queues the contact is already sitting in.
-- ============================================================================

alter table public.callbacks
  add column locked_at timestamptz,
  add column locked_by text;

-- Claims the single next dialable campaign_contacts row for a campaign,
-- atomically, using SKIP LOCKED so concurrent worker ticks never grab the
-- same row twice. Returns zero rows if nothing is eligible right now.
create or replace function public.claim_next_campaign_contact(
  p_campaign_id uuid,
  p_worker_id text
)
returns setof public.campaign_contacts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select cc.id into v_id
  from public.campaign_contacts cc
  where cc.campaign_id = p_campaign_id
    and cc.status in ('pending', 'queued')
    and (cc.next_attempt_at is null or cc.next_attempt_at <= now())
    and (cc.locked_at is null or cc.locked_at < now() - interval '5 minutes')
  order by cc.added_at asc
  limit 1
  for update skip locked;

  if v_id is null then
    return;
  end if;

  return query
    update public.campaign_contacts
    set locked_at = now(), locked_by = p_worker_id, status = 'in_progress'
    where id = v_id
    returning *;
end;
$$;

-- Same idea for scheduled callbacks: claims one due, unlocked callback.
create or replace function public.claim_due_callback(
  p_worker_id text
)
returns setof public.callbacks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select cb.id into v_id
  from public.callbacks cb
  where cb.status = 'scheduled'
    and cb.requested_for <= now()
    and (cb.locked_at is null or cb.locked_at < now() - interval '5 minutes')
  order by cb.requested_for asc
  limit 1
  for update skip locked;

  if v_id is null then
    return;
  end if;

  return query
    update public.callbacks
    set locked_at = now(), locked_by = p_worker_id
    where id = v_id
    returning *;
end;
$$;

-- Extend the existing Do Not Call trigger so it also pulls the contact out
-- of any campaign queue it's currently sitting in, not just contacts.status
-- (see 20250101000200_functions_triggers.sql for the original version).
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

  update public.campaign_contacts cc
  set status = 'do_not_call', locked_at = null, locked_by = null
  from public.contacts c
  where c.workspace_id = new.workspace_id
    and c.phone = new.phone
    and cc.contact_id = c.id
    and cc.status in ('pending', 'queued', 'in_progress');

  return new;
end;
$$;
