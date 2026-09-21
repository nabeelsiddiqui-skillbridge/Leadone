import OpenAI from "openai";

import { db } from "./db.js";
import { config } from "./config.js";

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "2-3 sentence summary of the call." },
    outcome: {
      type: "string",
      enum: [
        "qualified", "appointment_booked", "not_interested", "follow_up_needed",
        "no_decision", "wrong_number", "voicemail", "incomplete",
      ],
    },
    interest_level: { type: "string", enum: ["high", "medium", "low", "none"] },
    primary_need: { type: "string" },
    objections: { type: "array", items: { type: "string" } },
    follow_up_required: { type: "boolean" },
    next_action: { type: "string" },
    lead_score: { type: "number", description: "0-100" },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    suggested_notes: { type: "string" },
  },
  required: ["summary", "outcome", "interest_level", "follow_up_required", "next_action", "lead_score", "sentiment"],
  additionalProperties: false,
};

/**
 * Runs after the call ends (fire-and-forget from callSession.finalize) so
 * it never adds latency to the live conversation. Reads the transcript this
 * same process just wrote, asks a fast text model to structure it, and
 * writes the result onto the calls row + bumps the contact's lead score.
 */
export async function runPostCallAnalysis(callId: string): Promise<void> {
  try {
    const { data: turns } = await db
      .from("call_transcripts")
      .select("speaker, message, turn_number")
      .eq("call_id", callId)
      .order("turn_number", { ascending: true });

    if (!turns || turns.length === 0) return;

    const { data: call } = await db.from("calls").select("contact_id, workspace_id").eq("id", callId).single();
    if (!call) return;

    const transcriptText = turns.map((t) => `${t.speaker === "agent" ? "Agent" : "Caller"}: ${t.message}`).join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You analyze outbound sales/qualification phone call transcripts and extract structured data. Be concise and factual; never invent details not present in the transcript.",
        },
        { role: "user", content: `Transcript:\n\n${transcriptText}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "call_analysis", schema: ANALYSIS_SCHEMA, strict: true },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return;
    const analysis = JSON.parse(raw) as {
      summary: string;
      outcome: string;
      interest_level: string;
      primary_need?: string;
      objections?: string[];
      follow_up_required: boolean;
      next_action: string;
      lead_score: number;
      sentiment: string;
      suggested_notes?: string;
    };

    await db
      .from("calls")
      .update({
        summary: analysis.summary,
        outcome: analysis.outcome,
        interest_level: analysis.interest_level,
        sentiment: analysis.sentiment,
        qualification: {
          primary_need: analysis.primary_need ?? null,
          objections: analysis.objections ?? [],
          follow_up_required: analysis.follow_up_required,
          next_action: analysis.next_action,
        },
      })
      .eq("id", callId);

    if (call.contact_id) {
      await db.from("contacts").update({ lead_score: Math.round(analysis.lead_score) }).eq("id", call.contact_id);
      if (analysis.suggested_notes) {
        await db.from("contact_notes").insert({
          contact_id: call.contact_id,
          workspace_id: call.workspace_id,
          note: `[AI call summary] ${analysis.suggested_notes}`,
        });
      }
    }
  } catch (err) {
    // Never let analysis failures surface as a call failure — it already
    // completed successfully from the caller's perspective.
    await db.from("call_events").insert({
      call_id: callId,
      workspace_id: (await db.from("calls").select("workspace_id").eq("id", callId).single()).data?.workspace_id ?? "",
      event_type: "post_call_analysis_error",
      payload: { message: (err as Error).message },
    });
  }
}
