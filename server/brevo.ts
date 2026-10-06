import { MAIL_FROM, MAIL_OWNER, LION_MARK_URL, isPlaceholder } from "../shared/event";
import { signDownload, trackedDownloadUrl } from "./downloads";
import { sendEmail } from "./email";
import {
  easternDayAfter,
  formatEastern,
  parseDurationMinutes,
  parseEventStart,
} from "./eventTime";
import { buildDayBeforeReminder, buildHourBeforeReminder, buildWeekBeforeReminder, type ReminderContext } from "./reminders";
import {
  buildFinalLetter,
  buildPostSessionLetter,
  buildReplayLetter,
  buildSequenceStepOne,
  buildSequenceStepThree,
  buildSequenceStepTwo,
  type SequenceContext,
} from "./sequence";
import { unsubscribeUrl } from "./unsubscribe";
import {
  buildFastTrackAgreeing,
  buildFastTrackInside,
  buildFastTrackLast,
  buildFastTrackMorningAfter,
  buildFastTrackStory,
  fastTrackOpenFor,
} from "./fastTrack";

/**
 * Brevo owns the follow-up email now.
 *
 * The app's only jobs are to keep Brevo's contact list accurate and to hand
 * Brevo the finished emails. Brevo does all of the sending and all of the
 * timing, and every email is visible in Brevo before it goes out:
 *
 *  - Contacts: every registrant is copied to the "All registrants" list the
 *    moment they sign up. Once they click the confirmation link they are also
 *    added to the "Nurture" list, which starts the day 2 / 7 / 14 automation.
 *  - Templates: letters one to three are stored as Brevo templates, which the
 *    Brevo automation sends.
 *  - Scheduled campaigns: the two reminders and letters four to six are tied
 *    to the session date, so they are scheduled as ordinary Brevo campaigns
 *    for exact times. Brevo sends them to whoever is on the list at that
 *    moment, so late registrants are included automatically.
 *
 * "Set up in Brevo" on the dashboard runs all of this and is safe to press
 * again at any time: it finds what already exists rather than duplicating it,
 * and replaces scheduled campaigns that have not gone out yet.
 */

const API = "https://api.brevo.com/v3";

export const BREVO_FOLDER_NAME = "What Entrepreneurs Need to Know";
export const BREVO_LIST_ALL = "Webinar: All registrants";
export const BREVO_LIST_NURTURE = "Webinar: Nurture (confirmed)";

/** Internal settings keys. Never exposed on the public settings endpoint. */
export const BREVO_KEYS = {
  listAll: "brevoListAllId",
  listNurture: "brevoListNurtureId",
  templates: "brevoTemplateIds",
  campaigns: "brevoCampaigns",
  lastSetup: "brevoLastSetup",
  lastTest: "brevoLastTest",
} as const;

/** Contact attributes the emails rely on, all stored as text. */
export const BREVO_ATTRIBUTES = [
  "FIRSTNAME",
  "LASTNAME",
  "CONFIRMED",
  "ATTENDED",
  "CHAPTER_OPENED",
  "DL_CHAPTER",
  "TRACK",
  "SIGNUP_DATE",
] as const;

/** Placeholders Brevo fills in per contact at send time. */
const P = {
  firstName: "{{ contact.FIRSTNAME }}",
  unsubscribe: "{{ unsubscribe }}",
};

/* ------------------------------------------------------------------ *
 * Dependencies, injectable so the whole flow is testable without Brevo
 * ------------------------------------------------------------------ */

export type RegistrationLike = {
  email: string;
  firstName: string;
  lastName: string;
  track: string | null;
  confirmedAt: Date | null;
  attendedAt: Date | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
};

export type BrevoIO = {
  fetcher: typeof fetch;
  apiKey: string;
  getSettings: () => Promise<Record<string, string>>;
  setSetting: (key: string, value: string) => Promise<void>;
  listRegistrations: () => Promise<RegistrationLike[]>;
  listDownloads: () => Promise<{ email: string; resource: string }[]>;
  now: () => Date;
};

async function defaultIO(): Promise<BrevoIO> {
  const db = await import("./db");
  return {
    fetcher: fetch,
    apiKey: process.env.BREVO_API_KEY ?? "",
    getSettings: db.getAllEventSettings,
    setSetting: async (key, value) => {
      await db.setEventSetting(key, value);
    },
    listRegistrations: db.listRegistrations as () => Promise<RegistrationLike[]>,
    listDownloads: db.listDownloads,
    now: () => new Date(),
  };
}

