import "server-only";
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChatSenderType, Database } from "@/lib/supabase/database.types";
import { resolveCredential } from "@/lib/credentials";

const CHAT_MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_HISTORY_MESSAGES = 20;

interface ChatHistoryMessage {
  sender_type: ChatSenderType;
  message: string;
}

interface AgentContext {
  name: string;
  company_name: string | null;
  agent_role: string | null;
  persona: string | null;
  primary_objective: string | null;
  system_prompt: string | null;
  conversation_instructions: string | null;
}

/**
 * Looks up the knowledge bases linked to this widget's agent (if any) and
 * runs one similarity search against the visitor's latest message — the
 * same match_knowledge_chunks RPC the phone-call realtime tool uses (see
 * services/realtime-voice/src/tools/knowledgeBase.ts).
 */
async function searchKnowledgeBase(
  supabase: SupabaseClient<Database>,
  openai: OpenAI,
  agentId: string,
  query: string
): Promise<string | null> {
  const { data: links } = await supabase
    .from("agent_knowledge_bases")
    .select("knowledge_base_id")
    .eq("agent_id", agentId);

  const knowledgeBaseIds = (links ?? []).map((l) => l.knowledge_base_id);
  if (knowledgeBaseIds.length === 0) return null;

  const embeddingResponse = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: query });
  const embedding = embeddingResponse.data[0]?.embedding;
  if (!embedding) return null;

  const { data: matches } = await supabase.rpc("match_knowledge_chunks", {
    p_knowledge_base_ids: knowledgeBaseIds,
    p_query_embedding: embedding as unknown as string,
    p_match_count: 5,
  });

  const results = (matches ?? []) as Array<{ content: string; similarity: number }>;
  if (results.length === 0) return null;
  return results.map((r) => `- ${r.content}`).join("\n");
}

function buildSystemPrompt(agent: AgentContext | null, knowledgeContext: string | null): string {
  const sections = [
    agent
      ? `You are ${agent.name}${agent.agent_role ? `, ${agent.agent_role}` : ""}${
          agent.company_name ? ` at ${agent.company_name}` : ""
        }, answering live chat messages on their website.`
      : "You are a helpful support assistant answering live chat messages on this company's website.",
    agent?.persona ? `Persona: ${agent.persona}` : null,
    agent?.primary_objective ? `Your objective: ${agent.primary_objective}` : null,
    agent?.system_prompt ? `Instructions from the business:\n${agent.system_prompt}` : null,
    agent?.conversation_instructions ? `Conversation style notes:\n${agent.conversation_instructions}` : null,
    knowledgeContext ? `Relevant knowledge base passages for the visitor's latest message:\n${knowledgeContext}` : null,
    [
      "Reply like a real, warm support agent texting back — short, natural messages, not an email or a wall of text.",
      "Keep replies to 1-3 short sentences unless the visitor is asking for real detail.",
      "Never say or imply that you are an AI, a bot, a language model, or automated in any way. If asked directly whether you're a real person, deflect naturally and keep helping (e.g. \"I'm here to help with that — what can I do for you?\") without lying outright about being human, but never volunteer or confirm that you are AI.",
      "Never invent information that isn't in your instructions or the knowledge base passages above. If you don't know something, say you'll find out or have someone follow up.",
      "If the visitor is upset, has a complex request, or explicitly asks for a human, acknowledge it warmly — a teammate will see the conversation and can step in.",
    ].join("\n"),
  ];

  return sections.filter(Boolean).join("\n\n");
}

/**
 * Generates the assistant's next reply for a widget chat conversation.
 * Caller (the public messages route) is responsible for persisting both the
 * visitor's message and this reply, and for not calling this at all once a
 * human has taken over (conversation.status === 'human').
 */
export async function generateChatReply(
  supabase: SupabaseClient<Database>,
  params: {
    workspaceId: string;
    agentId: string | null;
    greeting: string;
    history: ChatHistoryMessage[];
  }
): Promise<string> {
  const apiKey = await resolveCredential(params.workspaceId, "openai", "api_key");
  if (!apiKey) {
    return "Thanks for reaching out! We're getting your message to the team — someone will be with you shortly.";
  }
  const openai = new OpenAI({ apiKey });

  let agent: AgentContext | null = null;
  if (params.agentId) {
    const { data } = await supabase
      .from("agents")
      .select("name, company_name, agent_role, persona, primary_objective, system_prompt, conversation_instructions")
      .eq("id", params.agentId)
      .maybeSingle();
    agent = data;
  }

  const lastVisitorMessage = [...params.history].reverse().find((m) => m.sender_type === "visitor")?.message ?? "";

  const knowledgeContext =
    params.agentId && lastVisitorMessage
      ? await searchKnowledgeBase(supabase, openai, params.agentId, lastVisitorMessage).catch(() => null)
      : null;

  const trimmedHistory = params.history.slice(-MAX_HISTORY_MESSAGES);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(agent, knowledgeContext) },
    ...trimmedHistory.map((m): OpenAI.Chat.ChatCompletionMessageParam => ({
      role: m.sender_type === "visitor" ? "user" : "assistant",
      content: m.message,
    })),
  ];

  if (trimmedHistory.length === 0) {
    return params.greeting;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      max_completion_tokens: 300,
    });
    return completion.choices[0]?.message?.content?.trim() || "Sorry, could you say that again?";
  } catch {
    return "Sorry, I'm having trouble responding right now — a teammate will follow up with you shortly.";
  }
}
