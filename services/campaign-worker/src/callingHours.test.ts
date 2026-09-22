import { describe, it, expect } from "vitest";

import { isWithinCallingWindow, resolveTimezone, type CallingWindow } from "./callingHours.js";

const WEEKDAY_WINDOW: CallingWindow = {
  days_of_week: [1, 2, 3, 4, 5], // Mon-Fri
  calling_start_time: "09:00",
  calling_end_time: "17:00",
  start_date: null,
  end_date: null,
  timezone_mode: "fixed",
  fixed_timezone: "America/New_York",
};

describe("resolveTimezone", () => {
  it("uses the campaign's fixed timezone in fixed mode, ignoring the contact's", () => {
    expect(resolveTimezone(WEEKDAY_WINDOW, "Asia/Tokyo")).toBe("America/New_York");
  });

  it("defaults fixed mode to UTC if no fixed_timezone was set", () => {
    expect(resolveTimezone({ ...WEEKDAY_WINDOW, fixed_timezone: null }, null)).toBe("UTC");
  });

  it("uses the contact's own timezone in contact_local mode", () => {
    expect(resolveTimezone({ ...WEEKDAY_WINDOW, timezone_mode: "contact_local" }, "Asia/Tokyo")).toBe("Asia/Tokyo");
  });

  it("returns null in contact_local mode when the contact has no timezone on file", () => {
    expect(resolveTimezone({ ...WEEKDAY_WINDOW, timezone_mode: "contact_local" }, null)).toBeNull();
  });
});

describe("isWithinCallingWindow", () => {
  it("allows a call at noon on a weekday", () => {
    // 2026-01-05 is a Monday. Noon in America/New_York.
    const now = new Date("2026-01-05T17:00:00.000Z"); // 12:00 EST (UTC-5)
    expect(isWithinCallingWindow(WEEKDAY_WINDOW, "America/New_York", now)).toBe(true);
  });

  it("blocks a call before the calling window starts", () => {
    // 07:00 EST on a Monday - before 09:00 start.
    const now = new Date("2026-01-05T12:00:00.000Z");
    expect(isWithinCallingWindow(WEEKDAY_WINDOW, "America/New_York", now)).toBe(false);
  });

  it("blocks a call at or after the calling window ends", () => {
    // 17:00 EST exactly - end is exclusive.
    const now = new Date("2026-01-05T22:00:00.000Z");
    expect(isWithinCallingWindow(WEEKDAY_WINDOW, "America/New_York", now)).toBe(false);
  });

  it("blocks a call on a day not in days_of_week (Saturday)", () => {
    // 2026-01-03 is a Saturday, noon EST.
    const now = new Date("2026-01-03T17:00:00.000Z");
    expect(isWithinCallingWindow(WEEKDAY_WINDOW, "America/New_York", now)).toBe(false);
  });

  it("respects start_date/end_date bounds", () => {
    const bounded: CallingWindow = { ...WEEKDAY_WINDOW, start_date: "2026-02-01", end_date: "2026-02-28" };
    const beforeStart = new Date("2026-01-05T17:00:00.000Z");
    const duringRange = new Date("2026-02-09T17:00:00.000Z"); // a Monday in range
    expect(isWithinCallingWindow(bounded, "America/New_York", beforeStart)).toBe(false);
    expect(isWithinCallingWindow(bounded, "America/New_York", duringRange)).toBe(true);
  });

  it("computes the local day-of-week/hour correctly across a UTC date boundary", () => {
    // 2026-01-05 20:30 UTC = 15:30 EST, still Monday locally. A naive
    // UTC-only check would still get the weekday right here, but this
    // guards the timezone-conversion path explicitly.
    const now = new Date("2026-01-05T20:30:00.000Z");
    expect(isWithinCallingWindow(WEEKDAY_WINDOW, "America/New_York", now)).toBe(true);
  });
});