/* ------------------------------------------------------------------ *
 * HTTP
 * ------------------------------------------------------------------ */

type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string };

async function api<T = Record<string, unknown>>(
  io: BrevoIO,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  if (!io.apiKey) return { ok: false, status: 0, error: "BREVO_API_KEY is not configured on Render" };
  try {
    const response = await io.fetcher(`${API}${path}`, {
      method,
      headers: {
        "api-key": io.apiKey,
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const raw = await response.text();
    let data: unknown = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { raw };
      }
    }
    if (!response.ok) {
      const message =
        (data as { message?: string }).message ?? (typeof raw === "string" ? raw.slice(0, 200) : "");
      return { ok: false, status: response.status, error: `Brevo ${response.status}: ${message}` };
    }
    return { ok: true, status: response.status, data: data as T };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Could not reach Brevo",
    };
  }
}

/* ------------------------------------------------------------------ *
 * Structure: folder, lists, attributes
 * ------------------------------------------------------------------ */

async function findOrCreateFolder(io: BrevoIO): Promise<number> {
  const found = await api<{ folders?: { id: number; name: string }[] }>(
    io,
    "GET",
    "/contacts/folders?limit=50&offset=0",
  );
  if (!found.ok) throw new Error(found.error);
  const match = found.data.folders?.find(f => f.name === BREVO_FOLDER_NAME);
  if (match) return match.id;
  const created = await api<{ id: number }>(io, "POST", "/contacts/folders", { name: BREVO_FOLDER_NAME });
  if (!created.ok) throw new Error(created.error);
  return created.data.id;
}

async function findOrCreateList(io: BrevoIO, name: string, folderId: number): Promise<number> {
  for (let offset = 0; offset < 1000; offset += 50) {
    const page = await api<{ lists?: { id: number; name: string }[] }>(
      io,
      "GET",
      `/contacts/lists?limit=50&offset=${offset}`,
    );
    if (!page.ok) throw new Error(page.error);
    const lists = page.data.lists ?? [];
    const match = lists.find(l => l.name === name);
    if (match) return match.id;
    if (lists.length < 50) break;
  }
  const created = await api<{ id: number }>(io, "POST", "/contacts/lists", { name, folderId });
  if (!created.ok) throw new Error(created.error);
  return created.data.id;
}

async function ensureAttributes(io: BrevoIO): Promise<string[]> {
  const existing = await api<{ attributes?: { name: string }[] }>(io, "GET", "/contacts/attributes");
  if (!existing.ok) throw new Error(existing.error);
  const have = new Set((existing.data.attributes ?? []).map(a => a.name.toUpperCase()));
  const created: string[] = [];
  for (const name of BREVO_ATTRIBUTES) {
    if (have.has(name)) continue;
    const result = await api(io, "POST", `/contacts/attributes/normal/${name}`, { type: "text" });
    // A race or a stale listing can report "already exists"; that is success.
    if (!result.ok && !/exist|unique/i.test(result.error)) throw new Error(result.error);
    created.push(name);
  }
  return created;
}

/* ------------------------------------------------------------------ *
 * Contacts
 * ------------------------------------------------------------------ */

export function contactPayload(
  row: RegistrationLike,
  input: { listAll: number; listNurture: number; chapterOpened: boolean },
) {
  const email = row.email.trim().toLowerCase();
  const attributes = {
    FIRSTNAME: row.firstName.trim() || "friend",
    LASTNAME: row.lastName.trim(),
    CONFIRMED: row.confirmedAt ? "yes" : "no",
    ATTENDED: row.attendedAt ? "yes" : "no",
    CHAPTER_OPENED: input.chapterOpened ? "yes" : "no",
    DL_CHAPTER: signDownload(email, "chapter"),
    TRACK: row.track ?? "",
    SIGNUP_DATE: new Date(row.createdAt).toISOString().slice(0, 10),
  };
  if (row.unsubscribedAt) {
    // Opted out in the app: Brevo must never mail them, and they join no lists.
    return { email, attributes, emailBlacklisted: true, updateEnabled: true };
  }
  const listIds = row.confirmedAt ? [input.listAll, input.listNurture] : [input.listAll];
  return { email, attributes, listIds, updateEnabled: true };
}

async function upsertContact(io: BrevoIO, payload: ReturnType<typeof contactPayload>) {
  return api(io, "POST", "/contacts", payload);
}

