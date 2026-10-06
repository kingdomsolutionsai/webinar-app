import { describe, expect, it } from "vitest";
import {
  BREVO_KEYS,
  BREVO_LIST_ALL,
  BREVO_LIST_NURTURE,
  conditionalMerge,
  contactPayload,
  planEventCampaigns,
  setupBrevo,
  sendBrevoTests,
  type BrevoIO,
  type RegistrationLike,
} from "./brevo";
import { buildDayBeforeReminder, buildHourBeforeReminder, zoomMeetingId } from "./reminders";
import { parseEventStart } from "./eventTime";
import { FAST_TRACK } from "../shared/event";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const JOIN = "https://us06web.zoom.us/j/83153745263?pwd=lGvfk21qK8g6QaUmamKTwmqxUZTeda.1";

const SETTINGS = {
  date: "Tuesday, October 20,2026",
  time: "11AM-11:45AM",
  duration: "45 MINUTES",
  price: "Free",
  joinUrl: JOIN,
  zoomPasscode: "480462",
  publicSiteUrl: "https://www.whatentrepreneursneedtoknow.com",
};

/* ------------------------------------------------------------------ *
 * A small in-memory stand-in for the Brevo API
 * ------------------------------------------------------------------ */
function fakeBrevo() {
  let nextId = 100;
  const folders: { id: number; name: string }[] = [];
  const lists: { id: number; name: string; folderId: number }[] = [];
  const attributes = new Set(["FIRSTNAME", "LASTNAME", "EMAIL"]);
  const contacts = new Map<string, Record<string, unknown>>();
  const templates = new Map<number, Record<string, unknown>>();
  const campaigns = new Map<number, Record<string, unknown> & { status: string }>();
  const calls: string[] = [];
  const tests: string[] = [];

  const json = (status: number, body?: unknown) =>
    new Response(body === undefined || status === 204 ? null : JSON.stringify(body), { status });

  const fetcher = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = url.replace("https://api.brevo.com/v3", "");
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push(`${method} ${path.split("?")[0]}`);
    if ((init?.headers as Record<string, string>)["api-key"] !== "key") return json(401, { message: "Key not found" });

    if (method === "GET" && path.startsWith("/contacts/folders")) return json(200, { folders });
    if (method === "POST" && path === "/contacts/folders") {
      const f = { id: nextId++, name: body.name };
      folders.push(f);
      return json(201, { id: f.id });
    }
    if (method === "GET" && path.startsWith("/contacts/lists")) return json(200, { lists });
    if (method === "POST" && path === "/contacts/lists") {
      const l = { id: nextId++, name: body.name, folderId: body.folderId };
      lists.push(l);
      return json(201, { id: l.id });
    }
    if (method === "GET" && path === "/contacts/attributes")
      return json(200, { attributes: [...attributes].map(name => ({ name })) });
    if (method === "POST" && path.startsWith("/contacts/attributes/normal/")) {
      attributes.add(path.split("/").pop()!);
      return json(201);
    }
    if (method === "POST" && path === "/contacts") {
      const existed = contacts.has(body.email);
      contacts.set(body.email, { ...(contacts.get(body.email) ?? {}), ...body });
      return existed ? json(204) : json(201, { id: nextId++ });
    }
    if (method === "POST" && path === "/smtp/templates") {
      const id = nextId++;
      templates.set(id, body);
      return json(201, { id });
    }
    const templateMatch = path.match(/^\/smtp\/templates\/(\d+)(\/sendTest)?$/);
    if (templateMatch) {
      const id = Number(templateMatch[1]);
      if (!templates.has(id)) return json(404, { message: "Template not found" });
      if (templateMatch[2]) {
        tests.push(`template ${id}`);
        return json(204);
      }
      templates.set(id, body);
      return json(204);
    }
    if (method === "POST" && path === "/emailCampaigns") {
      // Matches the real free plan, which rejects any campaign carrying a tag.
      if (body && (body as Record<string, unknown>).tag !== undefined) {
        return json(405, { code: "method_not_allowed", message: "You are not allowed to avail tag option for your campaign" });
      }
      const id = nextId++;
      campaigns.set(id, { ...body, status: "queued" });
      return json(201, { id });
    }
    const campaignMatch = path.match(/^\/emailCampaigns\/(\d+)(\/sendTest|\/status)?$/);
    if (campaignMatch) {
      const id = Number(campaignMatch[1]);
      const c = campaigns.get(id);
      if (!c) return json(404, { message: "Campaign not found" });
      if (campaignMatch[2] === "/sendTest") {
        tests.push(`campaign ${id}`);
        return json(204);
      }
      if (method === "GET") return json(200, c);
      if (method === "DELETE") {
        campaigns.delete(id);
        return json(204);
      }
    }
    return json(400, { message: `unexpected ${method} ${path}` });
  }) as unknown as typeof fetch;

  return { fetcher, folders, lists, attributes, contacts, templates, campaigns, calls, tests };
}

