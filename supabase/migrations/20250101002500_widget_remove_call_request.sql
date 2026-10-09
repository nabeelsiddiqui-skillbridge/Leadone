-- ============================================================================
-- Drops the "visitor leaves a phone number, we call them" feature from the
-- widget: it's replaced entirely by live in-browser voice chat
-- (voice_chat_enabled, added in the previous migration). The widget's two
-- capabilities are now independent toggles - chat_enabled and
-- voice_chat_enabled - instead of the old three-way chat/call/both `mode`.
-- `mode` itself is left in place rather than dropped (nothing reads it
-- anymore; dropping it is a follow-up, not something to do live without a
-- reason to).
-- ============================================================================

alter table public.chat_widgets
  add column chat_enabled boolean not null default true;

update public.chat_widgets set chat_enabled = (mode in ('chat', 'both'));