function openedSet(downloads: { email: string; resource: string }[]) {
  return new Set(downloads.filter(d => d.resource === "chapter").map(d => d.email.toLowerCase()));
}

/**
 * Copies one registrant's current state to Brevo. Called after signup,
 * confirmation, attendance changes, unsubscribes and downloads. Never throws:
 * a Brevo hiccup must not break anything a visitor is doing.
 */
export async function syncRegistrantToBrevo(email: string, ioIn?: BrevoIO) {
  try {
    const io = ioIn ?? (await defaultIO());
    if (!io.apiKey) return { ok: false as const, skipped: "no api key" };
    const settings = await io.getSettings();
    const listAll = Number(settings[BREVO_KEYS.listAll]);
    const listNurture = Number(settings[BREVO_KEYS.listNurture]);
    // Until "Set up in Brevo" has run once there are no lists to add people to.
    if (!listAll || !listNurture) return { ok: false as const, skipped: "brevo not set up" };
    const key = email.trim().toLowerCase();
    const row = (await io.listRegistrations()).find(r => r.email.toLowerCase() === key);
    if (!row) return { ok: false as const, skipped: "no registration" };
    const opened = openedSet(await io.listDownloads()).has(key);
    const result = await upsertContact(io, contactPayload(row, { listAll, listNurture, chapterOpened: opened }));
    if (!result.ok) console.error(`[Brevo] Contact sync failed for ${key}: ${result.error}`);
    return result.ok ? { ok: true as const } : { ok: false as const, error: result.error };
  } catch (error) {
    console.error("[Brevo] Contact sync error:", error);
    return { ok: false as const, error: error instanceof Error ? error.message : "unknown" };
  }
}

/** Fire-and-forget wrapper for request handlers. */
export function syncInBackground(email: string) {
  void syncRegistrantToBrevo(email).catch(() => undefined);
}

/* ------------------------------------------------------------------ *
 * Building the Brevo versions of each email
 * ------------------------------------------------------------------ */

/**
 * Two versions of a letter differ in one or two places. Rather than storing
 * two whole documents, keep everything they share and wrap only the part that
 * differs in a Brevo condition. The cut points are moved to tag boundaries so
 * the condition always sits between HTML elements, never inside one.
 */
export function conditionalMerge(condition: string, whenTrue: string, whenFalse: string): string {
  if (whenTrue === whenFalse) return whenTrue;
  let start = 0;
  const max = Math.min(whenTrue.length, whenFalse.length);
  while (start < max && whenTrue[start] === whenFalse[start]) start += 1;
  let endA = whenTrue.length;
  let endB = whenFalse.length;
  while (endA > start && endB > start && whenTrue[endA - 1] === whenFalse[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  // Snap outward to element boundaries.
  const snapStart = whenTrue.lastIndexOf("<tr>", start);
  if (snapStart >= 0) start = snapStart;
  const tailA = whenTrue.indexOf("</tr>", endA);
  const tailB = whenFalse.indexOf("</tr>", endB);
  if (tailA >= 0 && tailB >= 0) {
    const suffixA = whenTrue.slice(tailA + 5);
    const suffixB = whenFalse.slice(tailB + 5);
    if (suffixA === suffixB) {
      endA = tailA + 5;
      endB = tailB + 5;
    }
  }
  return [
    whenTrue.slice(0, start),
    `{% if ${condition} %}`,
    whenTrue.slice(start, endA),
    `{% else %}`,
    whenFalse.slice(start, endB),
    `{% endif %}`,
    whenTrue.slice(endA),
  ].join("");
}

function brevoLetterContext(baseUrl: string, settings: Record<string, string>): SequenceContext {
  return {
    firstName: P.firstName,
    email: "",
    baseUrl,
    logoUrl: baseUrl ? `${baseUrl}${LION_MARK_URL}` : undefined,
    unsubscribeUrl: P.unsubscribe,
    eventDate: settings.date,
    eventTime: settings.time,
    replayUrl: settings.replayUrl,
    chapterUrlOverride: `${baseUrl}/api/download?r=chapter&e={{ contact.EMAIL }}&t={{ contact.DL_CHAPTER }}`,
  };
}

/** Letters one to three, as stored in Brevo for the automation. */
export function buildNurtureTemplates(baseUrl: string, settings: Record<string, string>) {
  const ctx = brevoLetterContext(baseUrl, settings);
  const oneOpened = buildSequenceStepOne({ ...ctx, hasDownloaded: true });
  const oneUnopened = buildSequenceStepOne({ ...ctx, hasDownloaded: false });
  return [
    {
      step: 1,
      name: "WENTK Nurture 1 (day 2): The thing I mentioned",
      subject: oneUnopened.subject,
      html: conditionalMerge('contact.CHAPTER_OPENED == "yes"', oneOpened.html, oneUnopened.html),
    },
    { step: 2, name: "WENTK Nurture 2 (day 7): The one sentence, revisited", ...pick(buildSequenceStepTwo(ctx)) },
    { step: 3, name: "WENTK Nurture 3 (day 14): The announcement", ...pick(buildSequenceStepThree(ctx)) },
  ];
}

function pick(letter: { subject: string; html: string }) {
  return { subject: letter.subject, html: letter.html };
}

export type PlannedCampaign = {
  key:
    | "reminder-week"
    | "reminder-day"
    | "reminder-hour"
    | "letter-4"
    | "letter-5"
    | "letter-6"
    | "fast-track-3"
    | "fast-track-4"
    | "fast-track-5";
  label: string;
  list: "all" | "nurture";
  at: Date;
  subject: string;
  html: string;
};

/**
 * The same Eastern wall-clock time a number of days away. Plain 24-hour
 * arithmetic would drift by an hour when daylight saving changes in between.
 */
function sameEasternClock(start: Date, days: number): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(start);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? "0");
  return easternDayAfter(start, days, get("hour"), get("minute"));
}

