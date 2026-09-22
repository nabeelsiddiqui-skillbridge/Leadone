export interface CallingWindow {
  days_of_week: number[];
  calling_start_time: string; // "HH:MM:SS" or "HH:MM"
  calling_end_time: string;
  start_date: string | null;
  end_date: string | null;
  timezone_mode: "contact_local" | "fixed";
  fixed_timezone: string | null;
}

function partsInTimezone(timeZone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dayOfWeek: weekdayMap[parts.weekday] ?? date.getUTCDay(),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function timeStringToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Resolves which IANA timezone governs a given contact's call, per the
 * campaign's timezone_mode. Returns null when the campaign wants
 * contact-local hours but the contact has no timezone on file — callers
 * should treat that as "not eligible yet" (spec: "prevent campaign workers
 * from accidentally calling contacts at inappropriate hours" — the safe
 * fallback here is to wait rather than guess).
 */
export function resolveTimezone(window: CallingWindow, contactTimezone: string | null): string | null {
  if (window.timezone_mode === "fixed") {
    return window.fixed_timezone ?? "UTC";
  }
  return contactTimezone;
}

export function isWithinCallingWindow(window: CallingWindow, timezone: string, now: Date = new Date()): boolean {
  const { dayOfWeek, hour, minute, isoDate } = partsInTimezone(timezone, now);

  if (window.start_date && isoDate < window.start_date) return false;
  if (window.end_date && isoDate > window.end_date) return false;
  if (!window.days_of_week.includes(dayOfWeek)) return false;

  const minutesNow = hour * 60 + minute;
  const startMinutes = timeStringToMinutes(window.calling_start_time);
  const endMinutes = timeStringToMinutes(window.calling_end_time);
  return minutesNow >= startMinutes && minutesNow < endMinutes;
}
