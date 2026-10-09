import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

// TEMPORARY diagnostic route. Reproduces the exact agents/[id] page data
// flow using the service-role client (no user session needed) so the real
// server-side exception can be captured directly, instead of guessed at.
// Protected by TEMP_DIAG_SECRET. Delete this file and the env var once done.

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
  }
  throw lastError;
}

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack, cause: err.cause ? String(err.cause) : undefined };
  }
  return { raw: String(err) };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.TEMP_DIAG_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("agentId");
  const workspaceId = url.searchParams.get("workspaceId");
  if (!id || !workspaceId) {
    return NextResponse.json({ error: "missing agentId or workspaceId" }, { status: 400 });
  }

  const steps: string[] = [];
  try {
    const supabase = createServiceRoleClient();

    steps.push("workspace_lookup");
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();
    if (wsError || !workspace) {
      return NextResponse.json({ ok: false, step: "workspace_lookup", error: wsError }, { status: 200 });
    }

    steps.push("primary_fetch");
    const [{ data: agent, error: agentError }, { data: linkedKnowledgeBaseLinks }, { data: campaigns }] =
      await withRetry(() =>
        Promise.all([
          supabase.from("agents").select("*").eq("id", id).eq("workspace_id", workspace.id).single(),
          supabase.from("agent_knowledge_bases").select("knowledge_base_id").eq("agent_id", id),
          supabase
            .from("campaigns")
            .select("id, name, status, created_at, contacts:campaign_contacts(count)")
            .eq("workspace_id", workspace.id)
            .eq("agent_id", id)
            .order("created_at", { ascending: false })
            .limit(5),
        ])
      );

    if (agentError || !agent) {
      return NextResponse.json({ ok: false, step: "agent_not_found", agentError }, { status: 200 });
    }

    steps.push("knowledge_bases");
    let agentKnowledgeBases: unknown[] = [];
    try {
      const linkedKnowledgeBaseIds = (linkedKnowledgeBaseLinks ?? [])
        .map((link) => link.knowledge_base_id)
        .filter((kbId): kbId is string => typeof kbId === "string");

      const { data: knowledgeBases } =
        linkedKnowledgeBaseIds.length > 0
          ? await supabase
              .from("knowledge_bases")
              .select(
                "id, name, description, created_at, documents:knowledge_documents(id, name, source_type, source_url, status, error_message, created_at, chunks:knowledge_chunks(count))"
              )
              .in("id", linkedKnowledgeBaseIds)
              .order("created_at", { ascending: true })
          : { data: [] as never[] };

      agentKnowledgeBases = (knowledgeBases ?? []).map((kb) => {
        const documents = (Array.isArray(kb.documents) ? kb.documents : []) as unknown as Array<{
          id: string;
          name: string;
          source_type: string;
          source_url: string | null;
          status: Database["public"]["Tables"]["knowledge_documents"]["Row"]["status"];
          error_message: string | null;
          created_at: string;
          chunks: { count: number }[] | null;
        }>;
        return {
          id: kb.id,
          name: kb.name,
          description: kb.description,
          documents: documents
            .map((doc) => ({
              id: doc.id,
              name: doc.name,
              source_type: doc.source_type,
              source_url: doc.source_url,
              status: doc.status,
              error_message: doc.error_message,
              chunkCount: Array.isArray(doc.chunks) ? (doc.chunks[0]?.count ?? 0) : 0,
              createdAt: doc.created_at,
            }))
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
        };
      });
    } catch (err) {
      return NextResponse.json({ ok: false, step: "knowledge_bases_throw", error: serializeError(err) }, { status: 200 });
    }

    steps.push("counts");
    const [{ count: callsMade }, { count: callsConnected }, { count: appointmentsBooked }] = await withRetry(() =>
      Promise.all([
        supabase.from("calls").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("agent_id", id),
        supabase
          .from("calls")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace.id)
          .eq("agent_id", id)
          .eq("status", "completed"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("agent_id", id),
      ])
    );
    const conversionRate = callsMade && callsMade > 0 ? `${(((appointmentsBooked ?? 0) / callsMade) * 100).toFixed(1)}%` : "—";

    steps.push("campaign_contacts_and_contacts");
    const campaignIds = (campaigns ?? []).map((c) => c.id);
    const [{ data: existingLinks }, { data: candidateContacts }] = await withRetry(() =>
      Promise.all([
        campaignIds.length > 0
          ? supabase.from("campaign_contacts").select("campaign_id, contact_id").in("campaign_id", campaignIds)
          : Promise.resolve({ data: [] as { campaign_id: string; contact_id: string }[] }),
        supabase
          .from("contacts")
          .select("id, first_name, last_name, company, phone, email")
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false })
          .limit(500),
      ])
    );

    steps.push("build_default_values");
    const defaultValues = {
      name: agent.name,
      company_name: agent.company_name ?? "",
      agent_role: agent.agent_role ?? "",
      call_direction: agent.call_direction as "outbound" | "inbound" | "both",
      primary_objective: agent.primary_objective ?? "",
      language: agent.language,
      accent: agent.accent ?? "",
      voice: agent.voice,
      opening_greeting: agent.opening_greeting ?? "",
      system_prompt: agent.system_prompt ?? "",
      conversation_instructions: agent.conversation_instructions ?? "",
      qualification_questions: toStringArray(agent.qualification_questions).map((value) => ({ value })),
      objection_handling: agent.objection_handling ?? "",
      closing_instructions: agent.closing_instructions ?? "",
      voicemail_message: agent.voicemail_message ?? "",
      response_length: agent.response_length,
      creativity: agent.creativity,
      interruptions_enabled: agent.interruptions_enabled,
      appointment_booking_enabled: agent.appointment_booking_enabled,
      call_transfer_enabled: agent.call_transfer_enabled,
      transfer_phone_number: agent.transfer_phone_number ?? "",
      max_call_duration_seconds: agent.max_call_duration_seconds,
      silence_timeout_seconds: agent.silence_timeout_seconds,
      end_call_rules: agent.end_call_rules ?? "",
    };

    return NextResponse.json({
      ok: true,
      steps,
      summary: {
        agentId: agent.id,
        campaignsCount: (campaigns ?? []).length,
        knowledgeBasesCount: agentKnowledgeBases.length,
        contactsCount: (candidateContacts ?? []).length,
        existingLinksCount: (existingLinks ?? []).length,
        callsMade,
        callsConnected,
        appointmentsBooked,
        conversionRate,
        defaultValuesKeys: Object.keys(defaultValues),
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, step: "uncaught", lastStep: steps[steps.length - 1], steps, error: serializeError(err) }, { status: 200 });
  }
}
