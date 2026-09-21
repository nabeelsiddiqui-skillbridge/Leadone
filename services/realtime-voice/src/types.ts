export interface AgentRecord {
  id: string;
  workspace_id: string;
  name: string;
  company_name: string | null;
  agent_role: string | null;
  persona: string | null;
  primary_objective: string | null;
  opening_greeting: string | null;
  system_prompt: string | null;
  conversation_instructions: string | null;
  qualification_questions: unknown;
  objection_handling: string | null;
  closing_instructions: string | null;
  voicemail_message: string | null;
  language: string;
  accent: string | null;
  voice: string;
  response_length: "concise" | "balanced" | "detailed";
  creativity: number;
  interruptions_enabled: boolean;
  appointment_booking_enabled: boolean;
  call_transfer_enabled: boolean;
  transfer_phone_number: string | null;
  max_call_duration_seconds: number;
  silence_timeout_seconds: number;
  end_call_rules: string | null;
}

export interface ContactRecord {
  id: string;
  workspace_id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  phone: string;
  email: string | null;
  job_title: string | null;
  timezone: string | null;
  status: string;
  custom_fields: Record<string, unknown>;
}

export interface CallRecord {
  id: string;
  workspace_id: string;
  campaign_id: string | null;
  agent_id: string | null;
  contact_id: string | null;
  phone_number_id: string | null;
  twilio_call_sid: string | null;
  direction: "outbound" | "inbound";
  status: string;
}

/**
 * Live in-memory state for one active call, per spec's "call session
 * object". Lives only for the lifetime of the WebSocket connections; the
 * durable record is the `calls` row plus its child tables.
 */
export interface CallSessionState {
  callId: string;
  workspaceId: string;
  agentId: string | null;
  campaignId: string | null;
  contactId: string | null;
  twilioCallSid: string | null;
  twilioStreamSid: string | null;
  openaiSessionId: string | null;
  callStartedAt: number;
  currentTurn: number;
  agentSpeaking: boolean;
  callerSpeaking: boolean;
  toolState: Record<string, unknown>;
  appointmentState: {
    lastCheckedSlots?: Array<{ start: string; end: string }>;
    bookedAppointmentId?: string;
  };
  transcriptTurn: number;
  outcome: string | null;
  ended: boolean;
  currentTurnLatency: {
    callerSpeechEndedAt?: number;
    firstModelTokenAt?: number;
    firstAudioAt?: number;
    toolStartedAt?: number;
    toolEndedAt?: number;
  };
}

export interface ToolExecutionContext {
  session: CallSessionState;
  agent: AgentRecord;
  contact: ContactRecord | null;
}

export interface ToolResult {
  status: "success" | "error" | "unavailable";
  data?: Record<string, unknown>;
  message: string;
}