/** The six session-anchored emails, with the exact moment each should send. */
export function planEventCampaigns(input: {
  baseUrl: string;
  settings: Record<string, string>;
  start: Date;
}): PlannedCampaign[] {
  const { baseUrl, settings, start } = input;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const reminderCtx: ReminderContext = {
    firstName: P.firstName,
    baseUrl,
    logoUrl: baseUrl ? `${baseUrl}${LION_MARK_URL}` : undefined,
    unsubscribeUrl: P.unsubscribe,
    start,
    durationMinutes: parseDurationMinutes(settings.duration),
    joinUrl: (settings.joinUrl ?? "").trim(),
    passcode: (settings.zoomPasscode ?? "").trim() || undefined,
  };
  const letterCtx = brevoLetterContext(baseUrl, settings);
  const weekBefore = buildWeekBeforeReminder(reminderCtx);
  const dayBefore = buildDayBeforeReminder(reminderCtx);
  const hourBefore = buildHourBeforeReminder(reminderCtx);
  const reminders: PlannedCampaign[] = [
    { key: "reminder-week", label: "Reminder: one week before", list: "all", at: sameEasternClock(start, -7), ...pick(weekBefore) },
    { key: "reminder-day", label: "Reminder: the day before", list: "all", at: new Date(start.getTime() - day), ...pick(dayBefore) },
    { key: "reminder-hour", label: "Reminder: one hour before", list: "all", at: new Date(start.getTime() - hour), ...pick(hourBefore) },
  ];

  /*
   * While the Fast Track is open, everything after the session is the Fast
   * Track arc: every other day from the morning after until the day before
   * enrollment closes, to everyone who registered (not only the nurture list).
   */
  if (fastTrackOpenFor(start)) {
    const ft = { ...letterCtx, clientStory: (settings.clientStory ?? "").trim() };
    const lastAttended = buildFastTrackLast({ ...ft, attended: true });
    const lastMissed = buildFastTrackLast({ ...ft, attended: false });
    return [
      ...reminders,
      { key: "letter-4", label: "Fast Track 1: the morning after", list: "all", at: easternDayAfter(start, 1, 9), ...pick(buildFastTrackMorningAfter(ft)) },
      { key: "letter-5", label: "Fast Track 2: agreeing is not starting", list: "all", at: sameEasternClock(start, 3), ...pick(buildFastTrackAgreeing(ft)) },
      { key: "fast-track-3", label: "Fast Track 3: what thirty days can change", list: "all", at: sameEasternClock(start, 5), ...pick(buildFastTrackStory(ft)) },
      { key: "fast-track-4", label: "Fast Track 4: exactly what is inside", list: "all", at: sameEasternClock(start, 7), ...pick(buildFastTrackInside(ft)) },
      {
        key: "letter-6",
        label: "Fast Track 5: enrollment closes tomorrow",
        list: "all",
        at: sameEasternClock(start, 9),
        subject: lastMissed.subject,
        html: conditionalMerge('contact.ATTENDED == "yes"', lastAttended.html, lastMissed.html),
      },
    ];
  }

  const replay = buildReplayLetter(letterCtx);
  const five = buildPostSessionLetter(letterCtx);
  const sixAttended = buildFinalLetter({ ...letterCtx, attended: true });
  const sixMissed = buildFinalLetter({ ...letterCtx, attended: false });
  return [
    ...reminders,
    { key: "letter-4", label: "Letter 4: the morning after", list: "all", at: easternDayAfter(start, 1, 9), ...pick(replay) },
    { key: "letter-5", label: "Letter 5: three days after", list: "nurture", at: new Date(start.getTime() + 3 * day), ...pick(five) },
    {
      key: "letter-6",
      label: "Letter 6: the last letter",
      list: "nurture",
      at: new Date(start.getTime() + 7 * day),
      subject: sixMissed.subject,
      html: conditionalMerge('contact.ATTENDED == "yes"', sixAttended.html, sixMissed.html),
    },
  ];
}

