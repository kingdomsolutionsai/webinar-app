import { isPlaceholder } from "../shared/event";

/**
 * Turns the free-text Date and Time fields from the dashboard into a real
 * moment in time, in US Eastern time.
 *
 * The fields are written for people ("Tuesday, October 20,2026" and
 * "11AM-11:45AM"), so this accepts the shapes people actually type rather
 * than asking Tabitha to type something a computer prefers. Every scheduled
 * Brevo email is computed from the result, so this must never guess: when
 * either field cannot be read, it returns null and nothing gets scheduled.
 */

export const EVENT_TIME_ZONE = "America/New_York";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** "Tuesday, October 20,2026" / "Oct 20 2026" / "October 20th, 2026" -> {y, m, d}. */
export function parseEventDate(raw: string | null | undefined) {
  if (!raw || isPlaceholder(raw)) return null;
  const match = raw
    .toLowerCase()
    .match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})/);
  if (!match) return null;
  const month = MONTHS.findIndex(name => name.startsWith(match[1].slice(0, 3)));
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 0 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * The start time from a free-text time field. A range ("11AM-11:45AM") starts
 * at its first half; a trailing zone ("ET") is ignored because the session is
 * always held in Eastern time.
 */
export function parseEventStartTime(raw: string | null | undefined) {
  if (!raw || isPlaceholder(raw)) return null;
  let t = raw.trim().replace(/\b(ET|EST|EDT|EASTERN( TIME)?)\.?\s*$/i, "").trim();
  const parts = t.split(/\s*[-–—]\s*|\s+to\s+/i);
  let first = parts[0]?.trim() ?? "";
  const second = parts[1]?.trim() ?? "";
  const meridiem = /([ap])\.?\s*m\.?$/i;
  if (!meridiem.test(first) && meridiem.test(second)) {
    first = `${first} ${second.match(meridiem)![0]}`;
  }
  t = first.toLowerCase();
  if (t === "noon") return { hour: 12, minute: 0 };
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?$/);
  if (!m) {
    // 24-hour clock ("14:00").
    const h24 = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!h24) return null;
    const hour = Number(h24[1]);
    const minute = Number(h24[2]);
    return hour < 24 && minute < 60 ? { hour, minute } : null;
  }
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? "0");
  if (hour < 1 || hour > 12 || minute > 59) return null;
  const pm = m[3] === "p";
  if (hour === 12) hour = pm ? 12 : 0;
  else if (pm) hour += 12;
  return { hour, minute };
}

/** "45 MINUTES" / "1 hour" / "90 min" -> minutes. Defaults to 60 when unreadable. */
export function parseDurationMinutes(raw: string | null | undefined): number {
  if (!raw || isPlaceholder(raw)) return 60;
  const text = raw.toLowerCase();
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/);
  const mins = text.match(/(\d+)\s*(m|min|mins|minute|minutes)\b/);
  const total = (hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0);
  return total > 0 ? Math.round(total) : 60;
}

/** Offset of the zone from UTC at a given instant, in minutes (EDT = -240). */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** A wall-clock time in Eastern time, as a real instant. Handles EDT and EST. */
export function easternToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const naive = Date.UTC(year, month, day, hour, minute);
  let offset = zoneOffsetMinutes(new Date(naive), EVENT_TIME_ZONE);
  let result = naive - offset * 60000;
  // Second pass settles the rare case where the first guess crossed a DST change.
  offset = zoneOffsetMinutes(new Date(result), EVENT_TIME_ZONE);
  result = naive - offset * 60000;
  return new Date(result);
}

/** When the session starts, or null if the dashboard fields cannot be read. */
export function parseEventStart(
  date: string | null | undefined,
  time: string | null | undefined,
): Date | null {
  const d = parseEventDate(date);
  const t = parseEventStartTime(time);
  if (!d || !t) return null;
  return easternToUtc(d.year, d.month, d.day, t.hour, t.minute);
}

/** The calendar day after the session, at the given Eastern hour. */
export function easternDayAfter(start: Date, days: number, hour: number, minute = 0): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(start);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? "0");
  return easternToUtc(get("year"), get("month") - 1, get("day") + days, hour, minute);
}

/** "Tuesday, October 20, 2026 at 11:00 AM ET", for the dashboard and emails. */
export function formatEastern(instant: Date): string {
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
  return `${text.replace(/, (\d{1,2}:\d{2})/, " at $1")} ET`;
}

/** "11:00 AM ET" */
export function formatEasternClock(instant: Date): string {
  return `${new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(instant)} ET`;
}

/** Brevo wants an ISO timestamp with an explicit offset. */
export function toBrevoTimestamp(instant: Date): string {
  return instant.toISOString();
}
