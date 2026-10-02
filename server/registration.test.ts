import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * The db module is mocked so these specs exercise validation, authorization and
 * CSV shaping without needing a live database.
 */
const created: unknown[] = [];
const settingWrites: [string, string][] = [];
const emailStatusWrites: [string, string, string][] = [];
const sentSignupEmails: Record<string, unknown>[] = [];
/** Download events the mocked db reports, so the CSV/Opened tests are deterministic. */
let downloadRows: { email: string; resource: string; createdAt: Date }[] = [];
/** Flipped by the suppression test to simulate an address that opted out. */
let unsubscribedFlag = false;

const sampleRows = [
  {
    id: 2,
    firstName: "Ada",
    lastName: "Byron",
    email: "ada@example.com",
    track: "pre_revenue" as string | null,
    resource: "checklist" as string | null,
    emailStatus: "sent" as string | null,
    emailDetail: "<abc@brevo>" as string | null,
    createdAt: new Date("2026-08-02T15:04:05Z"),
    updatedAt: new Date("2026-08-02T15:04:05Z"),
  },
  {
    id: 1,
    // Deliberately hostile values: a comma, a quote, and a formula prefix.
    firstName: 'Grace, "Amazing"',
    lastName: "=cmd|' /c calc'!A1",
    email: "grace@example.com",
    track: null as string | null,
    resource: null as string | null,
    emailStatus: null as string | null,
    emailDetail: null as string | null,
    createdAt: new Date("2026-08-01T09:00:00Z"),
    updatedAt: new Date("2026-08-01T09:00:00Z"),
  },
];

vi.mock("./db", () => ({
  createRegistration: vi.fn(async (input: Record<string, unknown>) => {
    created.push(input);
    return { ...input, id: 99, createdAt: new Date(), updatedAt: new Date() };
  }),
  listRegistrations: vi.fn(async () => sampleRows),
  getAllEventSettings: vi.fn(async () => ({
    date: "Thursday, September 18",
    joinUrl: "https://zoom.us/j/123456789?pwd=secret",
    zoomPasscode: "999999",
  })),
  setEventSetting: vi.fn(async (key: string, value: string) => {
    settingWrites.push([key, value]);
  }),
  setRegistrationEmailStatus: vi.fn(async (email: string, status: string, detail: string) => {
    emailStatusWrites.push([email, status, detail]);
  }),
  isUnsubscribed: vi.fn(async () => unsubscribedFlag),
  unsubscribeByEmail: vi.fn(async (email: string) => ({
    firstName: "Ada",
    email,
    unsubscribedAt: null,
  })),
  listDownloads: vi.fn(async () => downloadRows),
  listSequenceCandidates: vi.fn(async () => []),
  listSequenceSends: vi.fn(async () => []),
  claimSequenceStep: vi.fn(async () => true),
  finishSequenceStep: vi.fn(async () => undefined),
  releaseSequenceStep: vi.fn(async () => undefined),
}));

/**
 * The mail module is mocked so no real send happens during these specs. The real
 * Brevo payload is covered separately in `email.test.ts`.
 */
vi.mock("./email", () => ({
  sendSignupEmails: vi.fn(async (input: Record<string, unknown>) => {
    sentSignupEmails.push(input);
    return { ok: true as const, messageId: "<test@brevo>" };
  }),
  sendEmail: vi.fn(async () => ({ ok: true as const, messageId: "<preview@brevo>" })),
}));

const { appRouter } = await import("./routers");