/* ------------------------------------------------------------------ *
 * Setup
 * ------------------------------------------------------------------ */

export type SetupReport = {
  ok: boolean;
  ranAt: string;
  error?: string;
  warnings: string[];
  event: { startsAt: string; label: string } | null;
  lists: { all: number; nurture: number } | null;
  contacts: { synced: number; failed: number; errors: string[] };
  templates: { step: number; id: number; name: string }[];
  campaigns: {
    key: string;
    label: string;
    id?: number;
    scheduledFor: string;
    status: string;
    list: string;
    note?: string;
  }[];
};

type StoredCampaigns = { eventStart: string; items: { key: string; id: number }[] };

const SENDER = { name: MAIL_FROM.name, email: MAIL_FROM.email };

function resolveBase(settings: Record<string, string>, fallback: string) {
  const configured = (settings.publicSiteUrl ?? "").trim() || process.env.PUBLIC_URL || fallback;
  if (!configured) return "";
  const withScheme = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
  return withScheme.replace(/\/+$/, "");
}

async function upsertTemplate(
  io: BrevoIO,
  existingId: number | undefined,
  template: { name: string; subject: string; html: string },
): Promise<number> {
  const body = {
    templateName: template.name,
    subject: template.subject,
    htmlContent: template.html,
    sender: SENDER,
    replyTo: MAIL_FROM.email,
    isActive: true,
    tag: "webinar-nurture",
  };
  if (existingId) {
    const updated = await api(io, "PUT", `/smtp/templates/${existingId}`, body);
    if (updated.ok) return existingId;
    if (updated.status !== 404) throw new Error(updated.error);
  }
  const created = await api<{ id: number }>(io, "POST", "/smtp/templates", body);
  if (!created.ok) throw new Error(created.error);
  return created.data.id;
}

/** Deletes a stored campaign only if it has not been sent. Sent ones keep their stats. */
async function retireUnsentCampaign(io: BrevoIO, id: number) {
  const current = await api<{ status?: string }>(io, "GET", `/emailCampaigns/${id}`);
  if (!current.ok) return; // already gone
  if (["draft", "queued", "suspended"].includes(current.data.status ?? "")) {
    await api(io, "DELETE", `/emailCampaigns/${id}`);
  }
}

async function createScheduledCampaign(
  io: BrevoIO,
  campaign: PlannedCampaign,
  listId: number,
  dateTag: string,
) {
  const created = await api<{ id: number }>(io, "POST", "/emailCampaigns", {
    name: `WENTK ${dateTag} | ${campaign.label}`,
    subject: campaign.subject,
    sender: SENDER,
    replyTo: MAIL_FROM.email,
    htmlContent: campaign.html,
    recipients: { listIds: [listId] },
    scheduledAt: campaign.at.toISOString(),
    // No campaign tag: Brevo's free plan refuses the whole campaign (405)
    // when one is sent. The "WENTK" name prefix keeps them easy to find.
  });
  if (!created.ok) throw new Error(created.error);
  const id = created.data.id;
  let status = await api<{ status?: string }>(io, "GET", `/emailCampaigns/${id}`);
  // Some accounts create a scheduled campaign as a draft; confirm the schedule.
  if (status.ok && status.data.status === "draft") {
    await api(io, "PUT", `/emailCampaigns/${id}/status`, { status: "queued" });
    status = await api<{ status?: string }>(io, "GET", `/emailCampaigns/${id}`);
  }
  return { id, status: status.ok ? (status.data.status ?? "unknown") : "unknown" };
}

/**
 * Builds or refreshes everything in Brevo. Safe to run repeatedly: press it
 * after changing the date, the Zoom link, or the replay link.
 */
