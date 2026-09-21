import type { ContactStatus } from "@/lib/supabase/database.types";

export const CONTACT_STATUSES: { value: ContactStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "queued", label: "Queued" },
  { value: "calling", label: "Calling" },
  { value: "connected", label: "Connected" },
  { value: "qualified", label: "Qualified" },
  { value: "appointment_booked", label: "Appointment Booked" },
  { value: "follow_up", label: "Follow Up" },
  { value: "not_interested", label: "Not Interested" },
  { value: "no_answer", label: "No Answer" },
  { value: "busy", label: "Busy" },
  { value: "voicemail", label: "Voicemail" },
  { value: "wrong_number", label: "Wrong Number" },
  { value: "do_not_call", label: "Do Not Call" },
  { value: "failed", label: "Failed" },
];

const STATUS_LABELS: Record<ContactStatus, string> = Object.fromEntries(
  CONTACT_STATUSES.map((s) => [s.value, s.label])
) as Record<ContactStatus, string>;

export function contactStatusLabel(status: ContactStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/** Badge variant + optional extra className per status, per the spec's color-coding rules. */
export function contactStatusBadgeProps(status: ContactStatus): {
  variant: "success" | "secondary" | "outline" | "default";
  className?: string;
} {
  if (status === "qualified" || status === "appointment_booked") {
    return { variant: "success" };
  }
  if (status === "do_not_call" || status === "not_interested") {
    return { variant: "secondary", className: "text-destructive border-destructive/30 bg-destructive/10" };
  }
  return { variant: "secondary" };
}

/** Fields a CSV column can be mapped to when importing contacts. */
export const IMPORT_TARGET_FIELDS = [
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "company", label: "Company" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "website", label: "Website" },
  { value: "job_title", label: "Job Title" },
  { value: "timezone", label: "Timezone" },
  { value: "country", label: "Country" },
  { value: "industry", label: "Industry" },
  { value: "custom", label: "Custom field" },
  { value: "ignore", label: "Ignore" },
] as const;

export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number]["value"];
