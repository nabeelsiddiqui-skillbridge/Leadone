-- ---------------------------------------------------------------------------
-- Inbound calling: agents can be marked outbound-only, inbound-only, or
-- both, and a phone number can have an agent assigned to answer calls that
-- come in on it (separate from the per-campaign outbound caller-ID use of
-- phone_numbers that already existed).
-- ---------------------------------------------------------------------------

alter table public.agents
  add column call_direction text not null default 'outbound'
    check (call_direction in ('outbound', 'inbound', 'both'));

alter table public.phone_numbers
  add column agent_id uuid references public.agents (id) on delete set null;

-- Inbound calls arrive knowing only the dialed number (Twilio's "To"), so the
-- lookup has to search phone_number across the whole table before it even
-- knows which workspace is involved - the existing unique index is
-- (workspace_id, phone_number), which can't serve that query efficiently.
create index phone_numbers_phone_number_idx on public.phone_numbers (phone_number);