export async function setupBrevo(options: { requestOrigin?: string; io?: BrevoIO } = {}): Promise<SetupReport> {
  const io = options.io ?? (await defaultIO());
  const report: SetupReport = {
    ok: false,
    ranAt: io.now().toISOString(),
    warnings: [],
    event: null,
    lists: null,
    contacts: { synced: 0, failed: 0, errors: [] },
    templates: [],
    campaigns: [],
  };
  const finish = async (r: SetupReport) => {
    await io.setSetting(BREVO_KEYS.lastSetup, JSON.stringify(r)).catch(() => undefined);
    return r;
  };

  try {
    if (!io.apiKey) throw new Error("BREVO_API_KEY is not configured on Render");
    const settings = await io.getSettings();
    const baseUrl = resolveBase(settings, options.requestOrigin ?? "");
    if (!baseUrl) report.warnings.push("No public web address is saved, so links in emails may not work.");

    // 1. Lists and attributes.
    const folderId = await findOrCreateFolder(io);
    const listAll = await findOrCreateList(io, BREVO_LIST_ALL, folderId);
    const listNurture = await findOrCreateList(io, BREVO_LIST_NURTURE, folderId);
    await io.setSetting(BREVO_KEYS.listAll, String(listAll));
    await io.setSetting(BREVO_KEYS.listNurture, String(listNurture));
    report.lists = { all: listAll, nurture: listNurture };
    await ensureAttributes(io);

    // 2. Everyone who has registered so far.
    const [rows, downloads] = await Promise.all([io.listRegistrations(), io.listDownloads()]);
    const opened = openedSet(downloads);
    for (const row of rows) {
      const result = await upsertContact(
        io,
        contactPayload(row, { listAll, listNurture, chapterOpened: opened.has(row.email.toLowerCase()) }),
      );
      if (result.ok) report.contacts.synced += 1;
      else {
        report.contacts.failed += 1;
        if (report.contacts.errors.length < 3) report.contacts.errors.push(`${row.email}: ${result.error}`);
      }
    }
    // Tabitha as a contact (on no list), so Brevo's test sends can greet her by name.
    await upsertContact(io, {
      email: MAIL_OWNER,
      attributes: {
        FIRSTNAME: "Tabitha",
        LASTNAME: "Rector",
        CONFIRMED: "yes",
        ATTENDED: "no",
        CHAPTER_OPENED: "no",
        DL_CHAPTER: signDownload(MAIL_OWNER, "chapter"),
        TRACK: "",
        SIGNUP_DATE: io.now().toISOString().slice(0, 10),
      },
      updateEnabled: true,
    } as never);

    // 3. Letters one to three as templates, for the automation.
    const storedTemplates = safeJson<Record<string, number>>(settings[BREVO_KEYS.templates]) ?? {};
    const templateIds: Record<string, number> = {};
    for (const template of buildNurtureTemplates(baseUrl, settings)) {
      const id = await upsertTemplate(io, storedTemplates[String(template.step)], template);
      templateIds[String(template.step)] = id;
      report.templates.push({ step: template.step, id, name: template.name });
    }
    await io.setSetting(BREVO_KEYS.templates, JSON.stringify(templateIds));

    // 4. The session-anchored emails.
    const start = parseEventStart(settings.date, settings.time);
    const stored = safeJson<StoredCampaigns>(settings[BREVO_KEYS.campaigns]);
    if (!start) {
      report.warnings.push(
        isPlaceholder(settings.date)
          ? "No session date is set, so no reminders were scheduled."
          : `Could not read the date and time ("${settings.date}" / "${settings.time}"). Nothing was scheduled.`,
      );
    } else {
      report.event = { startsAt: start.toISOString(), label: formatEastern(start) };
      const joinUrl = (settings.joinUrl ?? "").trim();
      if (!joinUrl) report.warnings.push("No Zoom join link is saved, so the reminders were not scheduled.");
      if (!(settings.zoomPasscode ?? "").trim()) {
        report.warnings.push("No Zoom passcode is saved. The reminders will show the meeting ID only.");
      }

      // Replace anything from an earlier run that has not gone out yet.
      for (const item of stored?.items ?? []) await retireUnsentCampaign(io, item.id);

      const items: StoredCampaigns["items"] = [];
      const dateTag = start.toISOString().slice(0, 10);
      const soonest = io.now().getTime() + 5 * 60 * 1000;
      for (const campaign of planEventCampaigns({ baseUrl, settings, start })) {
        const base = {
          key: campaign.key,
          label: campaign.label,
          scheduledFor: formatEastern(campaign.at),
          list: campaign.list === "all" ? BREVO_LIST_ALL : BREVO_LIST_NURTURE,
        };
        if (campaign.key.startsWith("reminder") && !joinUrl) {
          report.campaigns.push({ ...base, status: "not scheduled", note: "Needs the Zoom join link" });
          continue;
        }
        if (campaign.at.getTime() < soonest) {
          report.campaigns.push({ ...base, status: "skipped", note: "That time has already passed" });
          continue;
        }
        const listId = campaign.list === "all" ? listAll : listNurture;
        const created = await createScheduledCampaign(io, campaign, listId, dateTag);
        items.push({ key: campaign.key, id: created.id });
        report.campaigns.push({ ...base, id: created.id, status: created.status });
      }
      // Keep ids of earlier campaigns for this same session that already went out.
      const kept = stored && stored.eventStart === start.toISOString() ? stored.items.filter(i => !items.some(n => n.key === i.key)) : [];
      await io.setSetting(
        BREVO_KEYS.campaigns,
        JSON.stringify({ eventStart: start.toISOString(), items: [...kept, ...items] }),
      );
      const notQueued = report.campaigns.filter(c => c.id && c.status !== "queued");
      if (notQueued.length) {
        report.warnings.push(
          `Brevo reports ${notQueued.length} campaign(s) as "${notQueued[0].status}" rather than scheduled. Check the Campaigns page in Brevo.`,
        );
      }
    }

    if (report.contacts.failed) {
      report.warnings.push(`${report.contacts.failed} contact(s) could not be copied to Brevo.`);
    }
    report.ok = true;
    return finish(report);
  } catch (error) {
    report.error = error instanceof Error ? error.message : "Unknown error";
    return finish(report);
  }
}

