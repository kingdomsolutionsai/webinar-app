import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  buildSequenceEmail,
  runSequenceDispatch,
  selectDueSteps,
  SEQUENCE_PAUSED_KEY,
  SEQUENCE_SCHEDULE,
} from "./sequence";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-for-sequence";
});

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-08-10T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);

describe("which letter is due", () => {
  it("sends nothing on the day someone signs up", () => {
    expect(selectDueSteps({ signedUpAt: daysAgo(0), sentSteps: [], now })).toBeNull();
  });

  it("sends letter one once the second day has passed", () => {
    expect(selectDueSteps({ signedUpAt: daysAgo(2), sentSteps: [], now })).toBe(1);
  });

  it("moves to letter two only after letter one is recorded", () => {
    expect(selectDueSteps({ signedUpAt: daysAgo(7), sentSteps: [], now })).toBe(1);
    expect(selectDueSteps({ signedUpAt: daysAgo(7), sentSteps: [1], now })).toBe(2);
  });

  it("returns nothing when every letter has been sent", () => {
    expect(
      selectDueSteps({ signedUpAt: daysAgo(90), sentSteps: [1, 2, 3], now }),
    ).toBeNull();
  });

  it("delivers one letter at a time even to a long-overdue signup", () => {
    // Someone imported months late is due all three. Sending three at once would
    // read as a machine emptying a queue rather than a person writing.
    expect(selectDueSteps({ signedUpAt: daysAgo(200), sentSteps: [], now })).toBe(1);
    expect(selectDueSteps({ signedUpAt: daysAgo(200), sentSteps: [1], now })).toBe(2);
    expect(selectDueSteps({ signedUpAt: daysAgo(200), sentSteps: [1, 2], now })).toBe(3);
  });

  it("uses the documented day-2 / day-7 / day-14 schedule", () => {
    expect(SEQUENCE_SCHEDULE.map(s => s.day)).toEqual([2, 7, 14]);
  });
});

/* ------------------------------------------------------------------ *
 * Dispatch
 * ------------------------------------------------------------------ */

type Person = {
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
  unsubscribedAt: Date | null;
};

function harness(options: {
  people: Person[];
  sends?: { email: string; step: number; status: string }[];
  sendResult?: { ok: true; messageId: string } | { ok: false; error: string };
}) {
  const claimed: { email: string; step: number }[] = [];
  const released: { email: string; step: number }[] = [];
  const finished: { email: string; step: number; status: string }[] = [];
  const sent: { to: string; subject: string; tags?: string[]; unsubscribeUrl?: string }[] = [];

  const deps = {
    listCandidates: vi.fn(async () =>
      // Mirrors the real query, which excludes opt-outs at the database level.
      options.people.filter(p => !p.unsubscribedAt) as never,
    ),
    listSends: vi.fn(async () => (options.sends ?? []) as never),
    claim: vi.fn(async (email: string, step: number) => {
      const already =
        claimed.some(c => c.email === email && c.step === step) ||
        (options.sends ?? []).some(s => s.email === email && s.step === step);
      if (already) return false;
      claimed.push({ email, step });
      return true;
    }),
    finish: vi.fn(async (email: string, step: number, status: "sent" | "failed") => {
      finished.push({ email, step, status });
    }),
    release: vi.fn(async (email: string, step: number) => {
      released.push({ email, step });
    }),
    send: vi.fn(async (payload: never) => {
      const p = payload as unknown as {
        to: { email: string };
        subject: string;
        tags?: string[];
        unsubscribeUrl?: string;
      };
      sent.push({
        to: p.to.email,
        subject: p.subject,
        tags: p.tags,
        unsubscribeUrl: p.unsubscribeUrl,
      });
      return options.sendResult ?? { ok: true as const, messageId: "msg-1" };
    }),
  };

  return { deps, claimed, released, finished, sent };
}

