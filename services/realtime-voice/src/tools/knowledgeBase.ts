import { z } from "zod";
import OpenAI from "openai";

import { db } from "../db.js";
import { config } from "../config.js";
import type { ToolExecutionContext, ToolResult } from "../types.js";

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const searchSchema = z.object({ query: z.string().min(1).max(500) });

/**
 * Real pgvector similarity search (see supabase/migrations/20250101000500_knowledge_search.sql).
 * Returns an empty result set until the Phase 3 ingestion pipeline actually
 * populates knowledge_chunks for this agent's knowledge bases — that's a
 * data-availability gap, not a stub: the retrieval path itself is live.
 */
export async function searchKnowledgeBase(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  const parsed = searchSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  const { data: links } = await db
    .from("agent_knowledge_bases")
    .select("knowledge_base_id")
    .eq("agent_id", ctx.agent.id);

  const knowledgeBaseIds = (links ?? []).map((l) => l.knowledge_base_id as string);
  if (knowledgeBaseIds.length === 0) {
    return { status: "success", message: "No knowledge base is attached to this agent.", data: { results: [] } };
  }

  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: parsed.data.query,
  });
  const embedding = embeddingResponse.data[0]?.embedding;
  if (!embedding) return { status: "error", message: "Failed to embed the query." };

  const { data: matches, error } = await db.rpc("match_knowledge_chunks", {
    p_knowledge_base_ids: knowledgeBaseIds,
    p_query_embedding: embedding as unknown as string,
    p_match_count: 5,
  });

  if (error) return { status: "error", message: error.message };

  const results = (matches ?? []) as Array<{ content: string; similarity: number }>;
  return {
    status: "success",
    message: results.length > 0 ? `Found ${results.length} relevant passage(s).` : "No relevant knowledge base content found.",
    data: { results: results.map((r) => ({ content: r.content, relevance: r.similarity })) },
  };
}