function makeIO(
  brevo: ReturnType<typeof fakeBrevo>,
  overrides: Partial<BrevoIO> & { settings?: Record<string, string>; now?: () => Date } = {},
) {
  const store: Record<string, string> = { ...SETTINGS, ...(overrides.settings ?? {}) };
  const rows: RegistrationLike[] = [
    {
      email: "confirmed@example.com",
      firstName: "Grace",
      lastName: "Hopper",
      track: "pre_revenue",
      confirmedAt: new Date("2026-09-20"),
      attendedAt: null,
      unsubscribedAt: null,
      createdAt: new Date("2026-09-19"),
    },
    {
      email: "unconfirmed@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      track: null,
      confirmedAt: null,
      attendedAt: null,
      unsubscribedAt: null,
      createdAt: new Date("2026-09-25"),
    },
    {
      email: "gone@example.com",
      firstName: "Opted",
      lastName: "Out",
      track: null,
      confirmedAt: new Date("2026-09-10"),
      attendedAt: null,
      unsubscribedAt: new Date("2026-09-12"),
      createdAt: new Date("2026-09-09"),
    },
  ];
  const io: BrevoIO = {
    fetcher: brevo.fetcher,
    apiKey: "key",
    getSettings: async () => ({ ...store }),
    setSetting: async (k, v) => {
      store[k] = v;
    },
    listRegistrations: async () => rows,
    listDownloads: async () => [{ email: "confirmed@example.com", resource: "chapter" }],
    now: overrides.now ?? (() => new Date("2026-09-30T18:00:00Z")),
    ...overrides,
  };
  return { io, store };
}

/** Evaluates the one Brevo condition shape we use, to check both branches. */
function renderCondition(html: string, truthy: boolean) {
  return html.replace(/\{% if [^%]+%\}([\s\S]*?)\{% else %\}([\s\S]*?)\{% endif %\}/g, (_m, a, b) =>
    truthy ? a : b,
  );
}

describe("the two reminders", () => {
  const start = parseEventStart(SETTINGS.date, SETTINGS.time)!;
  const ctx = {
    firstName: "Grace",
    baseUrl: SETTINGS.publicSiteUrl,
    start,
    durationMinutes: 45,
    joinUrl: JOIN,
    passcode: "480462",
  };

  it("reads the meeting ID out of the Zoom link", () => {
    expect(zoomMeetingId(JOIN)).toBe("831 5374 5263");
  });

  for (const [name, build] of [
    ["day before", buildDayBeforeReminder],
    ["hour before", buildHourBeforeReminder],
  ] as const) {
    it(`${name}: carries the join link, meeting ID and passcode in both HTML and text`, () => {
      const email = build(ctx);
      for (const part of [email.html, email.text]) {
        expect(part).toContain("831 5374 5263");
        expect(part).toContain("480462");
      }
      expect(email.html).toContain(`href="${JOIN}"`);
      expect(email.text).toContain(JOIN);
      expect(email.html).toContain("11:00 AM ET");
    });

    it(`${name}: uses no em dashes`, () => {
      const email = build(ctx);
      expect(email.subject + email.html + email.text).not.toContain("—");
    });
  }

  it("names the day and time plainly in the day-before email", () => {
    const email = buildDayBeforeReminder(ctx);
    expect(email.subject).toBe("Tomorrow at 11:00 AM ET: your Zoom link is inside");
    expect(email.html).toContain("Tuesday, October 20, 2026 at 11:00 AM ET");
    expect(email.html).toContain("calendar.google.com");
  });
});

