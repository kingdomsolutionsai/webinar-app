import { READINESS_CHECKLIST } from "../shared/event";
import { formatEastern, formatEasternClock } from "./eventTime";
import { C, DISPLAY, SANS, SERIF, buttonRow, escapeHtml, paragraph, shell } from "./sequence";

/**
 * The two pre-session reminders: the day before, and one hour before.
 *
 * Both carry the Zoom link, the meeting ID and the passcode, so someone whose
 * link misbehaves can still get in by typing the numbers. Nothing here is
 * clever on purpose: a reminder has one job, which is getting a person into
 * the room on time.
 */

export type ReminderContext = {
  /** A real name for previews, or a Brevo placeholder for the stored campaign. */
  firstName: string;
  baseUrl: string;
  logoUrl?: string;
  unsubscribeUrl?: string;
  start: Date;
  durationMinutes: number;
  joinUrl: string;
  passcode?: string;
};

const FOOTER = "You are receiving this because you registered for the live session.";

/** "https://us06web.zoom.us/j/83153745263?pwd=..." -> "831 5374 5263" */
export function zoomMeetingId(joinUrl: string): string | null {
  const match = joinUrl.match(/\/(?:j|w|s)\/(\d{9,11})/);
  if (!match) return null;
  const id = match[1];
  if (id.length === 11) return `${id.slice(0, 3)} ${id.slice(3, 7)} ${id.slice(7)}`;
  if (id.length === 10) return `${id.slice(0, 3)} ${id.slice(3, 6)} ${id.slice(6)}`;
  return `${id.slice(0, 3)} ${id.slice(3, 6)} ${id.slice(6)}`;
}