describe("sequence dispatch", () => {
  const baseUrl = "https://start.kingdomsolutionsai.com";

  it("sends the due letter and records the outcome", async () => {
    const h = harness({
      people: [
        {
          firstName: "Ada",
          lastName: "Reader",
          email: "ada@example.com",
          createdAt: daysAgo(3),
          unsubscribedAt: null,
        },
      ],
    });

    const summary = await runSequenceDispatch({
      baseUrl,
      settings: {},
      now,
      deps: h.deps as never,
    });

    expect(summary.sent).toBe(1);
    expect(summary.failed).toBe(0);
    expect(h.sent[0].to).toBe("ada@example.com");
    expect(h.sent[0].tags).toEqual(["sequence-1"]);
    expect(h.finished).toEqual([{ email: "ada@example.com", step: 1, status: "sent" }]);
  });

  it("never emails someone who has opted out", async () => {
    const h = harness({
      people: [
        {
          firstName: "Opted",
          lastName: "Out",
          email: "gone@example.com",
          createdAt: daysAgo(30),
          unsubscribedAt: daysAgo(1),
        },
      ],
    });

    const summary = await runSequenceDispatch({
      baseUrl,
      settings: {},
      now,
      deps: h.deps as never,
    });

    expect(h.sent).toHaveLength(0);
    expect(summary.sent).toBe(0);
  });

  it("does not repeat a letter already recorded as sent", async () => {
    const h = harness({
      people: [
        {
          firstName: "Ada",
          lastName: "Reader",
          email: "ada@example.com",
          createdAt: daysAgo(3),
          unsubscribedAt: null,
        },
      ],
      sends: [{ email: "ada@example.com", step: 1, status: "sent" }],
    });

    const summary = await runSequenceDispatch({
      baseUrl,
      settings: {},
      now,
      deps: h.deps as never,
    });

    expect(h.sent).toHaveLength(0);
    expect(summary.sent).toBe(0);
    expect(summary.skipped).toBe(1);
  });

  it("skips a step another run has already claimed", async () => {
    const h = harness({
      people: [
        {
          firstName: "Ada",
          lastName: "Reader",
          email: "ada@example.com",
          createdAt: daysAgo(3),
          unsubscribedAt: null,
        },
      ],
    });
    h.deps.claim = vi.fn(async () => false) as never;

    const summary = await runSequenceDispatch({
      baseUrl,
      settings: {},
      now,
      deps: h.deps as never,
    });

    expect(h.sent).toHaveLength(0);
    expect(summary.skipped).toBe(1);
  });

  it("releases the claim when the provider fails, so the letter is retried not lost", async () => {
    const h = harness({
      people: [
        {
          firstName: "Ada",
          lastName: "Reader",
          email: "ada@example.com",
          createdAt: daysAgo(3),
          unsubscribedAt: null,
        },
      ],
      sendResult: { ok: false, error: "provider unreachable" },
    });

    const summary = await runSequenceDispatch({
      baseUrl,
      settings: {},
      now,
      deps: h.deps as never,
    });

    expect(summary.failed).toBe(1);
    expect(h.released).toEqual([{ email: "ada@example.com", step: 1 }]);
    expect(h.finished).toHaveLength(0);
  });

  it("sends nothing at all while paused", async () => {
    const h = harness({
      people: [
        {
          firstName: "Ada",
          lastName: "Reader",
          email: "ada@example.com",
          createdAt: daysAgo(30),
          unsubscribedAt: null,
        },
      ],
    });

    const summary = await runSequenceDispatch({
      baseUrl,
      settings: { [SEQUENCE_PAUSED_KEY]: "true" },
      now,
      deps: h.deps as never,
    });

    expect(summary.paused).toBe(true);
    expect(h.sent).toHaveLength(0);
    expect(h.deps.listCandidates).not.toHaveBeenCalled();
  });

  it("includes an unsubscribe link on every sequence letter", async () => {
    const h = harness({
      people: [
        {
          firstName: "Ada",
          lastName: "Reader",
          email: "ada@example.com",
          createdAt: daysAgo(3),
          unsubscribedAt: null,
        },
      ],
    });

    await runSequenceDispatch({ baseUrl, settings: {}, now, deps: h.deps as never });
    expect(h.sent[0].unsubscribeUrl).toContain("/unsubscribe");
  });
});

/* ------------------------------------------------------------------ *
 * Letter content
 * ------------------------------------------------------------------ */

describe("letter content", () => {
  const ctx = {
    firstName: "Ada",
    email: "ada@example.com",
    baseUrl: "https://start.kingdomsolutionsai.com",
    unsubscribeUrl: "https://start.kingdomsolutionsai.com/unsubscribe?e=ada",
  };

  it("uses counted links so opens from email are attributed", () => {
    const letter = buildSequenceEmail(1, ctx);
    expect(letter.html).toContain("/api/download?");
    expect(letter.text).toContain("/api/download?");
  });

  it("carries both an HTML and a plain-text part", () => {
    for (const step of [1, 2, 3] as const) {
      const letter = buildSequenceEmail(step, ctx);
      expect(letter.html).toContain("<!doctype html>");
      expect(letter.text.length).toBeGreaterThan(80);
      expect(letter.subject.length).toBeGreaterThan(0);
    }
  });

  it("shows an unsubscribe link in every letter", () => {
    for (const step of [1, 2, 3] as const) {
      expect(buildSequenceEmail(step, ctx).html).toContain(ctx.unsubscribeUrl);
    }
  });

  it("promises no date when none is set, and names it once it is", () => {
    const withoutDate = buildSequenceEmail(3, { ...ctx, eventDate: "[DATE]" });
    expect(withoutDate.subject).not.toMatch(/\d/);
    expect(withoutDate.html).toContain("not fixed yet");

    const withDate = buildSequenceEmail(3, {
      ...ctx,
      eventDate: "Thursday, September 18",
      eventTime: "7:00 PM ET",
    });
    expect(withDate.subject).toContain("September 18");
    expect(withDate.html).toContain("7:00 PM ET");
    expect(withDate.html).not.toContain("not fixed yet");
  });

  it("adapts letter one to whether the resource was opened", () => {
    const opened = buildSequenceEmail(1, { ...ctx, hasDownloaded: true });
    const notOpened = buildSequenceEmail(1, { ...ctx, hasDownloaded: false });
    expect(opened.html).toContain("thank you for opening");
    expect(notOpened.html).toContain("still sitting there unopened");
  });

  it("escapes a name that contains markup", () => {
    const letter = buildSequenceEmail(1, { ...ctx, firstName: '<script>x</script>' });
    expect(letter.html).not.toContain("<script>");
    expect(letter.html).toContain("&lt;script&gt;");
  });
});

