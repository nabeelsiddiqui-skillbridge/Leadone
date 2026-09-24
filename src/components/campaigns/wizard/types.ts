export interface AgentOption {
  id: string;
  name: string;
  agent_role: string | null;
  voice: string;
}

export interface PhoneNumberOption {
  id: string;
  phone_number: string;
  friendly_name: string | null;
  country: string | null;
}

export interface ContactOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  phone: string;
  email: string | null;
}

/** A lead captured in the wizard (CSV upload or manual entry) that does not exist in `contacts` yet. */
export interface NewLeadDraft {
  tempId: string;
  source: "csv" | "manual";
  first_name: string;
  last_name: string;
  company: string;
  phone: string;
  email: string;
}

export const RETRY_EXCLUDED_STATUS_OPTIONS = ["do_not_call", "wrong_number", "not_interested"] as const;

export interface WizardState {
  name: string;
  description: string;
  agentId: string | null;
  phoneNumberId: string | null;
  selectedContactIds: string[];
  newLeads: NewLeadDraft[];
  timezoneMode: "contact_local" | "fixed" | "always";
  fixedTimezone: string;
  daysOfWeek: number[];
  callingStartTime: string;
  callingEndTime: string;
  startDate: string;
  endDate: string;
  dailyCallLimit: number;
  concurrencyLimit: number;
  maxAttempts: number;
  retryNoAnswerMinutes: number;
  retryBusyMinutes: number;
  retryFailedMinutes: number;
  retryExcludedStatuses: string[];
  voicemailAction: "hang_up" | "leave_message";
}

export const DEFAULT_WIZARD_STATE: WizardState = {
  name: "",
  description: "",
  agentId: null,
  phoneNumberId: null,
  selectedContactIds: [],
  newLeads: [],
  timezoneMode: "contact_local",
  fixedTimezone: "America/New_York",
  daysOfWeek: [1, 2, 3, 4, 5],
  callingStartTime: "09:00",
  callingEndTime: "17:00",
  startDate: "",
  endDate: "",
  dailyCallLimit: 200,
  concurrencyLimit: 3,
  maxAttempts: 3,
  retryNoAnswerMinutes: 1440,
  retryBusyMinutes: 120,
  retryFailedMinutes: 1440,
  retryExcludedStatuses: ["do_not_call", "wrong_number"],
  voicemailAction: "hang_up",
};

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function totalLeadCount(state: WizardState) {
  return state.selectedContactIds.length + state.newLeads.length;
}
