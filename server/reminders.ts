import { CORE_PROMISE_SHORT, READINESS_CHECKLIST } from "../shared/event";
import { formatEastern, formatEasternClock, parseDurationMinutes, parseEventStart } from "./eventTime";
import { C, DISPLAY, SANS, SERIF, buttonRow, escapeHtml, paragraph, pullQuote, shell } from "./sequence";

/**
 * The pre-session reminders: one week before, the day before, one hour before,
 * and fifteen minutes before.
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

/* ------------------------------------------------------------------ *
 * The confirmation email's "your seat" block
 * ------------------------------------------------------------------ */

export type SessionDetails = {
  start: Date;
  durationMinutes: number;
  joinUrl: string;
  passcode?: string;
};

/**
 * The session as the dashboard describes it, but only while it is still ahead.
 * A past date returns null, so nobody who confirms after the session is told
 * to join a meeting that has already happened.
 */
export function upcomingSession(settings: Record<string, string>, now: Date = new Date()): SessionDetails | null {
  const start = parseEventStart(settings.date, settings.time);
  if (!start || start.getTime() <= now.getTime()) return null;
  return {
    start,
    durationMinutes: parseDurationMinutes(settings.duration),
    joinUrl: (settings.joinUrl ?? "").trim(),
    passcode: (settings.zoomPasscode ?? "").trim() || undefined,
  };
}

/**
 * Date, Zoom button, meeting ID, passcode and calendar link, as rows that drop
 * straight into the confirmation email. Without a saved join link it still
 * shows the date and says the link is coming, rather than a dead button.
 */
export function seatBlock(session: SessionDetails): { when: string; html: string; text: string[] } {
  const ctx: ReminderContext = { firstName: "", baseUrl: "", ...session };
  const when = formatEastern(session.start);
  const calendarUrl = googleCalendarUrl(ctx);
  const calendarRow = `<tr><td style="padding:14px 36px 0;"><p style="margin:0;font-family:${SANS};font-size:13px;"><a href="${escapeHtml(calendarUrl)}" style="color:${C.navy};text-decoration:underline;">Add it to your Google Calendar</a></p></td></tr>`;
  if (!session.joinUrl) {
    return {
      when,
      html: [
        sessionCard(ctx),
        calendarRow,
        paragraph(`Your Zoom link will arrive after confirmation, then again the day before, one hour before, and fifteen minutes before we start.`),
      ].join(""),
      text: [
        `What Entrepreneurs Need to Know`,
        when,
        `${session.durationMinutes} minutes, live on Zoom`,
        ``,
        `Add it to your Google Calendar: ${calendarUrl}`,
        ``,
        `Your Zoom link will arrive after confirmation, then again the day before, one hour before, and fifteen minutes before we start.`,
      ],
    };
  }
  return {
    when,
    html: [
      sessionCard(ctx),
      buttonRow("Join on Zoom", session.joinUrl),
      zoomDetails(ctx),
      calendarRow,
      paragraph(`I will send this link again one week before, the day before, and one hour before we start, so you will not have to hunt for it.`),
    ].join(""),
    text: [
      `What Entrepreneurs Need to Know`,
      when,
      `${session.durationMinutes} minutes, live on Zoom`,
      ``,
      `Join on Zoom: ${session.joinUrl}`,
      ...zoomDetailsText(ctx),
      ``,
      `Add it to your Google Calendar: ${calendarUrl}`,
      ``,
      `I will send this link again one week before, the day before, and one hour before we start, so you will not have to hunt for it.`,
    ],
  };
}

/** The first reminder: one week before. */
export function buildWeekBeforeReminder(ctx: ReminderContext) {
  const calendarUrl = googleCalendarUrl(ctx);
  const body = [
    paragraph(
      `${escapeHtml(ctx.firstName)}, a week from today we walk the whole sequence together: the eight systems every business runs on, the order to build them in, and where AI belongs once the human decisions are settled.`,
    ),
    sessionCard(ctx),
    pullQuote(escapeHtml(CORE_PROMISE_SHORT)),
    paragraph(
      `If the hour is not on your calendar yet, now is the moment. The founders who protect the time are the ones who show up.`,
    ),
    buttonRow("Join on Zoom", ctx.joinUrl),
    zoomDetails(ctx),
    `<tr><td style="padding:14px 36px 0;"><p style="margin:0;font-family:${SANS};font-size:13px;"><a href="${escapeHtml(calendarUrl)}" style="color:${C.navy};text-decoration:underline;">Add it to your Google Calendar</a></p></td></tr>`,
  ].join("");

  const text = [
    `${ctx.firstName}, a week from today we walk the whole sequence together: the eight systems every business runs on, the order to build them in, and where AI belongs once the human decisions are settled.`,
    ``,
    `What Entrepreneurs Need to Know`,
    formatEastern(ctx.start),
    `${ctx.durationMinutes} minutes, live on Zoom`,
    ``,
    CORE_PROMISE_SHORT,
    ``,
    `If the hour is not on your calendar yet, now is the moment. The founders who protect the time are the ones who show up.`,
    ``,
    `Join on Zoom: ${ctx.joinUrl}`,
    ...zoomDetailsText(ctx),
    ``,
    `Add it to your Google Calendar: ${calendarUrl}`,
    ...signOffText(ctx),
  ].join("\n");

  return {
    subject: "One week from today: What Entrepreneurs Need to Know",
    html: shell({
      preheader: "One week from today. Your Zoom link is inside.",
      heading: "One week from today.",
      bodyHtml: body,
      baseUrl: ctx.baseUrl,
      logoUrl: ctx.logoUrl,
      unsubscribeUrl: ctx.unsubscribeUrl,
      footerNote: FOOTER,
    }),
    text,
  };
}