describe("Brevo contacts", () => {
  const ids = { listAll: 1, listNurture: 2, chapterOpened: false };
  const base = {
    email: "Person@Example.com",
    firstName: "Pat",
    lastName: "Doe",
    track: null,
    attendedAt: null,
    unsubscribedAt: null,
    createdAt: new Date("2026-09-01"),
  };

  it("puts a confirmed registrant on both lists, which starts the nurture automation", () => {
    const p = contactPayload({ ...base, confirmedAt: new Date() }, ids);
    expect(p.email).toBe("person@example.com");
    expect("listIds" in p && p.listIds).toEqual([1, 2]);
    expect(p.attributes.CONFIRMED).toBe("yes");
  });

  it("puts an unconfirmed registrant on the reminders list only", () => {
    const p = contactPayload({ ...base, confirmedAt: null }, ids);
    expect("listIds" in p && p.listIds).toEqual([1]);
  });

  it("blocks anyone who unsubscribed in the app, and adds them to no list", () => {
    const p = contactPayload({ ...base, confirmedAt: new Date(), unsubscribedAt: new Date() }, ids);
    expect("emailBlacklisted" in p && p.emailBlacklisted).toBe(true);
    expect("listIds" in p).toBe(false);
  });
});

describe("conditional letters", () => {
  it("keeps both versions intact, so each reader gets exactly one of them", () => {
    const a = "<table><tr><td>Hello</td></tr><tr><td>You opened it</td></tr><tr><td>Bye</td></tr></table>";
    const b = "<table><tr><td>Hello</td></tr><tr><td>Still unopened</td></tr><tr><td>Bye</td></tr></table>";
    const merged = conditionalMerge('contact.X == "yes"', a, b);
    expect(renderCondition(merged, true)).toBe(a);
    expect(renderCondition(merged, false)).toBe(b);
    expect(merged.match(/Hello/g)).toHaveLength(1);
  });
});