function googleCalendarUrl(ctx: ReminderContext): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(ctx.start.getTime() + ctx.durationMinutes * 60000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "What Entrepreneurs Need to Know (live with Tabitha Rector)",
    dates: `${stamp(ctx.start)}/${stamp(end)}`,
    details: `Join on Zoom: ${ctx.joinUrl}`,
    location: ctx.joinUrl,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function sessionCard(ctx: ReminderContext) {
  return `<tr><td style="padding:24px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.gold};background-color:${C.goldTint};"><tr><td style="padding:24px 28px;text-align:center;">
    <div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9A7B12;">What Entrepreneurs Need to Know</div>
    <p style="margin:12px 0 0;font-family:${DISPLAY};font-size:21px;line-height:1.35;font-weight:700;color:${C.navy};">${escapeHtml(formatEastern(ctx.start))}</p>
    <p style="margin:8px 0 0;font-family:${SERIF};font-size:16px;color:${C.muted};">${ctx.durationMinutes} minutes, live on Zoom</p>
  </td></tr></table></td></tr>`;
}

function zoomDetails(ctx: ReminderContext) {
  const id = zoomMeetingId(ctx.joinUrl);
  const bits = [
    id ? `Meeting ID: <strong>${escapeHtml(id)}</strong>` : "",
    ctx.passcode ? `Passcode: <strong>${escapeHtml(ctx.passcode)}</strong>` : "",
  ].filter(Boolean);
  if (!bits.length) return "";
  return `<tr><td style="padding:14px 36px 0;"><p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.7;color:${C.body};">${bits.join("&nbsp;&nbsp;&nbsp;")}</p></td></tr>`;
}

function zoomDetailsText(ctx: ReminderContext): string[] {
  const id = zoomMeetingId(ctx.joinUrl);
  return [
    ...(id ? [`Meeting ID: ${id}`] : []),
    ...(ctx.passcode ? [`Passcode: ${ctx.passcode}`] : []),
  ];
}

function signOffText(ctx: ReminderContext): string[] {
  return [
    ``,
    `Lead well,`,
    `Tabitha Rector`,
    `Founder, Kingdom Solutions AI(TM)`,
    ...(ctx.unsubscribeUrl ? ["", `To stop receiving these: ${ctx.unsubscribeUrl}`] : []),
  ];
}

/** Reminder one: the day before. */
export function buildDayBeforeReminder(ctx: ReminderContext) {
  const clock = formatEasternClock(ctx.start);
  const calendarUrl = googleCalendarUrl(ctx);
  const body = [
    paragraph(
      `${escapeHtml(ctx.firstName)}, tomorrow we walk the whole sequence together. Here is everything you need to get in, so you are not hunting for it in the morning.`,
    ),
    sessionCard(ctx),
    buttonRow("Join on Zoom", ctx.joinUrl),
    zoomDetails(ctx),
    `<tr><td style="padding:14px 36px 0;"><p style="margin:0;font-family:${SANS};font-size:13px;"><a href="${escapeHtml(calendarUrl)}" style="color:${C.navy};text-decoration:underline;">Add it to your Google Calendar</a></p></td></tr>`,
    paragraph(
      `Bring something to write with. There is one exercise, it takes about four minutes, and it is the part most people tell me they remember.`,
    ),
    paragraph(
      `Everyone who attends live receives the ${escapeHtml(READINESS_CHECKLIST.title)} afterward. It is my thank-you for showing up.`,
    ),
  ].join("");

  const text = [
    `${ctx.firstName}, tomorrow we walk the whole sequence together. Here is everything you need to get in.`,
    ``,
    `What Entrepreneurs Need to Know`,
    formatEastern(ctx.start),
    `${ctx.durationMinutes} minutes, live on Zoom`,
    ``,
    `Join on Zoom: ${ctx.joinUrl}`,
    ...zoomDetailsText(ctx),
    ``,
    `Add it to your Google Calendar: ${calendarUrl}`,
    ``,
    `Bring something to write with. There is one exercise, it takes about four minutes, and it is the part most people tell me they remember.`,
    ``,
    `Everyone who attends live receives the ${READINESS_CHECKLIST.title} afterward. It is my thank-you for showing up.`,
    ...signOffText(ctx),
  ].join("\n");

  return {
    subject: `Tomorrow at ${clock}: your Zoom link is inside`,
    html: shell({
      preheader: "Everything you need to join tomorrow's live session.",
      heading: "See you tomorrow.",
      bodyHtml: body,
      baseUrl: ctx.baseUrl,
      logoUrl: ctx.logoUrl,
      unsubscribeUrl: ctx.unsubscribeUrl,
      footerNote: FOOTER,
    }),
    text,
  };
}

/** Reminder two: one hour before. */
export function buildHourBeforeReminder(ctx: ReminderContext) {
  const clock = formatEasternClock(ctx.start);
  const body = [
    paragraph(
      `${escapeHtml(ctx.firstName)}, we go live at ${escapeHtml(clock)}, one hour from now. Click the button a few minutes early so Zoom has time to connect.`,
    ),
    buttonRow("Join the session", ctx.joinUrl),
    zoomDetails(ctx),
    paragraph(
      `If the link gives you any trouble, open Zoom, choose Join, and type in the meeting ID and passcode above.`,
    ),
    paragraph(`Have something to write with nearby. I will see you shortly.`),
  ].join("");

  const text = [
    `${ctx.firstName}, we go live at ${clock}, one hour from now. Join a few minutes early so Zoom has time to connect.`,
    ``,
    `Join the session: ${ctx.joinUrl}`,
    ...zoomDetailsText(ctx),
    ``,
    `If the link gives you any trouble, open Zoom, choose Join, and type in the meeting ID and passcode above.`,
    ``,
    `Have something to write with nearby. I will see you shortly.`,
    ...signOffText(ctx),
  ].join("\n");

  return {
    subject: "Starting in one hour: your Zoom link",
    html: shell({
      preheader: `We go live at ${clock}. Your link is inside.`,
      heading: "We begin in one hour.",
      bodyHtml: body,
      baseUrl: ctx.baseUrl,
      logoUrl: ctx.logoUrl,
      unsubscribeUrl: ctx.unsubscribeUrl,
      footerNote: FOOTER,
    }),
    text,
  };
}
