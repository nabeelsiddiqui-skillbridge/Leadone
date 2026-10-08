-- ---------------------------------------------------------------------------
-- Several SECURITY DEFINER functions were reachable by anon/authenticated via
-- PostgREST's /rest/v1/rpc/<name> even though nothing in the app calls them
-- that way:
--
--   - claim_due_callback / claim_next_campaign_contact: no workspace check in
--     the function body (SECURITY DEFINER bypasses RLS entirely), so any
--     unauthenticated caller could claim/lock another workspace's callback or
--     campaign_contacts row and read back its contents. Only caller is the
--     campaign worker, which uses the service-role key.
--   - match_knowledge_chunks: same issue - returns chunk content for whatever
--     knowledge_base_ids the caller passes, no ownership check. Only callers
--     (the chat widget route, the realtime voice server) already use the
--     service-role key and validate ownership themselves before calling it.
--
-- Every function also grants EXECUTE to PUBLIC by default, and anon/
-- authenticated inherit that as members of PUBLIC - so revoking from just
-- those two roles has no real effect. Revoke from PUBLIC, then re-grant only
-- to the roles that should keep it.
-- ---------------------------------------------------------------------------

revoke execute on function public.claim_due_callback(text) from public;
revoke execute on function public.claim_next_campaign_contact(uuid, text) from public;
revoke execute on function public.match_knowledge_chunks(uuid[], vector, integer) from public;
grant execute on function public.claim_due_callback(text) to service_role;
grant execute on function public.claim_next_campaign_contact(uuid, text) to service_role;
grant execute on function public.match_knowledge_chunks(uuid[], vector, integer) to service_role;

-- apply_do_not_call and handle_new_user are `returns trigger` functions only
-- ever invoked by their triggers (Postgres rejects a direct RPC call to a
-- trigger function before the body runs), so this is defense-in-depth, not a
-- real hole - but there's no reason to leave them listed as public RPCs.
revoke execute on function public.apply_do_not_call() from public;
revoke execute on function public.handle_new_user() from public;
grant execute on function public.apply_do_not_call() to service_role;
grant execute on function public.handle_new_user() to service_role;

-- is_workspace_member/is_workspace_admin/workspace_role/is_super_admin are
-- internal RLS-policy helpers. `authenticated` must keep EXECUTE - Postgres
-- checks the querying role's grant on any function referenced inside a
-- policy expression, so revoking it would break RLS for every signed-in
-- user. `anon` gets harmless false/null from all four today (auth.uid() is
-- null), but there's no legitimate reason for anon to call them directly.
revoke execute on function public.is_workspace_member(uuid) from public;
revoke execute on function public.is_workspace_admin(uuid) from public;
revoke execute on function public.workspace_role(uuid) from public;
revoke execute on function public.is_super_admin() from public;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.is_workspace_admin(uuid) to authenticated, service_role;
grant execute on function public.workspace_role(uuid) to authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated, service_role;
