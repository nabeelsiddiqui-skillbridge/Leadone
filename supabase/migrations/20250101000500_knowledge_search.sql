-- Cosine-similarity search over knowledge_chunks, scoped to an explicit set
-- of knowledge_base_ids (the caller — the realtime voice server, via the
-- search_knowledge_base tool — already resolved which knowledge bases the
-- agent on this call has attached before calling this function). Runs with
-- the service-role key in practice (RLS bypassed), but is marked security
-- definer with a pinned search_path so it's also safe to expose to a normal
-- authenticated session later (e.g. a "test search" UI in the knowledge
-- base editor) without leaking rows outside the given knowledge base ids.
create or replace function public.match_knowledge_chunks(
  p_knowledge_base_ids uuid[],
  p_query_embedding vector(1536),
  p_match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  knowledge_base_id uuid,
  content text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    kc.id,
    kc.document_id,
    kc.knowledge_base_id,
    kc.content,
    1 - (kc.embedding <=> p_query_embedding) as similarity
  from public.knowledge_chunks kc
  where kc.knowledge_base_id = any(p_knowledge_base_ids)
    and kc.embedding is not null
  order by kc.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
$$;
