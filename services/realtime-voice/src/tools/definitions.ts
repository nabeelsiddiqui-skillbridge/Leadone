/**
 * Tool (function) definitions sent to the OpenAI Realtime session. Names
 * here must exactly match the keys in `src/tools/index.ts`'s registry, and
 * every field the model can populate is re-validated server-side with zod
 * before anything touches the database — the model's arguments are never
 * trusted directly (spec: "never trust model-generated values without
 * validation").
 */
export const TOOL_DEFINITIONS = [
  {
    type: "function",
    name: "check_availability",
    description: "Check real calendar availability for booking an appointment. Always call this before offering specific times.",
    parameters: {
      type: "object",
      properties: {
        earliest: { type: "string", description: "Earliest acceptable ISO 8601 datetime, e.g. tomorrow 9am in the contact's timezone." },
        latest: { type: "string", description: "Latest acceptable ISO 8601 datetime to search within." },
        duration_minutes: { type: "number", description: "Desired meeting length in minutes.", default: 30 },
      },
      required: ["earliest", "latest"],
    },
  },
  {
    type: "function",
    name: "book_appointment",
    description: "Book a confirmed appointment at a specific time returned by check_availability. Only say a booking is confirmed after this tool returns status success.",
    parameters: {
      type: "object",
      properties: {
        starts_at: { type: "string", description: "ISO 8601 start datetime, must be one of the slots check_availability returned." },
        ends_at: { type: "string", description: "ISO 8601 end datetime." },
        title: { type: "string", description: "Short appointment title." },
      },
      required: ["starts_at", "ends_at"],
    },
  },
  {
    type: "function",
    name: "reschedule_appointment",
    description: "Move an existing appointment booked earlier in this call to a new time.",
    parameters: {
      type: "object",
      properties: {
        appointment_id: { type: "string" },
        starts_at: { type: "string" },
        ends_at: { type: "string" },
      },
      required: ["appointment_id", "starts_at", "ends_at"],
    },
  },
  {
    type: "function",
    name: "cancel_appointment",
    description: "Cancel an existing appointment.",
    parameters: {
      type: "object",
      properties: { appointment_id: { type: "string" }, reason: { type: "string" } },
      required: ["appointment_id"],
    },
  },
  {
    type: "function",
    name: "update_contact",
    description: "Update the contact record with information learned during the call (email, company, job title, etc.).",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string" },
        company: { type: "string" },
        job_title: { type: "string" },
        website: { type: "string" },
      },
    },
  },
  {
    type: "function",
    name: "save_note",
    description: "Save a short note on the contact's record, e.g. a detail worth a human following up on.",
    parameters: {
      type: "object",
      properties: { note: { type: "string" } },
      required: ["note"],
    },
  },
  {
    type: "function",
    name: "update_lead_status",
    description: "Update the contact's lead status based on how the call is going.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [
            "connected", "qualified", "appointment_booked", "follow_up",
            "not_interested", "wrong_number", "failed",
          ],
        },
        lead_score: { type: "number", description: "0-100 estimate of how good a fit this lead is." },
      },
      required: ["status"],
    },
  },
  {
    type: "function",
    name: "mark_do_not_call",
    description: "The caller asked not to be called again. Add them to the Do Not Call list immediately.",
    parameters: {
      type: "object",
      properties: { reason: { type: "string" } },
    },
  },
  {
    type: "function",
    name: "schedule_callback",
    description: "The caller asked to be called back at a specific later time.",
    parameters: {
      type: "object",
      properties: {
        requested_for: { type: "string", description: "ISO 8601 datetime for the callback." },
        timezone: { type: "string" },
      },
      required: ["requested_for"],
    },
  },
  {
    type: "function",
    name: "transfer_call",
    description: "Transfer the live call to a human.",
    parameters: {
      type: "object",
      properties: { reason: { type: "string" } },
    },
  },
  {
    type: "function",
    name: "send_sms",
    description: "Send a follow-up SMS to the contact after the call.",
    parameters: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  },
  {
    type: "function",
    name: "send_email",
    description: "Send a follow-up email to the contact after the call.",
    parameters: {
      type: "object",
      properties: { subject: { type: "string" }, body: { type: "string" } },
      required: ["subject", "body"],
    },
  },
  {
    type: "function",
    name: "end_call",
    description: "End the call now, e.g. after saying goodbye or if the caller hangs up on their end.",
    parameters: {
      type: "object",
      properties: { reason: { type: "string" } },
    },
  },
  {
    type: "function",
    name: "get_contact_information",
    description: "Look up what's already known about this contact/lead.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "search_knowledge_base",
    description: "Search the business's knowledge base for facts to answer the caller's question accurately.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
] as const;

export type ToolName = (typeof TOOL_DEFINITIONS)[number]["name"];