function safeJson<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Tests: send every email to Tabitha, exactly as Brevo holds it
 * ------------------------------------------------------------------ */

export type TestReport = {
  ranAt: string;
  to: string;
  results: { label: string; ok: boolean; via: "brevo" | "direct"; detail?: string }[];
};

/**
 * Sends each stored template and scheduled campaign to Tabitha through Brevo's
 * own test-send, so what she reads is exactly what Brevo will send, with the
 * placeholders filled in. If Brevo refuses a test send, the same email is
 * rendered here and sent directly instead, and the report says which.
 */
export async function sendBrevoTests(options: { requestOrigin?: string; io?: BrevoIO } = {}): Promise<TestReport> {
  const io = options.io ?? (await defaultIO());
  const to = MAIL_OWNER;
  const report: TestReport = { ranAt: io.now().toISOString(), to, results: [] };
  const settings = await io.getSettings();
  const baseUrl = resolveBase(settings, options.requestOrigin ?? "");
  const templates = safeJson<Record<string, number>>(settings[BREVO_KEYS.templates]) ?? {};
  const campaigns = safeJson<StoredCampaigns>(settings[BREVO_KEYS.campaigns]);
  const start = parseEventStart(settings.date, settings.time);

  const directCtx: SequenceContext = {
    firstName: "Tabitha",
    email: to,
    baseUrl,
    logoUrl: baseUrl ? `${baseUrl}${LION_MARK_URL}` : undefined,
    unsubscribeUrl: unsubscribeUrl(baseUrl, to),
    eventDate: settings.date,
    eventTime: settings.time,
    replayUrl: settings.replayUrl,
    chapterUrlOverride: trackedDownloadUrl(baseUrl, "chapter", to),
  };

  const direct = async (label: string, letter: { subject: string; html: string; text: string }, why: string) => {
    const sent = await sendEmail({
      to: { email: to, name: "Tabitha Rector" },
      subject: `[Test] ${letter.subject}`,
      html: letter.html,
      text: letter.text,
      tags: ["brevo-test"],
    });
    report.results.push({
      label,
      ok: sent.ok,
      via: "direct",
      detail: sent.ok ? `Sent directly (${why})` : sent.error,
    });
  };

  const nurture: Record<string, { label: string; build: () => { subject: string; html: string; text: string } }> = {
    "1": { label: "Nurture 1 (day 2)", build: () => buildSequenceStepOne(directCtx) },
    "2": { label: "Nurture 2 (day 7)", build: () => buildSequenceStepTwo(directCtx) },
    "3": { label: "Nurture 3 (day 14)", build: () => buildSequenceStepThree(directCtx) },
  };
  for (const [step, info] of Object.entries(nurture)) {
    const id = templates[step];
    if (!id) {
      await direct(info.label, info.build(), "not set up in Brevo yet");
      continue;
    }
    const result = await api(io, "POST", `/smtp/templates/${id}/sendTest`, { emailTo: [to] });
    if (result.ok) report.results.push({ label: info.label, ok: true, via: "brevo" });
    else await direct(info.label, info.build(), `Brevo test failed: ${result.error}`);
  }

  if (start) {
    const reminderCtx: ReminderContext = {
      firstName: "Tabitha",
      baseUrl,
      logoUrl: directCtx.logoUrl,
      unsubscribeUrl: directCtx.unsubscribeUrl,
      start,
      durationMinutes: parseDurationMinutes(settings.duration),
      joinUrl: (settings.joinUrl ?? "").trim(),
      passcode: (settings.zoomPasscode ?? "").trim() || undefined,
    };
    const eventEmails: Record<string, { label: string; build: () => { subject: string; html: string; text: string } }> = {
      "reminder-week": { label: "Reminder: one week before", build: () => buildWeekBeforeReminder(reminderCtx) },
      "reminder-day": { label: "Reminder: the day before", build: () => buildDayBeforeReminder(reminderCtx) },
      "reminder-hour": { label: "Reminder: one hour before", build: () => buildHourBeforeReminder(reminderCtx) },
      ...(fastTrackOpenFor(start)
        ? (() => {
            const ft = { ...directCtx, clientStory: (settings.clientStory ?? "").trim() };
            return {
              "letter-4": { label: "Fast Track 1: the morning after", build: () => buildFastTrackMorningAfter(ft) },
              "letter-5": { label: "Fast Track 2: agreeing is not starting", build: () => buildFastTrackAgreeing(ft) },
              "fast-track-3": { label: "Fast Track 3: what thirty days can change", build: () => buildFastTrackStory(ft) },
              "fast-track-4": { label: "Fast Track 4: exactly what is inside", build: () => buildFastTrackInside(ft) },
              "letter-6": { label: "Fast Track 5: enrollment closes tomorrow", build: () => buildFastTrackLast(ft) },
            };
          })()
        : {
            "letter-4": { label: "Letter 4: the morning after", build: () => buildReplayLetter(directCtx) },
            "letter-5": { label: "Letter 5: three days after", build: () => buildPostSessionLetter(directCtx) },
            "letter-6": { label: "Letter 6: the last letter", build: () => buildFinalLetter(directCtx) },
          }),
    };
    for (const [key, info] of Object.entries(eventEmails)) {
      if (key.startsWith("reminder") && !reminderCtx.joinUrl) {
        report.results.push({ label: info.label, ok: false, via: "direct", detail: "No Zoom join link saved" });
        continue;
      }
      const id = campaigns?.items.find(i => i.key === key)?.id;
      if (!id) {
        await direct(info.label, info.build(), "not scheduled in Brevo");
        continue;
      }
      const result = await api(io, "POST", `/emailCampaigns/${id}/sendTest`, { emailTo: [to] });
      if (result.ok) report.results.push({ label: info.label, ok: true, via: "brevo" });
      else await direct(info.label, info.build(), `Brevo test failed: ${result.error}`);
    }
  } else {
    report.results.push({
      label: "Reminders and letters 4 to 6",
      ok: false,
      via: "direct",
      detail: "No readable session date, so there is nothing to test yet",
    });
  }

  await io.setSetting(BREVO_KEYS.lastTest, JSON.stringify(report)).catch(() => undefined);
  return report;
}

/** What the dashboard shows before anything is pressed. */
export async function brevoStatus(ioIn?: BrevoIO) {
  const io = ioIn ?? (await defaultIO());
  const settings = await io.getSettings();
  const start = parseEventStart(settings.date, settings.time);
  const joinUrl = (settings.joinUrl ?? "").trim();
  return {
    hasApiKey: Boolean(io.apiKey),
    event: start ? { startsAt: start.toISOString(), label: formatEastern(start) } : null,
    dateText: settings.date ?? "",
    timeText: settings.time ?? "",
    hasJoinUrl: Boolean(joinUrl),
    hasPasscode: Boolean((settings.zoomPasscode ?? "").trim()),
    lastSetup: safeJson<SetupReport>(settings[BREVO_KEYS.lastSetup]),
    lastTest: safeJson<TestReport>(settings[BREVO_KEYS.lastTest]),
  };
}
