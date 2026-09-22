import { describe, it, expect } from "vitest";

import { bookAppointment } from "./calendar.js";
import type { ToolExecutionContext } from "../types.js";

/**
 * bookAppointment's "only book a slot check_availability actually returned"
 * guardrail runs before any database/Google Calendar call, so it's testable
 * in isolation - this is the concrete mechanism behind the spec requirement
 * "never invent calendar availability."
 */
describe("bookAppointment guardrail", () => {
  const baseContext = (lastCheckedSlots: Array<{ start: string; end: string }>): ToolExecutionContext => ({
    session: {
      callId: "call-1",
      workspaceId: "ws-1",
      agentId: "agent-1",
      campaignId: null,
      contactId: "contact-1",
      twilioCallSid: null,
      twilioStreamSid: null,
      openaiSessionId: null,
      callStartedAt: Date.now(),
      currentTurn: 0,
      agentSpeaking: false,
      callerSpeaking: false,
      toolState: {},
      appointmentState: { lastCheckedSlots },
      transcriptTurn: 0,
      outcome: null,
      ended: false,
      currentTurnLatency: {},
    },
    agent: {
      id: "agent-1",
      workspace_id: "ws-1",
      name: "Sarah",
      company_name: null,
      agent_role: null,
      persona: null,
      primary_objective: null,
      opening_greeting: null,
      system_prompt: null,
      conversation_instructions: null,
      qualification_questions: [],
      objection_handling: null,
      closing_instructions: null,
      voicemail_message: null,
      language: "en-US",
      accent: null,
      voice: "alloy",
      response_length: "concise",
      creativity: 0.3,
      interruptions_enabled: true,
      appointment_booking_enabled: true,
      call_transfer_enabled: false,
      transfer_phone_number: null,
      max_call_duration_seconds: 900,
      silence_timeout_seconds: 10,
      end_call_rules: null,
    },
    contact: {
      id: "contact-1",
      workspace_id: "ws-1",
      first_name: "John",
      last_name: "Doe",
      company: null,
      phone: "+15551234567",
      email: null,
      job_title: null,
      timezone: "America/New_York",
      status: "new",
      custom_fields: {},
    },
  });

  it("rejects a booking for a time that was never returned by check_availability", async () => {
    const ctx = baseContext([{ start: "2026-01-05T14:00:00.000Z", end: "2026-01-05T14:30:00.000Z" }]);

    const result = await bookAppointment(ctx, {
      starts_at: "2026-01-05T20:00:00.000Z", // not in the checked slots
      ends_at: "2026-01-05T20:30:00.000Z",
    });

    expect(result.status).toBe("error");
    expect(result.message).toContain("wasn't in the availability you just checked");
  });

  it("rejects a booking when no availability was ever checked this call", async () => {
    const ctx = baseContext([]);

    const result = await bookAppointment(ctx, {
      starts_at: "2026-01-05T14:00:00.000Z",
      ends_at: "2026-01-05T14:30:00.000Z",
    });

    expect(result.status).toBe("error");
  });

  it("rejects malformed/missing arguments before touching any external system", async () => {
    const ctx = baseContext([]);
    const result = await bookAppointment(ctx, { starts_at: "not-a-real-call-arg" } as unknown);
    expect(result.status).toBe("error");
  });

  it("rejects starts_at/ends_at that aren't valid, ordered datetimes even if they match a checked slot's strings", async () => {
    const ctx = baseContext([{ start: "not-a-date", end: "also-not-a-date" }]);
    const result = await bookAppointment(ctx, { starts_at: "not-a-date", ends_at: "also-not-a-date" });
    expect(result.status).toBe("error");
    expect(result.message).toContain("valid, ordered datetimes");
  });
});
