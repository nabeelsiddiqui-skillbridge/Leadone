import { describe, it, expect } from "vitest";

import { buildSystemInstructions, buildOpeningGreeting, maxOutputTokensForAgent } from "./promptBuilder.js";
import type { AgentRecord, ContactRecord } from "./types.js";

const BASE_AGENT: AgentRecord = {
  id: "agent-1",
  workspace_id: "ws-1",
  name: "Sarah",
  company_name: "Skill Bridge",
  agent_role: "Marketing Audit Specialist",
  persona: null,
  primary_objective: "Book a free marketing audit.",
  opening_greeting: "Hi {{first_name}}, this is Sarah from Skill Bridge.",
  system_prompt: "Be friendly and concise.",
  conversation_instructions: null,
  qualification_questions: ["What's your monthly ad spend?", "Who handles marketing today?"],
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
};

const BASE_CONTACT: ContactRecord = {
  id: "contact-1",
  workspace_id: "ws-1",
  first_name: "John",
  last_name: "Doe",
  company: "Acme Co",
  phone: "+15551234567",
  email: null,
  job_title: "Owner",
  timezone: "America/New_York",
  status: "new",
  custom_fields: {},
};

describe("buildSystemInstructions", () => {
  it("includes the agent's name, role, and company", () => {
    const prompt = buildSystemInstructions(BASE_AGENT, BASE_CONTACT);
    expect(prompt).toContain("You are Sarah, Marketing Audit Specialist at Skill Bridge.");
  });

  it("includes the contact's name and company when a contact is attached", () => {
    const prompt = buildSystemInstructions(BASE_AGENT, BASE_CONTACT);
    expect(prompt).toContain("You are calling John Doe.");
    expect(prompt).toContain("They work at Acme Co.");
  });

  it("handles a call with no contact attached", () => {
    const prompt = buildSystemInstructions(BASE_AGENT, null);
    expect(prompt).toContain("No contact record is attached to this call.");
  });

  it("weaves in qualification questions without a robotic list format in the source data", () => {
    const prompt = buildSystemInstructions(BASE_AGENT, BASE_CONTACT);
    expect(prompt).toContain("What's your monthly ad spend?");
    expect(prompt).toContain("without reading them as a list");
  });

  it("tells the model it CAN book appointments when appointment_booking_enabled is true", () => {
    const prompt = buildSystemInstructions(BASE_AGENT, BASE_CONTACT);
    expect(prompt).toContain("You can book appointments.");
    expect(prompt).not.toContain("You cannot book appointments");
  });

  it("tells the model it CANNOT book appointments when appointment_booking_enabled is false", () => {
    const prompt = buildSystemInstructions({ ...BASE_AGENT, appointment_booking_enabled: false }, BASE_CONTACT);
    expect(prompt).toContain("You cannot book appointments on this call.");
  });

  it("always includes the base conversation rules (natural speech, barge-in, no fabrication)", () => {
    const prompt = buildSystemInstructions(BASE_AGENT, BASE_CONTACT);
    expect(prompt).toContain("Never invent information");
    expect(prompt).toContain("stop immediately and listen");
    expect(prompt).toContain("mark_do_not_call");
  });

  it("omits empty/null optional sections instead of leaving blank lines", () => {
    const prompt = buildSystemInstructions(BASE_AGENT, BASE_CONTACT);
    // persona was null on BASE_AGENT - should never appear as "Persona: null" etc.
    expect(prompt).not.toContain("Persona: null");
    expect(prompt).not.toMatch(/\n{3,}/);
  });

  it("includes a reply-length rule matching the agent's response_length setting", () => {
    const concise = buildSystemInstructions(BASE_AGENT, BASE_CONTACT);
    expect(concise).toContain("one short sentence");

    const detailed = buildSystemInstructions({ ...BASE_AGENT, response_length: "detailed" }, BASE_CONTACT);
    expect(detailed).toContain("short paragraph at most");
  });
});

describe("maxOutputTokensForAgent", () => {
  it("caps concise agents to a small token budget", () => {
    expect(maxOutputTokensForAgent({ ...BASE_AGENT, response_length: "concise" })).toBe(120);
  });

  it("allows a larger budget for balanced agents", () => {
    expect(maxOutputTokensForAgent({ ...BASE_AGENT, response_length: "balanced" })).toBe(300);
  });

  it("removes the cap entirely for detailed agents", () => {
    expect(maxOutputTokensForAgent({ ...BASE_AGENT, response_length: "detailed" })).toBe("inf");
  });
});

describe("buildOpeningGreeting", () => {
  it("substitutes the contact's first name into the template", () => {
    expect(buildOpeningGreeting(BASE_AGENT, BASE_CONTACT)).toBe("Hi John, this is Sarah from Skill Bridge.");
  });

  it("falls back to 'there' when the contact has no first name", () => {
    const noName = { ...BASE_CONTACT, first_name: null };
    expect(buildOpeningGreeting(BASE_AGENT, noName)).toBe("Hi there, this is Sarah from Skill Bridge.");
  });

  it("falls back to 'there' when there is no contact at all", () => {
    expect(buildOpeningGreeting(BASE_AGENT, null)).toBe("Hi there, this is Sarah from Skill Bridge.");
  });

  it("returns null when the agent has no configured opening greeting", () => {
    expect(buildOpeningGreeting({ ...BASE_AGENT, opening_greeting: null }, BASE_CONTACT)).toBeNull();
  });
});
