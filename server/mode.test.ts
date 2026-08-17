import { describe, expect, it } from "vitest";
import {
  CORE_PROMISE,
  CORE_PROMISE_SHORT,
  EVENT_DEFAULTS,
  EXERCISE_PROMPT,
  isPlaceholder,
  MODE_COPY,
  normalizePublicUrl,
  resolveEmailBaseUrl,
  resolveMode,
  SAMPLE_CHAPTER,
} from "../shared/event";

describe("resolveMode", () => {
  it("is waitlist while the date is still the shipped placeholder", () => {
    expect(resolveMode(EVENT_DEFAULTS.date)).toBe("waitlist");
  });

  it("is waitlist for empty, whitespace, or missing values", () => {
    expect(resolveMode("")).toBe("waitlist");
    expect(resolveMode("   ")).toBe("waitlist");
    expect(resolveMode(null)).toBe("waitlist");
    expect(resolveMode(undefined)).toBe("waitlist");
  });

  it("is waitlist for any bracketed placeholder the owner might type", () => {
    expect(resolveMode("[TBD]")).toBe("waitlist");
    expect(resolveMode("[coming soon]")).toBe("waitlist");
  });

  it("switches to scheduled as soon as a real date is entered", () => {
    expect(resolveMode("March 12, 2027")).toBe("scheduled");
    expect(resolveMode("2027-03-12")).toBe("scheduled");
    expect(resolveMode("Thursday, March 12")).toBe("scheduled");
  });

  it("treats a date that merely mentions brackets as scheduled", () => {
    // Only a fully bracketed value is a placeholder; partial brackets are real text.
    expect(resolveMode("March 12 [evening]")).toBe("scheduled");
  });
});

describe("isPlaceholder", () => {
  it("agrees with resolveMode on every default", () => {
    for (const value of Object.values(EVENT_DEFAULTS)) {
      const placeholder = isPlaceholder(value);
      expect(placeholder).toBe(resolveMode(value) === "waitlist");
    }
  });
});

describe("MODE_COPY", () => {
  it("defines every copy slot for both modes", () => {
    const keys = Object.keys(MODE_COPY.scheduled).sort();
    expect(Object.keys(MODE_COPY.waitlist).sort()).toEqual(keys);
    for (const mode of ["waitlist", "scheduled"] as const) {
      for (const key of keys) {
        const value = MODE_COPY[mode][key as keyof (typeof MODE_COPY)["scheduled"]];
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it("does not promise a seat while no date exists", () => {
    const waitlistCopy = Object.values(MODE_COPY.waitlist).join(" ").toLowerCase();
    expect(waitlistCopy).not.toContain("seat");
    expect(waitlistCopy).not.toContain("reserve");
  });
});

describe("SAMPLE_CHAPTER", () => {
  it("points at an uploaded storage asset, not a local path", () => {
    expect(SAMPLE_CHAPTER.url.startsWith("/manus-storage/")).toBe(true);
    expect(SAMPLE_CHAPTER.url.endsWith(".pdf")).toBe(true);
  });

  it("downloads under a descriptive filename", () => {
    expect(SAMPLE_CHAPTER.filename.endsWith(".pdf")).toBe(true);
    expect(SAMPLE_CHAPTER.filename).not.toContain(" ");
  });
});

describe("approved copy", () => {
  const allCopy = [
    CORE_PROMISE,
    CORE_PROMISE_SHORT,
    ...Object.values(EXERCISE_PROMPT),
  ].join(" ");

  it("contains no unfilled placeholder markers", () => {
    // Guards against shipping bracketed stand-in copy to a live page.
    expect(allCopy).not.toMatch(/\[[A-Z _-]{3,}\]/);
    expect(allCopy.toLowerCase()).not.toContain("to be supplied");
    expect(allCopy.toLowerCase()).not.toContain("placeholder");
    expect(allCopy.toLowerCase()).not.toContain("lorem");
  });

  it("keeps the exercise in three parts, including the reframe", () => {
    // The reframe is the part that means nobody leaves having failed the ask.
    expect(EXERCISE_PROMPT.instruction.length).toBeGreaterThan(60);
    expect(EXERCISE_PROMPT.check.length).toBeGreaterThan(40);
    expect(EXERCISE_PROMPT.reframe.toLowerCase()).toContain("not a failure");
    expect(EXERCISE_PROMPT.reframe.toLowerCase()).toContain("diagnosis");
  });

  it("states the promise as order, never as guaranteed revenue", () => {
    const promise = CORE_PROMISE.toLowerCase();
    expect(promise).toContain("right order");
    for (const forbidden of ["guarantee", "guaranteed", "six figures", "get rich"]) {
      expect(promise).not.toContain(forbidden);
    }
  });
});

describe("normalizePublicUrl", () => {
  it("adds https when the owner types a bare domain", () => {
    expect(normalizePublicUrl("webinar.kingdomsolutionsai.com")).toBe(
      "https://webinar.kingdomsolutionsai.com",
    );
  });

  it("keeps an explicit scheme and strips trailing slashes", () => {
    expect(normalizePublicUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizePublicUrl("http://example.com///")).toBe("http://example.com");
  });

  it("treats blank input as unset rather than inventing a URL", () => {
    expect(normalizePublicUrl("")).toBe("");
    expect(normalizePublicUrl("   ")).toBe("");
  });
});

describe("resolveEmailBaseUrl", () => {
  it("prefers the configured public address over the request origin", () => {
    // This is the fix for images breaking in mail sent from a preview URL.
    expect(
      resolveEmailBaseUrl("webinar.kingdomsolutionsai.com", "https://3000-sandbox.example"),
    ).toBe("https://webinar.kingdomsolutionsai.com");
  });

  it("falls back to the request origin when nothing is configured", () => {
    expect(resolveEmailBaseUrl(undefined, "https://3000-sandbox.example")).toBe(
      "https://3000-sandbox.example",
    );
    expect(resolveEmailBaseUrl("", "https://3000-sandbox.example")).toBe(
      "https://3000-sandbox.example",
    );
  });
});
