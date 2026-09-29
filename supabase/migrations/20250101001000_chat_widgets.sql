-- ============================================================================
-- Embeddable website/app chat + call widget: a workspace configures a widget
-- (color, size, chat/call/both, which agent powers it), gets an embed
-- snippet, and visitor conversations land in a live-chat inbox where a human
-- can take over from the AI seamlessly (the visitor never sees which one
-- they're talking to).
-- ============================================================================

create table public.chat_widgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  name text not null,
  public_key text not null unique default encode(gen_random_bytes(16), 'hex'),
  mode text not null default 'chat' check (mode in ('chat', 'call', 'both')),
  primary_color text not null default '#1B4D3E',
  size text not null default 'standard' check (size in ('compact', 'standard', 'large')),
  greeting_message text not null default 'Hi! How can we help you today?',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_widgets_workspace_idx on public.chat_widgets (workspace_id);

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  widget_id uuid not null references public.chat_widgets (id) on delete cascade,
  visitor_id text not null,
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  contact_id uuid references public.contacts (id) on delete set null,
  page_url text,
  status text not null default 'ai' check (status in ('ai', 'human', 'closed')),
  assigned_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index chat_conversations_workspace_idx on public.chat_conversations (workspace_id, last_message_at desc);
create index chat_conversations_widget_visitor_idx on public.chat_conversations (widget_id, visitor_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sender_type text not null check (sender_type in ('visitor', 'assistant', 'human')),
  sender_user_id uuid references public.profiles (id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at asc);
create index chat_messages_workspace_idx on public.chat_messages (workspace_id);

create trigger set_updated_at before update on public.chat_widgets for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.chat_widgets enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

-- Dashboard access only (workspace members, incl. the super_admin bypass
-- already built into is_workspace_member/is_workspace_admin). The public
-- widget and its API routes have no Supabase session at all - those go
-- through the service-role client with explicit workspace/widget checks in
-- the route handlers, the same pattern the campaign worker's calls API
-- already uses for its own unauthenticated caller.
do $$
declare
  t text;
begin
  foreach t in array array['chat_widgets', 'chat_conversations', 'chat_messages']
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
