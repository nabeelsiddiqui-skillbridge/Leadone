import type { AgentRecord, ContactRecord } from "./types.js";

const BASE_CONVERSATION_RULES = `
Speak naturally, the way a real person would on the phone.
Ask one question at a time. Do not deliver long paragraphs and do not sound like a chatbot reading a script.
Do not repeat the caller's name over and over.
Use contractions naturally (I'm, you're, that's, don't).
Use light conversational acknowledgements ("Got it.", "Okay.", "Sure.", "Absolutely.", "That makes sense.") but don't overuse them.
Avoid stiff, corporate phrasing like "Certainly, I would be delighted to assist," "Thank you for providing that information," or "I completely understand your concern."
Respond quickly and let the caller interrupt you. If the caller starts talking while you're speaking, stop immediately and listen — do not talk over them.
Never claim an appointment has been booked unless the book_appointment tool call returns a confirmed result. Never invent calendar availability.
Never invent information that is not in your instructions or the knowledge base search results. If you don't know something, say so and offer to have someone follow up.
If the caller asks to not be called again, stop calling, or says they're not interested in ever being contacted, acknowledge them politely and call the mark_do_not_call tool — do not argue or keep pitching.
`.trim();

const RESPONSE_LENGTH_RULES: Record<AgentRecord["response_length"], string> = {
  concise:
    "Reply length: keep every single reply to one short sentence — two only if truly necessary. Answer the one thing that was just said or asked, then stop talking. Never stack multiple points or questions in one turn.",
  balanced: "Reply length: keep replies to 2-3 short sentences. Stay focused on the one topic at hand before moving to the next.",
  detailed:
    "Reply length: you may give a fuller explanation when the caller asks for detail, but keep it to a short paragraph at most and stay on the single point being discussed — never wander across multiple topics in one turn.",
};

/** Session-level hard cap matching the response_length rule above, so verbosity is enforced by the API itself and not just requested in the prompt. */
export function maxOutputTokensForAgent(agent: AgentRecord): number | "inf" {
  switch (agent.response_length) {
    case "concise":
      return 120;
    case "balanced":
      return 300;
    case "detailed":
      return "inf";
  }
}

function contactContext(contact: ContactRecord | null): string {
  if (!contact) return "No contact record is attached to this call.";
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "the person you're calling";
  const parts = [
    `You are calling ${name}.`,
    contact.company ? `They work at ${contact.company}.` : null,
    contact.job_title ? `Their role is ${contact.job_title}.` : null,
  ].filter(Boolean);
  return parts.join(" ");
}

export function buildSystemInstructions(agent: AgentRecord, contact: ContactRecord | null): string {
  const qualificationQuestions = Array.isArray(agent.qualification_questions)
    ? (agent.qualification_questions as unknown[]).filter((q): q is string => typeof q === "string")
    : [];

  const sections = [
    `You are ${agent.name}${agent.agent_role ? `, ${agent.agent_role}` : ""}${
      agent.company_name ? ` at ${agent.company_name}` : ""
    }.`,
    agent.persona ? `Persona: ${agent.persona}` : null,
    agent.primary_objective ? `Your objective on this call: ${agent.primary_objective}` : null,
    contactContext(contact),
    agent.system_prompt ? `Instructions from the business:\n${agent.system_prompt}` : null,
    agent.conversation_instructions ? `Conversation style notes:\n${agent.conversation_instructions}` : null,
    qualificationQuestions.length > 0
      ? `Work these qualification questions naturally into the conversation, one at a time, without reading them as a list:\n- ${qualificationQuestions.join("\n- ")}`
      : null,
    agent.objection_handling ? `If the caller objects or pushes back:\n${agent.objection_handling}` : null,
    agent.closing_instructions ? `How to close the call:\n${agent.closing_instructions}` : null,
    agent.appointment_booking_enabled
      ? "You can book appointments. Use check_availability before offering times, and only confirm a booking after book_appointment succeeds."
      : "You cannot book appointments on this call. If the caller wants to schedule something, offer to have someone follow up and use schedule_callback or save_note."
    ,
    agent.call_transfer_enabled
      ? "If the caller asks for a human, or the conversation needs one, use the transfer_call tool."
      : null,
    agent.end_call_rules ? `When to end the call:\n${agent.end_call_rules}` : null,
    "Use the search_knowledge_base tool when the caller asks something factual about the business (pricing, services, policies) that you're not certain about from these instructions alone.",
    BASE_CONVERSATION_RULES,
    RESPONSE_LENGTH_RULES[agent.response_length],
  ];

  return sections.filter(Boolean).join("\n\n");
}

export function buildOpeningGreeting(agent: AgentRecord, contact: ContactRecord | null): string | null {
  if (!agent.opening_greeting) return null;
  const name = contact?.first_name ?? null;
  return name ? agent.opening_greeting.replaceAll("{{first_name}}", name) : agent.opening_greeting.replaceAll("{{first_name}}", "there");
}
