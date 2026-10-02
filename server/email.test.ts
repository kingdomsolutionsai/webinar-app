import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOwnerEmail, buildRegistrantEmail, sendEmail } from "./email";
import { LION_MARK_URL, MAIL_FROM, READINESS_CHECKLIST, SAMPLE_CHAPTER } from "../shared/event";

const BASE = "https://example.manus.space";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("registrant email", () => {
  it("includes absolute links to both resources", () => {
    const mail = buildRegistrantEmail({ firstName: "Ada", resource: "both", baseUrl: BASE });
    expect(mail.html).toContain(`${BASE}${SAMPLE_CHAPTER.url}`);
    expect(mail.html).toContain(`${BASE}${READINESS_CHECKLIST.url}`);
    // Root-relative paths cannot work in email clients.
    expect(mail.html).not.toMatch(/href="\/manus-storage/);
  });

  it("carries the full exercise prompt: instruction, check, and reframe", () => {
    const mail = buildRegistrantEmail({ firstName: "Ada", resource: "chapter", baseUrl: BASE });
    expect(mail.html).toContain("who you serve and the specific problem you solve");
    expect(mail.html).toContain("would the person I just described recognize themselves in it");
    expect(mail.html).toContain("that is your diagnosis");
    // The plain-text alternative must not lose it either.
    expect(mail.text).toContain("who you serve and the specific problem you solve");
    expect(mail.text).toContain("that is your diagnosis");
  });

  it("leads with whichever resource the visitor asked for", () => {
    const checklistFirst = buildRegistrantEmail({
      firstName: "Ada",
      resource: "checklist",
      baseUrl: BASE,
    });
    const chapterFirst = buildRegistrantEmail({
      firstName: "Ada",
      resource: "chapter",
      baseUrl: BASE,
    });

    // The primary panel appears before the secondary one in the document.
    const checklistPos = checklistFirst.html.indexOf(READINESS_CHECKLIST.url);
    const chapterPosA = checklistFirst.html.indexOf(SAMPLE_CHAPTER.url);
    expect(checklistPos).toBeLessThan(chapterPosA);

    const chapterPosB = chapterFirst.html.indexOf(SAMPLE_CHAPTER.url);
    const checklistPosB = chapterFirst.html.indexOf(READINESS_CHECKLIST.url);
    expect(chapterPosB).toBeLessThan(checklistPosB);

    expect(checklistFirst.subject).toBe("Your checklist and chapter are inside");
    expect(chapterFirst.subject).toBe("Your chapter and checklist are inside");
  });

  it("escapes a name that contains markup", () => {
    const mail = buildRegistrantEmail({
      firstName: '<script>alert("x")</script>',
      resource: "both",
      baseUrl: BASE,
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("falls back to a neutral greeting when the name is blank", () => {
    const mail = buildRegistrantEmail({ firstName: "   ", resource: null, baseUrl: BASE });
    expect(mail.html).toContain("friend");
  });

  it("uses inline styles only, since email clients discard style blocks", () => {
    const mail = buildRegistrantEmail({ firstName: "Ada", resource: "both", baseUrl: BASE });
    expect(mail.html).not.toMatch(/<style[\s>]/i);
  });

  it("shows the crowned lion mark in the masthead as an absolute URL", () => {
    const logoUrl = `${BASE}${LION_MARK_URL}`;
    const mail = buildRegistrantEmail({
      firstName: "Ada",
      resource: "both",
      baseUrl: BASE,
      logoUrl,
    });
    expect(mail.html).toContain(`src="${logoUrl}"`);
    // Alt text matters: many clients block images by default.
    expect(mail.html).toContain('alt="Kingdom Solutions AI"');
    // Explicit width/height stops Outlook rendering it at full size.
    expect(mail.html).toMatch(/width="\d+"\s+height="\d+"/);
  });

  it("still renders a complete masthead when no logo URL is available", () => {
    const mail = buildRegistrantEmail({ firstName: "Ada", resource: "both", baseUrl: BASE });
    expect(mail.html).not.toContain("<img");
    // The gold wordmark must carry the brand on its own.
    expect(mail.html).toContain("Kingdom Solutions AI&trade;");
  });

  it("places an unsubscribe link in both the HTML and text parts", () => {
    const optOut = `${BASE}/unsubscribe?e=ada%40example.com&t=abc123`;
    const mail = buildRegistrantEmail({
      firstName: "Ada",
      resource: "both",
      baseUrl: BASE,
      unsubscribeUrl: optOut,
    });
    // The href is HTML-escaped, so the ampersand appears as &amp; in the markup.
    expect(mail.html).toContain(optOut.replace(/&/g, "&amp;"));
    expect(mail.html).toContain("Unsubscribe");
    // Someone reading the plain-text part must be able to opt out too.
    expect(mail.text).toContain(optOut);
  });

  it("prefers counted links when they are supplied, so opens are attributed", () => {
    const tracked = {
      chapter: `${BASE}/api/download?r=chapter&e=ada%40example.com&t=abc`,
      checklist: `${BASE}/api/download?r=checklist&e=ada%40example.com&t=def`,
    };
    const mail = buildRegistrantEmail({
      firstName: "Ada",
      resource: "chapter",
      baseUrl: BASE,
      trackedUrls: tracked,
    });

    expect(mail.html).toContain("/api/download?r=chapter");
    expect(mail.html).toContain("/api/download?r=checklist");
    expect(mail.text).toContain("/api/download?r=chapter");
    // No uncounted second route to the same file.
    expect(mail.html).not.toContain(SAMPLE_CHAPTER.url);
    expect(mail.html).not.toContain(READINESS_CHECKLIST.url);
  });

  it("falls back to the direct file link when no counted links are given", () => {
    const mail = buildRegistrantEmail({
      firstName: "Ada",
      resource: "chapter",
      baseUrl: BASE,
    });
    expect(mail.html).toContain(`${BASE}${SAMPLE_CHAPTER.url}`);
  });
});

describe("owner email", () => {
  it("summarises the signup including the resource choice", () => {
    const mail = buildOwnerEmail({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      track: "pre_revenue",
      resource: "checklist",
      baseUrl: BASE,
      total: 7,
    });
    expect(mail.subject).toBe("New signup: Ada Lovelace");
    expect(mail.html).toContain("ada@example.com");
    expect(mail.html).toContain("checklist");
    expect(mail.html).toContain("pre_revenue");
    expect(mail.html).toContain(`${BASE}/dashboard`);
    expect(mail.text).toContain("Total signups: 7");
  });

  it("reports missing optional fields plainly rather than as empty cells", () => {
    const mail = buildOwnerEmail({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      track: null,
      resource: null,
      baseUrl: BASE,
    });
    expect(mail.text).toContain("Wanted first: not stated");
    expect(mail.text).toContain("Starting point: not stated");
  });
});

describe("sendEmail", () => {
  it("always sends from the Kingdom Solutions AI address", async () => {
    const calls: { url: string; body: any }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ messageId: "<abc@brevo>" }), { status: 201 });
    });

    const result = await sendEmail({
      to: { email: "ada@example.com" },
      subject: "s",
      html: "<p>h</p>",
      text: "t",
    });

    expect(result).toEqual({ ok: true, messageId: "<abc@brevo>" });
    expect(calls[0].url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(calls[0].body.sender.email).toBe(MAIL_FROM.email);
    expect(calls[0].body.sender.email).toBe("tabitha@kingdomsolutionsai.com");
    // Guard the specific mistake of sending from the other account on the key.
    expect(JSON.stringify(calls[0].body)).not.toContain("revivedspirit");
  });

  it("returns a failure rather than throwing when Brevo rejects the send", async () => {
    vi.stubGlobal("fetch", async () => new Response("bad sender", { status: 400 }));
    const result = await sendEmail({
      to: { email: "ada@example.com" },
      subject: "s",
      html: "<p>h</p>",
      text: "t",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("400");
  });

  it("returns a failure rather than throwing when the network errors", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("socket hang up");
    });
    const result = await sendEmail({
      to: { email: "ada@example.com" },
      subject: "s",
      html: "<p>h</p>",
      text: "t",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("socket hang up");
  });

  it("includes both an HTML and a plain-text part", async () => {
    const bodies: any[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ messageId: "x" }), { status: 201 });
    });
    await sendEmail({
      to: { email: "ada@example.com" },
      subject: "s",
      html: "<p>h</p>",
      text: "t",
    });
    expect(bodies[0].htmlContent).toBeTruthy();
    expect(bodies[0].textContent).toBeTruthy();
  });

  it("sends List-Unsubscribe headers so mail clients show a native opt-out", async () => {
    const bodies: any[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ messageId: "x" }), { status: 201 });
    });
    await sendEmail({
      to: { email: "ada@example.com" },
      subject: "s",
      html: "<p>h</p>",
      text: "t",
      unsubscribeUrl: "https://example.manus.space/unsubscribe?e=a%40b.com&t=zz",
    });
    expect(bodies[0].headers["List-Unsubscribe"]).toBe(
      "<https://example.manus.space/unsubscribe?e=a%40b.com&t=zz>",
    );
    expect(bodies[0].headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("omits the headers entirely when no opt-out URL is supplied", async () => {
    const bodies: any[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ messageId: "x" }), { status: 201 });
    });
    await sendEmail({
      to: { email: "ada@example.com" },
      subject: "s",
      html: "<p>h</p>",
      text: "t",
    });
    expect(bodies[0].headers).toBeUndefined();
  });
});