function makeCtx(role?: "user" | "admin"): TrpcContext {
  return {
    user: role
      ? {
          id: 1,
          openId: "open-id",
          email: "owner@example.com",
          name: "Owner",
          loginMethod: "manus",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

beforeEach(() => {
  created.length = 0;
  settingWrites.length = 0;
  emailStatusWrites.length = 0;
  sentSignupEmails.length = 0;
  unsubscribedFlag = false;
});

describe("registration.create", () => {
  it("stores a valid registration and normalizes the email", async () => {
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.registration.create({
      firstName: "  Tabitha ",
      lastName: " Rector ",
      email: "Tabitha@Example.COM",
      track: "serving_clients",
    });

    expect(result.success).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      firstName: "Tabitha",
      lastName: "Rector",
      email: "Tabitha@Example.COM",
      track: "serving_clients",
    });
  });

  it("accepts a submission with no track selected", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.registration.create({
        firstName: "Ann",
        lastName: "Lee",
        email: "ann@example.com",
      }),
    ).resolves.toMatchObject({ success: true });
  });

  it("records which free resource the visitor asked for", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.registration.create({
      firstName: "Mae",
      lastName: "Jemison",
      email: "mae@example.com",
      resource: "checklist",
    });
    expect(created[0]).toMatchObject({ resource: "checklist" });
  });

  it("rejects a resource value that is not one of the offered options", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.registration.create({
        firstName: "Mae",
        lastName: "Jemison",
        email: "mae@example.com",
        // @ts-expect-error deliberately invalid to prove the enum is enforced
        resource: "ebook",
      }),
    ).rejects.toThrow();
    expect(created).toHaveLength(0);
  });

  it("rejects a malformed email address", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.registration.create({
        firstName: "Ann",
        lastName: "Lee",
        email: "not-an-email",
      }),
    ).rejects.toThrow();
    expect(created).toHaveLength(0);
  });

  it("rejects blank names", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.registration.create({
        firstName: "   ",
        lastName: "Lee",
        email: "ann@example.com",
      }),
    ).rejects.toThrow();
    expect(created).toHaveLength(0);
  });
});

describe("owner-only access", () => {
  it("denies registration list to anonymous visitors", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.registration.list()).rejects.toThrow();
  });

  it("denies registration list to a signed-in non-owner", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.registration.list()).rejects.toThrow(/Owner access required/);
  });

  it("allows the owner to read registrations", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const rows = await caller.registration.list();
    expect(rows).toHaveLength(2);
  });

  it("denies settings updates to a non-owner", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(
      caller.settings.update({ values: { date: "September 18" } }),
    ).rejects.toThrow(/Owner access required/);
    expect(settingWrites).toHaveLength(0);
  });
});

describe("registration.exportCsv", () => {
  it("still succeeds for the visitor when the mail provider fails", async () => {
    const { sendSignupEmails } = await import("./email");
    vi.mocked(sendSignupEmails).mockResolvedValueOnce({
      ok: false as const,
      error: "HTTP 400: unverified sender",
    });

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.registration.create({
      firstName: "Mail",
      lastName: "Down",
      email: "mail-down@example.com",
      resource: "chapter",
    });

    // The person who typed their details must still see success.
    expect(result.success).toBe(true);
    expect(result.emailed).toBe(false);
    // And the failure must be recorded so it is visible in the dashboard.
    expect(emailStatusWrites.at(-1)).toEqual([
      "mail-down@example.com",
      "failed",
      "HTTP 400: unverified sender",
    ]);
  });

  it("passes the visitor's resource choice through to the mail layer", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.registration.create({
      firstName: "Pick",
      lastName: "Checklist",
      email: "pick@example.com",
      resource: "checklist",
      track: "reorganizing",
    });
    const last = sentSignupEmails.at(-1);
    expect(last).toMatchObject({
      email: "pick@example.com",
      resource: "checklist",
      track: "reorganizing",
    });
  });

  it("produces a header row and one row per registration", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const { csv, count, filename } = await caller.registration.exportCsv();
    const lines = csv.split("\r\n");

    expect(count).toBe(2);
    expect(filename).toMatch(/^ksai-webinar-registrations-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      '"First name","Last name","Email","Track","Resource","Email delivery","Opened","Registered"',
    );
  });

  it("reports what each person opened, and says plainly when they opened nothing", async () => {
    downloadRows = [
      { email: "ada@example.com", resource: "chapter", createdAt: new Date() },
      { email: "ada@example.com", resource: "checklist", createdAt: new Date() },
    ];
    const caller = appRouter.createCaller(makeCtx("admin"));
    const { csv } = await caller.registration.exportCsv();
    downloadRows = [];

    expect(csv).toContain('"chapter + checklist"');
    expect(csv).toContain('"not opened"');
  });

  it("includes the resource choice in the exported rows", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const { csv } = await caller.registration.exportCsv();
    expect(csv).toContain('"checklist"');
  });

  it("reports email delivery, distinguishing sent from never attempted", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const { csv } = await caller.registration.exportCsv();
    expect(csv).toContain('"sent"');
    expect(csv).toContain('"not attempted"');
  });

  it("escapes quotes and commas, and neutralizes formula injection", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const { csv } = await caller.registration.exportCsv();

    // Embedded quotes doubled, comma safely inside quotes.
    expect(csv).toContain('"Grace, ""Amazing"""');
    // Leading "=" prefixed with an apostrophe so spreadsheets treat it as text.
    expect(csv).toContain(`"'=cmd|' /c calc'!A1"`);
  });
});