describe("the session-anchored schedule", () => {
  const start = parseEventStart(SETTINGS.date, SETTINGS.time)!;
  const plan = planEventCampaigns({ baseUrl: SETTINGS.publicSiteUrl, settings: SETTINGS, start });
  const at = (key: string) => plan.find(p => p.key === key)!.at.toISOString();

  it("reads the dashboard's date and time as 11 AM Eastern", () => {
    expect(start.toISOString()).toBe("2026-10-20T15:00:00.000Z");
  });

  it("sends each email at the right moment", () => {
    expect(at("reminder-week")).toBe("2026-10-13T15:00:00.000Z"); // Tue Oct 13, 11:00 AM ET
    expect(at("reminder-day")).toBe("2026-10-19T15:00:00.000Z"); // Mon 11:00 AM ET
    expect(at("reminder-hour")).toBe("2026-10-20T14:00:00.000Z"); // Tue 10:00 AM ET
    expect(at("letter-4")).toBe("2026-10-21T13:00:00.000Z"); // Wed 9:00 AM ET
    // While the Fast Track is open: every other day until it closes on Oct 30.
    expect(at("letter-5")).toBe("2026-10-23T15:00:00.000Z"); // Fri 11:00 AM ET
    expect(at("fast-track-3")).toBe("2026-10-25T15:00:00.000Z"); // Sun 11:00 AM ET
    expect(at("fast-track-4")).toBe("2026-10-27T15:00:00.000Z"); // Tue 11:00 AM ET
    expect(at("fast-track-5")).toBe("2026-10-29T15:00:00.000Z"); // Thu 11:00 AM ET
    expect(at("letter-6")).toBe("2026-10-30T13:00:00.000Z"); // Fri 9:00 AM ET, the day it closes
    for (const p of plan) expect(p.at.getTime()).toBeLessThan(new Date(FAST_TRACK.closesAt).getTime());
  });

  it("sends every Fast Track letter to everyone registered, with the call link", () => {
    for (const key of ["letter-4", "letter-5", "fast-track-3", "fast-track-4", "fast-track-5", "letter-6"]) {
      const p = plan.find(c => c.key === key)!;
      expect(p.list).toBe("all");
      expect(p.html).toContain(FAST_TRACK.callUrl);
      expect(p.html).not.toContain("\u2014"); // no em dashes
      expect(p.html.toLowerCase()).not.toContain("founding");
    }
  });

  it("offers both a call and a reply on the closing day", () => {
    const html = plan.find(c => c.key === "letter-6")!.html;
    expect(html).toContain(FAST_TRACK.callUrl);
    expect(html).toContain(`mailto:${FAST_TRACK.replyTo}`);
    expect(html).toContain(FAST_TRACK.closingDayHours);
  });

  it("names the price only from the third Fast Track letter on", () => {
    expect(plan.find(c => c.key === "letter-4")!.html).not.toContain(FAST_TRACK.price);
    expect(plan.find(c => c.key === "letter-5")!.html).not.toContain(FAST_TRACK.price);
    expect(plan.find(c => c.key === "fast-track-3")!.html).toContain(FAST_TRACK.price);
    expect(plan.find(c => c.key === "fast-track-4")!.html).toContain(FAST_TRACK.price);
  });

  it("uses the client story in letter three when one is saved, and skips it otherwise", () => {
    const withStory = planEventCampaigns({
      baseUrl: SETTINGS.publicSiteUrl,
      settings: { ...SETTINGS, clientStory: "Maria found her offer in week one." },
      start,
    }).find(c => c.key === "fast-track-3")!.html;
    expect(withStory).toContain("Maria found her offer in week one.");
    expect(plan.find(c => c.key === "fast-track-3")!.html).not.toContain("From a client");
  });

  it("returns to the original letters once the Fast Track has closed", () => {
    const nov = parseEventStart("Tuesday, November 17, 2026", "11:00 AM")!;
    const later = planEventCampaigns({ baseUrl: SETTINGS.publicSiteUrl, settings: SETTINGS, start: nov });
    expect(later.map(p => p.key)).toEqual(["reminder-week", "reminder-day", "reminder-hour", "letter-4", "letter-5", "letter-6"]);
    expect(later.find(p => p.key === "letter-6")!.subject).toBe("The last letter");
  });

  it("keeps the one-week reminder at 11 AM Eastern across a clock change", () => {
    // Nov 1 2026 ends daylight saving, between Oct 27 and the Nov 3 session.
    const nov3 = parseEventStart("Tuesday, November 3, 2026", "11:00 AM")!;
    const week = planEventCampaigns({ baseUrl: SETTINGS.publicSiteUrl, settings: SETTINGS, start: nov3 })
      .find(p => p.key === "reminder-week")!;
    expect(week.at.toISOString()).toBe("2026-10-27T15:00:00.000Z"); // 11:00 AM EDT
  });

  it("puts the Zoom link, meeting ID and passcode in all three reminders", () => {
    for (const key of ["reminder-week", "reminder-day", "reminder-hour"]) {
      const html = plan.find(p => p.key === key)!.html;
      expect(html).toContain(JOIN);
      expect(html).toContain("831 5374 5263");
      expect(html).toContain("480462");
    }
  });

  it("uses standard time for the November session", () => {
    const nov = parseEventStart("Tuesday, November 17, 2026", "11AM-11:45AM")!;
    expect(nov.toISOString()).toBe("2026-11-17T16:00:00.000Z");
  });

  it("uses Brevo placeholders for the name and unsubscribe link", () => {
    for (const p of plan) {
      expect(p.html).toContain("{{ unsubscribe }}");
      expect(p.html).toContain("{{ contact.FIRSTNAME }}");
    }
  });

  it("gives the last letter both endings, chosen by attendance", () => {
    const six = plan.find(p => p.key === "letter-6")!.html;
    expect(renderCondition(six, true)).toContain("The chapter and the checklist remain yours");
    expect(renderCondition(six, false)).toContain("the checklist will be waiting for you there too");
  });
});

