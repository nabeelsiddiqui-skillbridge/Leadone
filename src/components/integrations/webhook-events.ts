// Event names a workspace webhook can subscribe to. Registration only — no
// later phase's emitter is wired up to actually dispatch these yet.
export const WEBHOOK_EVENT_OPTIONS = [
  { value: "call.completed", label: "Call completed" },
  { value: "call.failed", label: "Call failed" },
  { value: "appointment.booked", label: "Appointment booked" },
  { value: "appointment.cancelled", label: "Appointment cancelled" },
  { value: "campaign.completed", label: "Campaign completed" },
  { value: "contact.do_not_call", label: "Contact marked do-not-call" },
] as const;
