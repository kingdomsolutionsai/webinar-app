import { describe, expect, it, vi } from "vitest";
import {
  buildReplayLetter,
  isReplayDue,
  REPLAY_STEP,
  runSequenceDispatch,
  type SequenceContext,
} from "./sequence";

const ctx: SequenceContext = {
  firstName: "Ada",
  email: "ada@example.com",
  baseUrl: "https://www.whatentrepreneursneedtoknow.com",
  unsubscribeUrl: "https://www.whatentrepreneursneedtoknow.com/unsubscribe?e=x&t=y",
};

describe("the replay letter never claims a recording that does not exist", () => {
  it("offers the recording when a link is set", () => {
    const letter = buildReplayLetter({ ...ctx, replayUrl: "https://vimeo.com/123" });
    expect(letter.html).toContain("https://vimeo.com/123");
    expect(letter.html).toContain("Watch the session");
    expect(letter.subject).toContain("recording");
  });

  it("says nothing at all about a recording when no link is set", () => {
    const letter = buildReplayLetter(ctx);
    const all = `${letter.html} ${letter.text} ${letter.subject}`.toLowerCase();
    expect(all).not.toContain("recording");
    expect(all).not.toContain("watch the session");
    expect(all).not.toContain("replay");
  });

  it("treats a blank link as no link", () => {
    const letter = buildReplayLetter({ ...ctx, replayUrl: "   " });
    expect(letter.html.toLowerCase()).not.toContain("recording");
  });

  it("restates the exercise in full either way, since a no-show has never seen it", () => {
    for (const letter of [buildReplayLetter(ctx), buildReplayLetter({ ...ctx, replayUrl: "u" })]) {
      expect(letter.html).toContain("who you serve");
      expect(letter.text).toContain("who you serve");
    }
  });

  it("does not shame the person who missed it", () => {
    const all = buildReplayLetter(ctx).text.toLowerCase();
    for (const phrase of ["you missed", "sorry you could not", "unfortunately you"]) {
      expect(all).not.toContain(phrase);
    }
  });
});

describe("the morning-after letter is gated on the session actually happening", () => {
  const eventDate = "2026-09-15";
  const eventTime = "13:00";

  it("is not due before the session", () => {
    expect(
      isReplayDue({ eventDate, eventTime, sentSteps: [], now: new Date("2026-09-15T10:00:00Z") }),
    ).toBe(false);
  });

  it("is not due immediately after the session ends", () => {
    expect(
      isReplayDue({ eventDate, eventTime, sentSteps: [], now: new Date("2026-09-15T15:00:00Z") }),
    ).toBe(false);
  });

  it("is due the following morning", () => {
    expect(
      isReplayDue({ eventDate, eventTime, sentSteps: [], now: new Date("2026-09-16T09:00:00Z") }),
    ).toBe(true);
  });

  it("is never due while the date is still a placeholder", () => {
    expect(isReplayDue({ eventDate: "[DATE]", sentSteps: [], now: new Date("2030-01-01") })).toBe(
      false,
    );
    expect(isReplayDue({ sentSteps: [], now: new Date("2030-01-01") })).toBe(false);
  });

  it("refuses to treat an unparseable date as past", () => {
    expect(
      isReplayDue({ eventDate: "sometime in the fall", sentSteps: [], now: new Date("2030-01-01") }),
    ).toBe(false);
  });

  it("is never due twice for the same person", () => {
    expect(
      isReplayDue({
        eventDate,
        eventTime,
        sentSteps: [REPLAY_STEP],
        now: new Date("2026-09-20T09:00:00Z"),
      }),
    ).toBe(false);
  });
});

describe("dispatch sends the morning-after letter once", () => {
  const person = {
    firstName: "Ada",
    lastName: "Bennett",
    email: "ada@example.com",
    createdAt: new Date("2026-09-01T09:00:00Z"),
    unsubscribedAt: null,
  };

  it("prefers the replay letter over a due signup letter, then never repeats it", async () => {
    const claimed = new Set<string>();
    const send = vi.fn().mockResolvedValue({ ok: true, messageId: "m1" });
    const deps = {
      listCandidates: vi.fn().mockResolvedValue([person]),
      listSends: vi.fn().mockResolvedValue([]),
      claim: vi.fn(async (email: string, step: number) => {
        const key = `${email}:${step}`;
        if (claimed.has(key)) return false;
        claimed.add(key);
        return true;
      }),
      finish: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      send,
    } as never;

    const settings = { date: "2026-09-15", time: "13:00", replayUrl: "https://vimeo.com/9" };
    const first = await runSequenceDispatch({
      baseUrl: "https://example.com",
      settings,
      now: new Date("2026-09-16T09:00:00Z"),
      deps,
    });
    expect(first.sent).toBe(1);
    expect(send.mock.calls[0][0].tags).toEqual([`sequence-${REPLAY_STEP}`]);

    // Second run with the send recorded: the replay must not go again.
    const deps2 = {
      ...(deps as Record<string, unknown>),
      listSends: vi.fn().mockResolvedValue([{ email: person.email, step: REPLAY_STEP }]),
    } as never;
    const second = await runSequenceDispatch({
      baseUrl: "https://example.com",
      settings,
      now: new Date("2026-09-17T09:00:00Z"),
      deps: deps2,
    });
    const replaySends = (deps2 as never as { send: typeof send }).send.mock.calls.filter(
      (call: unknown[]) =>
        (call[0] as { tags: string[] }).tags?.includes(`sequence-${REPLAY_STEP}`),
    );
    expect(replaySends.length).toBe(1);
    expect(second.sent + second.skipped).toBeGreaterThan(0);
  });

  it("sends nothing extra when no date is set", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, messageId: "m" });
    const summary = await runSequenceDispatch({
      baseUrl: "https://example.com",
      settings: { date: "[DATE]" },
      now: new Date("2026-09-02T09:00:00Z"),
      deps: {
        listCandidates: vi.fn().mockResolvedValue([person]),
        listSends: vi.fn().mockResolvedValue([{ email: person.email, step: 1 }]),
        claim: vi.fn().mockResolvedValue(true),
        finish: vi.fn().mockResolvedValue(undefined),
        release: vi.fn().mockResolvedValue(undefined),
        send,
      } as never,
    });
    const replayCalls = send.mock.calls.filter((call: unknown[]) =>
      (call[0] as { tags: string[] }).tags?.includes(`sequence-${REPLAY_STEP}`),
    );
    expect(replayCalls.length).toBe(0);
    expect(summary.paused).toBe(false);
  });
});