describe("settings.get", () => {
  it("merges stored values over the placeholder defaults", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const settings = await caller.settings.get();

    expect(settings.date).toBe("Thursday, September 18");
    expect(settings.time).toBe("[TIME]");
    expect(settings.duration).toBe("[DURATION]");
    expect(settings.price).toBe("[PRICE]");
  });

  it("never exposes the Zoom link or passcode to the public page", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const settings = (await caller.settings.get()) as Record<string, string>;

    expect(Object.keys(settings).sort()).toEqual(["date", "duration", "price", "time"]);
    expect(JSON.stringify(settings)).not.toContain("zoom.us");
    expect(JSON.stringify(settings)).not.toContain("999999");
  });
});

describe("unsubscribe and resend", () => {
  it("puts counted download links in the signup email", async () => {
    unsubscribedFlag = false;
    sentSignupEmails.length = 0;
    const caller = appRouter.createCaller(makeCtx());

    await caller.registration.create({
      firstName: "Ada",
      lastName: "Byron",
      email: "links@example.com",
    });

    const payload = sentSignupEmails[0] as {
      trackedUrls?: { chapter: string; checklist: string };
    };
    expect(payload.trackedUrls?.chapter).toContain("/api/download?");
    expect(payload.trackedUrls?.chapter).toContain("r=chapter");
    expect(payload.trackedUrls?.checklist).toContain("r=checklist");
  });

  /**
   * Behind the managed runtime the request host is an internal hostname, so the
   * confirmation panel must build its links from the saved public address. If it
   * ever falls back to the request host, a visitor's download link points at a
   * machine name that will not resolve for them.
   */
  it("builds confirmation download links from the saved public address", async () => {
    const { getAllEventSettings } = await import("./db");
    const { PUBLIC_URL_KEY } = await import("@shared/event");
    vi.mocked(getAllEventSettings).mockResolvedValueOnce({
      [PUBLIC_URL_KEY]: "https://webinarreg-wksscmbd.manus.space",
    } as never);

    const caller = appRouter.createCaller({
      ...makeCtx(),
      req: { protocol: "https", headers: { host: "internal-run-host.a.run.app" } },
    } as TrpcContext);

    const result = await caller.registration.create({
      firstName: "Ada",
      lastName: "Byron",
      email: "public-url@example.com",
    });

    expect(result.downloads.chapter).toContain("https://webinarreg-wksscmbd.manus.space");
    expect(result.downloads.chapter).not.toContain("run.app");
  });

  it("never emails an address that has opted out, even on a fresh submission", async () => {
    unsubscribedFlag = true;
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.registration.create({
      firstName: "Opted",
      lastName: "Out",
      email: "opted@example.com",
    });

    // The signup still succeeds — they may simply want the downloads on the page.
    expect(result.success).toBe(true);
    expect(result.emailed).toBe(false);
    // But no send was attempted at all.
    expect(sentSignupEmails).toHaveLength(0);
    expect(emailStatusWrites.at(-1)).toEqual([
      "opted@example.com",
      "skipped",
      "Recipient has unsubscribed",
    ]);
  });

  it("rejects an opt-out request whose signature does not match", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.registration.unsubscribe({
      email: "ada@example.com",
      token: "not-a-real-token",
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("honours a correctly signed opt-out without requiring login", async () => {
    const { signUnsubscribe } = await import("./unsubscribe");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.registration.unsubscribe({
      email: "ada@example.com",
      token: signUnsubscribe("ada@example.com"),
    });
    expect(result.ok).toBe(true);
  });

  it("denies resend to anyone who is not the owner", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.registration.resend({ email: "ada@example.com" })).rejects.toThrow(
      /Owner access required/,
    );
  });

  it("lets the owner resend to an existing registration", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.registration.resend({ email: "ada@example.com" });
    expect(result.ok).toBe(true);
    expect(sentSignupEmails.at(-1)).toMatchObject({ email: "ada@example.com" });
  });

  it("refuses to resend to an address that is not on the list", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.registration.resend({ email: "stranger@example.com" });
    expect(result.ok).toBe(false);
    expect(sentSignupEmails).toHaveLength(0);
  });
});