describe("the email sent after someone confirms, once a session is set", () => {
  const settings = {
    date: "Tuesday, October 20, 2026",
    time: "11:00 AM",
    duration: "60 minutes",
    joinUrl: "https://us06web.zoom.us/j/83153745263?pwd=lGvfk21qK8g6QaUmamKTwmqxUZTeda.1",
    zoomPasscode: "480462",
  };

  it("carries the date, Zoom link, meeting ID, passcode and calendar link", async () => {
    const { seatBlock, upcomingSession } = await import("./reminders");
    const session = upcomingSession(settings, new Date("2026-10-02T12:00:00Z"))!;
    const mail = buildRegistrantEmail({ firstName: "Ada", baseUrl: BASE, seat: seatBlock(session) });
    for (const part of [mail.html, mail.text]) {
      expect(part).toContain("Tuesday, October 20, 2026 at 11:00 AM ET");
      expect(part).toContain(settings.joinUrl.replace(/&/g, "&amp;").split("?")[0]);
      expect(part).toContain("831 5374 5263");
      expect(part).toContain("480462");
      expect(part).toContain("calendar.google.com");
    }
    expect(mail.subject).toContain("Your Zoom link is inside");
    // Part One still comes with it.
    expect(mail.html).toContain(`${BASE}${SAMPLE_CHAPTER.url}`);
    // The "something is coming" teaser makes no sense once they have a seat.
    expect(mail.html).not.toContain("I am preparing something");
  });

  it("says nothing about a session once it has passed", async () => {
    const { upcomingSession } = await import("./reminders");
    expect(upcomingSession(settings, new Date("2026-10-21T12:00:00Z"))).toBeNull();
  });

  it("still shows the date, without a dead button, if no Zoom link is saved", async () => {
    const { seatBlock, upcomingSession } = await import("./reminders");
    const session = upcomingSession({ ...settings, joinUrl: "" }, new Date("2026-10-02T12:00:00Z"))!;
    const mail = buildRegistrantEmail({ firstName: "Ada", baseUrl: BASE, seat: seatBlock(session) });
    expect(mail.html).toContain("Tuesday, October 20, 2026 at 11:00 AM ET");
    expect(mail.html).not.toContain("Join on Zoom");
    expect(mail.html).toContain("Your Zoom link will arrive by email");
  });

  it("names the session in the confirm-your-email message", async () => {
    const { buildConfirmEmail } = await import("./email");
    const mail = buildConfirmEmail({
      firstName: "Ada",
      confirmUrl: `${BASE}/confirm?e=a&t=b`,
      sessionWhen: "Tuesday, October 20, 2026 at 11:00 AM ET",
    });
    expect(mail.html).toContain("save your seat for Tuesday, October 20, 2026 at 11:00 AM ET");
    expect(mail.subject).toBe("Confirm your email to save your seat");
  });

  it("contains no em dashes in any email copy", async () => {
    const { seatBlock, upcomingSession } = await import("./reminders");
    const session = upcomingSession(settings, new Date("2026-10-02T12:00:00Z"))!;
    const mail = buildRegistrantEmail({ firstName: "Ada", baseUrl: BASE, seat: seatBlock(session) });
    expect(mail.html + mail.text).not.toMatch(/—|&mdash;/);
  });
});
