import { z } from "zod";
import { google } from "googleapis";

import { db } from "../db.js";
import { decryptSecret, encryptSecret } from "../crypto.js";
import type { ToolExecutionContext, ToolResult } from "../types.js";

interface CalendarConnectionRow {
  id: string;
  provider: string;
  calendar_id: string | null;
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  token_iv: string | null;
  expires_at: string | null;
  status: string;
}

async function getGoogleClient(workspaceId: string) {
  const { data: connection } = await db
    .from("calendar_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", "google")
    .eq("status", "connected")
    .maybeSingle<CalendarConnectionRow>();

  if (!connection || !connection.access_token_ciphertext || !connection.token_iv) {
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  const accessToken = decryptSecret(connection.access_token_ciphertext, connection.token_iv);
  const refreshToken = connection.refresh_token_ciphertext
    ? decryptSecret(connection.refresh_token_ciphertext, connection.token_iv)
    : undefined;

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: connection.expires_at ? new Date(connection.expires_at).getTime() : undefined,
  });

  oauth2Client.on("tokens", async (tokens) => {
    if (!tokens.access_token) return;
    const encrypted = encryptSecret(tokens.access_token);
    await db
      .from("calendar_connections")
      .update({
        access_token_ciphertext: encrypted.ciphertext,
        token_iv: encrypted.iv,
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      })
      .eq("id", connection.id);
  });

  return { oauth2Client, calendarId: connection.calendar_id ?? "primary" };
}

const checkAvailabilitySchema = z.object({
  earliest: z.string().min(1),
  latest: z.string().min(1),
  duration_minutes: z.number().min(5).max(240).optional().default(30),
});

export async function checkAvailability(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  const parsed = checkAvailabilitySchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  const client = await getGoogleClient(ctx.session.workspaceId);
  if (!client) {
    return {
      status: "unavailable",
      message: "This business hasn't connected a calendar yet, so I can't check real availability right now. Offer to have someone follow up instead.",
    };
  }

  const earliest = new Date(parsed.data.earliest);
  const latest = new Date(parsed.data.latest);
  if (Number.isNaN(earliest.getTime()) || Number.isNaN(latest.getTime()) || earliest >= latest) {
    return { status: "error", message: "earliest/latest must be valid, ordered datetimes." };
  }

  const calendar = google.calendar({ version: "v3", auth: client.oauth2Client });
  const freebusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: earliest.toISOString(),
      timeMax: latest.toISOString(),
      items: [{ id: client.calendarId }],
    },
  });

  const busy = freebusy.data.calendars?.[client.calendarId]?.busy ?? [];
  const durationMs = parsed.data.duration_minutes * 60 * 1000;
  const slots: Array<{ start: string; end: string }> = [];

  let cursor = earliest.getTime();
  const endBound = latest.getTime();
  const busyRanges = busy
    .map((b) => ({ start: new Date(b.start ?? "").getTime(), end: new Date(b.end ?? "").getTime() }))
    .sort((a, b) => a.start - b.start);

  while (cursor + durationMs <= endBound && slots.length < 5) {
    const slotEnd = cursor + durationMs;
    const overlaps = busyRanges.some((b) => cursor < b.end && slotEnd > b.start);
    if (!overlaps) {
      slots.push({ start: new Date(cursor).toISOString(), end: new Date(slotEnd).toISOString() });
      cursor += durationMs;
    } else {
      const conflict = busyRanges.find((b) => cursor < b.end && slotEnd > b.start);
      cursor = conflict ? conflict.end : cursor + durationMs;
    }
  }

  ctx.session.appointmentState.lastCheckedSlots = slots;

  return {
    status: "success",
    message: slots.length > 0 ? `Found ${slots.length} open slot(s).` : "No open slots in that window.",
    data: { slots },
  };
}

const bookAppointmentSchema = z.object({
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  title: z.string().optional(),
});