/** Reminder two: the day before. */
export function buildDayBeforeReminder(ctx: ReminderContext) {
  const clock = formatEasternClock(ctx.start);
  const calendarUrl = googleCalendarUrl(ctx);
  const body = [
    paragraph(
      `${escapeHtml(ctx.firstName)}, tomorrow we gather for Finding the Gap. If you've been working hard without the progress you hoped for, you are not alone. Come ready to identify one wise next step.`,
    ),
    sessionCard(ctx),
    buttonRow("Join on Zoom", ctx.joinUrl),
    zoomDetails(ctx),
    `<tr><td style="padding:14px 36px 0;"><p style="margin:0;font-family:${SANS};font-size:13px;"><a href="${escapeHtml(calendarUrl)}" style="color:${C.navy};text-decoration:underline;">Add it to your Google Calendar</a></p></td></tr>`,
    paragraph(
      `Bring a notebook and your questions. You do not need to have everything figured out before we meet.`,
    ),
    paragraph(
      `Everyone who attends live receives the ${escapeHtml(READINESS_CHECKLIST.title)} afterward. It is my thank-you for showing up.`,
    ),
  ].join("");

  const text = [
    `${ctx.firstName}, tomorrow we gather for Finding the Gap. You are not alone; come ready to identify one wise next step.`,
    ``,
    `Finding the Gap`,
    formatEastern(ctx.start),
    `${ctx.durationMinutes} minutes, live on Zoom`,
    ``,
    `Join on Zoom: ${ctx.joinUrl}`,
    ...zoomDetailsText(ctx),
    ``,
    `Add it to your Google Calendar: ${calendarUrl}`,
    ``,
    `Bring a notebook and your questions. You do not need to have everything figured out before we meet.`,
    ``,
    `Everyone who attends live receives the ${READINESS_CHECKLIST.title} afterward. It is my thank-you for showing up.`,
    ...signOffText(ctx),
  ].join("\n");

  return {
    subject: `Tomorrow, let's find your gap — your ${clock} Zoom link`,
    html: shell({
      preheader: "Finding the Gap begins tomorrow. Your private Zoom link is here.",
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

/** Reminder three: one hour before. */
export function buildHourBeforeReminder(ctx: ReminderContext) {
  const clock = formatEasternClock(ctx.start);
  const body = [
    paragraph(
      `${escapeHtml(ctx.firstName)}, Finding the Gap begins in one hour at ${escapeHtml(clock)}. You have something valuable to offer. Make this hour a gift of clarity to yourself.`,
    ),
    buttonRow("Join the session", ctx.joinUrl),
    zoomDetails(ctx),
    paragraph(
      `If the link gives you any trouble, open Zoom, choose Join, and type in the meeting ID and passcode above.`,
    ),
    paragraph(`Have something to write with nearby. I will see you shortly.`),
  ].join("");

  const text = [
    `${ctx.firstName}, Finding the Gap begins in one hour at ${clock}. Your experience matters. Join a few minutes early so Zoom has time to connect.`,
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
    subject: "Finding the Gap begins in one hour — your Zoom link",
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

/** Final reminder: fifteen minutes before the session. */
export function buildFifteenBeforeReminder(ctx: ReminderContext) {
  const clock = formatEasternClock(ctx.start);
  const body = [
    paragraph(`${escapeHtml(ctx.firstName)}, we begin in fifteen minutes. I am looking forward to welcoming you. You do not need to have everything figured out before you come.`),
    buttonRow("Join the webinar now", ctx.joinUrl),
    zoomDetails(ctx),
    paragraph("If the link gives you trouble, open Zoom and enter the meeting ID and passcode above. Bring a notebook and a little breathing room."),
  ].join("");

  const text = [
    `${ctx.firstName}, we begin in fifteen minutes at ${clock}. You do not need to have everything figured out before you come.`,
    "",
    `Join the webinar now: ${ctx.joinUrl}`,
    ...zoomDetailsText(ctx),
    "",
    "Bring a notebook. I look forward to seeing you.",
    ...signOffText(ctx),
  ].join("\n");

  return {
    subject: "We begin in 15 minutes — your Zoom link is here",
    html: shell({
      preheader: "Come as you are. Join the live session in a few minutes.",
      heading: "Your place is ready.",
      bodyHtml: body,
      baseUrl: ctx.baseUrl,
      logoUrl: ctx.logoUrl,
      unsubscribeUrl: ctx.unsubscribeUrl,
      footerNote: FOOTER,
    }),
    text,
  };
}