describe("setting everything up in Brevo", () => {
  it("creates the lists, copies registrants, saves templates and schedules the five emails", async () => {
    const brevo = fakeBrevo();
    const { io, store } = makeIO(brevo);
    const report = await setupBrevo({ io });

    expect(report.ok).toBe(true);
    expect(report.error).toBeUndefined();
    expect(brevo.lists.map(l => l.name)).toEqual([BREVO_LIST_ALL, BREVO_LIST_NURTURE]);
    expect(brevo.attributes.has("DL_CHAPTER")).toBe(true);
    expect(report.contacts).toEqual({ synced: 3, failed: 0, errors: [] });
    expect(brevo.contacts.get("confirmed@example.com")?.listIds).toHaveLength(2);
    expect((brevo.contacts.get("confirmed@example.com")?.attributes as Record<string, string>).CHAPTER_OPENED).toBe("yes");
    expect(brevo.contacts.get("gone@example.com")?.emailBlacklisted).toBe(true);
    expect(brevo.templates.size).toBe(3);
    expect(brevo.campaigns.size).toBe(9);
    expect(report.campaigns.every(c => c.status === "queued")).toBe(true);

    const reminder = [...brevo.campaigns.values()].find(c => String(c.name).includes("day before"))!;
    expect(reminder.scheduledAt).toBe("2026-10-19T15:00:00.000Z");
    expect(String(reminder.htmlContent)).toContain(JOIN);
    expect((reminder.recipients as { listIds: number[] }).listIds).toEqual([Number(store[BREVO_KEYS.listAll])]);
    const last = [...brevo.campaigns.values()].find(c => String(c.name).includes("closes tonight"))!;
    expect((last.recipients as { listIds: number[] }).listIds).toEqual([Number(store[BREVO_KEYS.listAll])]);
  });

  it("can be pressed again without duplicating anything", async () => {
    const brevo = fakeBrevo();
    const { io } = makeIO(brevo);
    await setupBrevo({ io });
    const firstTemplates = [...brevo.templates.keys()];
    const firstCampaigns = [...brevo.campaigns.keys()];
    const again = await setupBrevo({ io });

    expect(again.ok).toBe(true);
    expect(again.error).toBeUndefined();
    expect([...brevo.campaigns.keys()].some(id => firstCampaigns.includes(id))).toBe(false);

    expect(brevo.lists).toHaveLength(2);
    expect(brevo.folders).toHaveLength(1);
    expect([...brevo.templates.keys()]).toEqual(firstTemplates);
    expect(brevo.campaigns.size).toBe(9); // old unsent ones replaced, not added to
  });

  it("does not schedule reminders without a Zoom link, and says so", async () => {
    const brevo = fakeBrevo();
    const { io } = makeIO(brevo, { settings: { joinUrl: "" } });
    const report = await setupBrevo({ io });

    expect(report.ok).toBe(true);
    expect(brevo.campaigns.size).toBe(6);
    expect(report.campaigns.filter(c => c.status === "not scheduled")).toHaveLength(3);
    expect(report.warnings.join(" ")).toMatch(/Zoom join link/);
  });

  it("skips anything whose time has already passed", async () => {
    const brevo = fakeBrevo();
    const { io } = makeIO(brevo, { now: () => new Date("2026-10-20T14:30:00Z") });
    const report = await setupBrevo({ io });

    expect(report.campaigns.find(c => c.key === "reminder-week")?.status).toBe("skipped");
    expect(report.campaigns.find(c => c.key === "reminder-day")?.status).toBe("skipped");
    expect(report.campaigns.find(c => c.key === "reminder-hour")?.status).toBe("skipped");
    expect(brevo.campaigns.size).toBe(6);
  });

  it("reports a bad key clearly instead of failing silently", async () => {
    const brevo = fakeBrevo();
    const { io } = makeIO(brevo, { apiKey: "wrong" });
    const report = await setupBrevo({ io });

    expect(report.ok).toBe(false);
    expect(report.error).toMatch(/401/);
  });
});

describe("test copies", () => {
  it("asks Brevo to send every stored email to Tabitha", async () => {
    const brevo = fakeBrevo();
    const { io } = makeIO(brevo);
    await setupBrevo({ io });
    const report = await sendBrevoTests({ io });

    expect(report.results.filter(r => !(r.ok && r.via === "brevo"))).toEqual([]);
    expect(report.results).toHaveLength(12);
    expect(report.results.every(r => r.ok && r.via === "brevo")).toBe(true);
    expect(brevo.tests).toHaveLength(12);
  });
});