export async function bookAppointment(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  if (!ctx.contact) return { status: "error", message: "No contact attached to this call." };
  const parsed = bookAppointmentSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  const startsAt = new Date(parsed.data.starts_at);
  const endsAt = new Date(parsed.data.ends_at);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    return { status: "error", message: "starts_at/ends_at must be valid, ordered datetimes." };
  }

  // Guardrail: only allow booking a slot this call actually confirmed was
  // free via check_availability, matching the spec's "never invent calendar
  // availability" rule.
  const checked = ctx.session.appointmentState.lastCheckedSlots ?? [];
  const matchesChecked = checked.some(
    (slot) => slot.start === startsAt.toISOString() && slot.end === endsAt.toISOString()
  );
  if (!matchesChecked) {
    return {
      status: "error",
      message: "That time wasn't in the availability you just checked. Call check_availability again and offer one of the returned slots.",
    };
  }

  const client = await getGoogleClient(ctx.session.workspaceId);
  if (!client) {
    return {
      status: "unavailable",
      message: "This business hasn't connected a calendar yet, so I can't confirm a real booking. Offer to have someone follow up instead.",
    };
  }

  const calendar = google.calendar({ version: "v3", auth: client.oauth2Client });
  const contactName = [ctx.contact.first_name, ctx.contact.last_name].filter(Boolean).join(" ") || "Lead";
  const title = parsed.data.title || `${ctx.agent.name} call with ${contactName}`;

  const event = await calendar.events.insert({
    calendarId: client.calendarId,
    requestBody: {
      summary: title,
      description: `Booked automatically by LeadOne agent "${ctx.agent.name}" during call ${ctx.session.callId}.`,
      start: { dateTime: startsAt.toISOString() },
      end: { dateTime: endsAt.toISOString() },
      attendees: ctx.contact.email ? [{ email: ctx.contact.email, displayName: contactName }] : undefined,
    },
  });

  const { data: appointment, error } = await db
    .from("appointments")
    .insert({
      workspace_id: ctx.contact.workspace_id,
      contact_id: ctx.contact.id,
      campaign_id: ctx.session.campaignId,
      agent_id: ctx.session.agentId,
      call_id: ctx.session.callId,
      title,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      timezone: ctx.contact.timezone ?? "UTC",
      status: "scheduled",
      external_event_id: event.data.id ?? null,
      created_from_call: true,
    })
    .select("id")
    .single();

  if (error) return { status: "error", message: `Calendar event created but saving the appointment failed: ${error.message}` };

  ctx.session.appointmentState.bookedAppointmentId = appointment.id;
  return { status: "success", message: "Appointment booked and confirmed.", data: { appointment_id: appointment.id } };
}

const rescheduleSchema = z.object({
  appointment_id: z.string().uuid(),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
});

export async function rescheduleAppointment(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  const parsed = rescheduleSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  const { data: appointment } = await db
    .from("appointments")
    .select("*")
    .eq("id", parsed.data.appointment_id)
    .eq("workspace_id", ctx.session.workspaceId)
    .maybeSingle();

  if (!appointment) return { status: "error", message: "Appointment not found." };

  const client = await getGoogleClient(ctx.session.workspaceId);
  if (client && appointment.external_event_id) {
    const calendar = google.calendar({ version: "v3", auth: client.oauth2Client });
    await calendar.events.patch({
      calendarId: client.calendarId,
      eventId: appointment.external_event_id,
      requestBody: {
        start: { dateTime: new Date(parsed.data.starts_at).toISOString() },
        end: { dateTime: new Date(parsed.data.ends_at).toISOString() },
      },
    });
  }

  const { error } = await db
    .from("appointments")
    .update({
      starts_at: new Date(parsed.data.starts_at).toISOString(),
      ends_at: new Date(parsed.data.ends_at).toISOString(),
      status: "rescheduled",
    })
    .eq("id", parsed.data.appointment_id);

  if (error) return { status: "error", message: error.message };
  return { status: "success", message: "Appointment rescheduled." };
}

const cancelSchema = z.object({ appointment_id: z.string().uuid(), reason: z.string().optional() });

export async function cancelAppointment(ctx: ToolExecutionContext, rawArgs: unknown): Promise<ToolResult> {
  const parsed = cancelSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: "error", message: `Invalid arguments: ${parsed.error.message}` };

  const { data: appointment } = await db
    .from("appointments")
    .select("*")
    .eq("id", parsed.data.appointment_id)
    .eq("workspace_id", ctx.session.workspaceId)
    .maybeSingle();

  if (!appointment) return { status: "error", message: "Appointment not found." };

  const client = await getGoogleClient(ctx.session.workspaceId);
  if (client && appointment.external_event_id) {
    const calendar = google.calendar({ version: "v3", auth: client.oauth2Client });
    await calendar.events.delete({ calendarId: client.calendarId, eventId: appointment.external_event_id }).catch(() => {
      // Event may already be gone; still mark our record cancelled below.
    });
  }

  const { error } = await db
    .from("appointments")
    .update({ status: "cancelled", notes: parsed.data.reason ?? appointment.notes })
    .eq("id", parsed.data.appointment_id);

  if (error) return { status: "error", message: error.message };
  return { status: "success", message: "Appointment cancelled." };
}
