import { describe, expect, it, vi } from "vitest";
import {
  buildFinalLetter,
  buildPostSessionLetter,
  FINAL_STEP,
  POST_SESSION_SCHEDULE,
  REPLAY_STEP,
  runSequenceDispatch,
  selectEventAnchoredStep,
  type SequenceContext,
} from "./sequence";

const ctx: SequenceContext = {
  firstName: "Ada",
  email: "ada@example.com",
  baseUrl: "https://www.whatentrepreneursneedtoknow.com",
  unsubscribeUrl: "https://www.whatentrepreneursneedtoknow.com/unsubscribe?e=x&t=y",
};

const eventDate = "2026-09-15";
const eventTime = "13:00";
const at = (iso: string) => new Date(iso);

describe("the post-session arc runs in order, after the replay letter", () => {
  it("sends the replay letter before anything else", () => {
    expect(
      selectEventAnchoredStep({ eventDate, eventTime, sentSteps: [], now: at("2026-09-25T09:00:00Z") }),
    ).toBe(REPLAY_STEP);
  });

  it("does not begin the arc until the replay letter has actually gone", () => {
    // Far past both post-session windows, but the replay has not been sent.
    const chosen = selectEventAnchoredStep({
      eventDate,
      eventTime,
      sentSteps: [1, 2, 3],
      now: at("2026-10-30T09:00:00Z"),
    });
    expect(chosen).toBe(REPLAY_STEP);
  });

  it("sends letter five three days after the session", () => {
    expect(
      selectEventAnchoredStep({
        eventDate,
        eventTime,
        sentSteps: [REPLAY_STEP],
        now: at("2026-09-17T09:00:00Z"),
      }),
    ).toBeNull();
    expect(
      selectEventAnchoredStep({
        eventDate,
        eventTime,
        sentSteps: [REPLAY_STEP],
        now: at("2026-09-18T14:00:00Z"),
      }),
    ).toBe(5);
  });

  it("sends letter six one week after, and never before letter five", () => {
    expect(
      selectEventAnchoredStep({
        eventDate,
        eventTime,
        sentSteps: [REPLAY_STEP],
        now: at("2026-09-30T09:00:00Z"),
      }),
    ).toBe(5);
    expect(
      selectEventAnchoredStep({
        eventDate,
        eventTime,
        sentSteps: [REPLAY_STEP, 5],
        now: at("2026-09-30T09:00:00Z"),
      }),
    ).toBe(6);
  });

  it("stops for good after letter six", () => {
    expect(
      selectEventAnchoredStep({
        eventDate,
        eventTime,
        sentSteps: [REPLAY_STEP, 5, 6],
        now: at("2027-06-01T09:00:00Z"),
      }),
    ).toBeNull();
  });

  it("sends nothing at all while the date is a placeholder", () => {
    expect(
      selectEventAnchoredStep({
        eventDate: "[DATE]",
        sentSteps: [REPLAY_STEP],
        now: at("2030-01-01T09:00:00Z"),
      }),
    ).toBeNull();
  });

  it("uses the documented three-day and seven-day windows", () => {
    expect(POST_SESSION_SCHEDULE.map(s => s.hoursAfter / 24)).toEqual([3, 7]);
    expect(FINAL_STEP).toBe(6);
  });
});

describe("the two letters say what they should and refuse what they should not", () => {
  it("letter five names the stall without blaming the reader", () => {
    const letter = buildPostSessionLetter(ctx);
    expect(letter.text).toContain("not laziness");
    const all = letter.text.toLowerCase();
    for (const phrase of ["you failed", "excuses", "if you were serious", "no excuse"]) {
      expect(all).not.toContain(phrase);
    }
  });

  it("letter five leaves the person who already started alone", () => {
    expect(buildPostSessionLetter(ctx).text).toContain("you do not need anything else from me");
  });

  it("letter six states plainly that it is the last one", () => {
    const letter = buildFinalLetter(ctx);
    expect(letter.subject).toBe("The last letter");
    expect(letter.text).toContain("last of these letters");
  });

  it("letter six withdraws nothing and invents no deadline", () => {
    const all = buildFinalLetter(ctx).text.toLowerCase();
    expect(all).toContain("nothing here expires");
    // Note: "expires" appears only in the reassurance "nothing here expires",
    // so it is excluded from this list rather than banned outright.
    for (const word of ["last chance", "final offer", "closing soon", "act now", "before it is too late"]) {
      expect(all).not.toContain(word);
    }
  });

  it("both letters carry an unsubscribe route", () => {
    for (const letter of [buildPostSessionLetter(ctx), buildFinalLetter(ctx)]) {
      expect(letter.text).toContain("To stop receiving these");
    }
  });
});

describe("dispatch never repeats a post-session letter", () => {
  const person = {
    firstName: "Ada",
    lastName: "Bennett",
    email: "ada@example.com",
    createdAt: new Date("2026-08-01T09:00:00Z"),
    unsubscribedAt: null,
  };

  it("claims each step once and sends the arc in order across runs", async () => {
    const sent: number[] = [];
    const send = vi.fn().mockResolvedValue({ ok: true, messageId: "m" });
    const makeDeps = () =>
      ({
        listCandidates: vi.fn().mockResolvedValue([person]),
        listSends: vi
          .fn()
          .mockResolvedValue(sent.map(step => ({ email: person.email, step }))),
        claim: vi.fn().mockResolvedValue(true),
        finish: vi.fn(async (_e: string, step: number) => {
          sent.push(step);
        }),
        release: vi.fn().mockResolvedValue(undefined),
        send,
      }) as never;

    const settings = { date: eventDate, time: eventTime };
    for (const day of ["2026-09-16", "2026-09-19", "2026-09-23", "2026-09-30"]) {
      await runSequenceDispatch({
        baseUrl: "https://example.com",
        settings,
        now: at(`${day}T09:00:00Z`),
        deps: makeDeps(),
      });
    }

    // Replay, then five, then six — each exactly once, and nothing after.
    expect(sent).toEqual([REPLAY_STEP, 5, 6]);
  });

  it("sends nothing whatsoever after the last letter, including unsent signup letters", async () => {
    // This person joined days before the session, so letters 1-3 are still
    // technically outstanding. "The last letter" must still mean the last letter.
    const send = vi.fn().mockResolvedValue({ ok: true, messageId: "m" });
    const summary = await runSequenceDispatch({
      baseUrl: "https://example.com",
      settings: { date: eventDate, time: eventTime },
      now: at("2026-10-15T09:00:00Z"),
      deps: {
        listCandidates: vi.fn().mockResolvedValue([
          { ...person, createdAt: new Date("2026-09-14T09:00:00Z") },
        ]),
        listSends: vi
          .fn()
          .mockResolvedValue([REPLAY_STEP, 5, 6].map(step => ({ email: person.email, step }))),
        claim: vi.fn().mockResolvedValue(true),
        finish: vi.fn().mockResolvedValue(undefined),
        release: vi.fn().mockResolvedValue(undefined),
        send,
      } as never,
    });
    expect(send).not.toHaveBeenCalled();
    expect(summary.sent).toBe(0);
    expect(summary.skipped).toBe(1);
  });
});
