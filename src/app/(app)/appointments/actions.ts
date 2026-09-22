"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type AppointmentStatus = Database["public"]["Tables"]["appointments"]["Row"]["status"];
type CallbackStatus = Database["public"]["Tables"]["callbacks"]["Row"]["status"];

export interface ActionResult {
  error?: string;
  message?: string;
}

function cleanString(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

/** Updates an appointment's status (and optionally its notes, e.g. a cancellation reason). */
export async function updateAppointmentStatusAction(
  id: string,
  status: AppointmentStatus,
  notes?: string
): Promise<ActionResult> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const update: Partial<Database["public"]["Tables"]["appointments"]["Row"]> = { status };
  const trimmedNotes = notes?.trim();
  if (trimmedNotes) {
    update.notes = trimmedNotes;
  }

  const { error } = await supabase
    .from("appointments")
    .update(update)
    .eq("workspace_id", workspace.id)
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/appointments");
  return { message: "Appointment updated." };
}

/** Updates a callback's status. */
export async function updateCallbackStatusAction(
  id: string,
  status: CallbackStatus
): Promise<ActionResult> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("callbacks")
    .update({ status })
    .eq("workspace_id", workspace.id)
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/appointments");
  return { message: "Callback updated." };
}

/**
 * Converts a wall-clock date + time in an arbitrary IANA timezone to a UTC
 * ISO string, without a timezone database library. This works by formatting
 * the same instant in both the UTC and target timezones (via Intl, using the
 * runtime's own tz data) and using the difference as the offset correction —
 * any bias from the server process's local timezone cancels out because it
 * affects both readings identically.
 */
function zonedTimeToUtcISOString(dateStr: string, timeStr: string, timeZone: string): string {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00.000Z`);
  const asUtcReading = new Date(naiveUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const asZoneReading = new Date(naiveUtc.toLocaleString("en-US", { timeZone }));
  const offsetMs = asUtcReading.getTime() - asZoneReading.getTime();
  return new Date(naiveUtc.getTime() + offsetMs).toISOString();
}

/** Manually creates an appointment (not from a call). */
export async function createAppointmentAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const contactId = cleanString(formData.get("contact_id"));
  const title = cleanString(formData.get("title"));
  const date = cleanString(formData.get("date"));
  const time = cleanString(formData.get("time"));
  const timezone = cleanString(formData.get("timezone"));
  const durationRaw = cleanString(formData.get("duration"));
  const agentId = cleanString(formData.get("agent_id"));
  const campaignId = cleanString(formData.get("campaign_id"));
  const notes = cleanString(formData.get("notes"));

  if (!contactId) return { error: "Select a contact." };
  if (!title) return { error: "Title is required." };
  if (!date || !time) return { error: "Date and time are required." };
  if (!timezone) return { error: "Timezone is required." };

  const duration = Number(durationRaw ?? 30);
  if (!Number.isFinite(duration) || duration <= 0) {
    return { error: "Duration must be a positive number of minutes." };
  }

  let startsAt: string;
  try {
    startsAt = zonedTimeToUtcISOString(date, time, timezone);
  } catch {
    return { error: "That timezone isn't recognized." };
  }
  if (Number.isNaN(new Date(startsAt).getTime())) {
    return { error: "Enter a valid date and time." };
  }
  const endsAt = new Date(new Date(startsAt).getTime() + duration * 60_000).toISOString();

  const { error } = await supabase.from("appointments").insert({
    workspace_id: workspace.id,
    contact_id: contactId,
    agent_id: agentId,
    campaign_id: campaignId,
    title,
    starts_at: startsAt,
    ends_at: endsAt,
    timezone,
    status: "scheduled",
    created_from_call: false,
    notes,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/appointments");
  return { message: "Appointment created." };
}
