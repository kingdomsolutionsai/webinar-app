import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * The db module is mocked so these specs exercise validation, authorization and
 * CSV shaping without needing a live database.
 */
const eventDate = "December 8, 2099";
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
    confirmedAt: new Date("2026-08-02T15:04:05Z"),
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

vi.mock("./brevo", () => ({ syncFutureRegistration: vi.fn(async () => {}), syncInBackground: vi.fn() }));
vi.mock("./sessions", async original => ({
  ...await original<typeof import("./sessions")>(),
  unsubscribeSessions: vi.fn(async () => {}),
  createSessionRegistration: vi.fn(async input => {
    created.push(input);
    return { ...input, email: input.email.toLowerCase() };
  }),
}));

vi.mock("./db", () => ({
  createRegistration: vi.fn(async (input: Record<string, unknown>) => {
    created.push(input);
    return { ...input, id: 99, createdAt: new Date(), updatedAt: new Date() };
  }),
  listRegistrations: vi.fn(async () => sampleRows),
  getAllEventSettings: vi.fn(async () => ({
    date: eventDate,
    time: "11 AM",
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
vi.mock("./email", async original => ({
  ...await original<typeof import("./email")>(),
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
      eventDate,
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
      eventDate,
        firstName: "Ann",
        lastName: "Lee",
        email: "ann@example.com",
      }),
    ).resolves.toMatchObject({ success: true });
  });

  it("keeps legacy resource choices out of dated event registrations", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.registration.create({
      eventDate,
      firstName: "Mae",
      lastName: "Jemison",
      email: "mae@example.com",
      resource: "checklist",
    });
    expect(created[0]).toMatchObject({ sessionKey: "2099-12-08" });
    expect(created[0]).not.toHaveProperty("resource");
  });

  it("rejects a resource value that is not one of the offered options", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.registration.create({
      eventDate,
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
      eventDate,
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
      eventDate,
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
    const { sendEmail } = await import("./email");
    vi.mocked(sendEmail).mockResolvedValueOnce({
      ok: false as const,
      error: "HTTP 400: unverified sender",
    });

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.registration.create({
      eventDate,
      firstName: "Mail",
      lastName: "Down",
      email: "mail-down@example.com",
      resource: "chapter",
    });

    // The person who typed their details must still see success.
    expect(result.success).toBe(true);
    expect(result.emailed).toBe(false);
    expect(created).toHaveLength(1);
  });

  it("keeps session mail separate from legacy resource fulfillment", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.registration.create({
      eventDate,
      firstName: "Pick",
      lastName: "Checklist",
      email: "pick@example.com",
      resource: "checklist",
      track: "reorganizing",
    });
    expect(created[0]).toMatchObject({ email: "pick@example.com", track: "reorganizing" });
    expect(sentSignupEmails).toHaveLength(0);
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

    expect(settings.date).toBe(eventDate);
    expect(settings.time).toBe("11 AM");
    expect(settings.duration).toBe("[DURATION]");
    expect(settings.price).toBe("[PRICE]");
  });

  it("never exposes the Zoom link or passcode to the public page", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const settings = (await caller.settings.get()) as Record<string, string>;

    expect(Object.keys(settings).sort()).toEqual(["date", "duration", "price", "registrationOpen", "time"]);
    expect(JSON.stringify(settings)).not.toContain("zoom.us");
    expect(JSON.stringify(settings)).not.toContain("999999");
  });
});

describe("unsubscribe and resend", () => {
  it("sends only session access at registration", async () => {
    unsubscribedFlag = false;
    sentSignupEmails.length = 0;
    const caller = appRouter.createCaller(makeCtx());

    await caller.registration.create({
      eventDate,
      firstName: "Ada",
      lastName: "Byron",
      email: "links@example.com",
    });

    const { sendEmail } = await import("./email");
    expect(vi.mocked(sendEmail).mock.calls.at(-1)?.[0].text).toContain("https://zoom.us/j/");
    expect(vi.mocked(sendEmail).mock.calls.at(-1)?.[0].text).not.toContain("/api/download");
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
      date: eventDate, time: "11 AM", joinUrl: "https://zoom.test/j/123456789",
      [PUBLIC_URL_KEY]: "https://webinarreg-wksscmbd.manus.space",
    } as never);

    const caller = appRouter.createCaller({
      ...makeCtx(),
      req: { protocol: "https", headers: { host: "internal-run-host.a.run.app" } },
    } as TrpcContext);

    const result = await caller.registration.create({
      eventDate,
      firstName: "Ada",
      lastName: "Byron",
      email: "public-url@example.com",
    });

    const { sendEmail } = await import("./email");
    expect(result.emailed).toBe(true);
    const html = vi.mocked(sendEmail).mock.calls.at(-1)?.[0].html;
    expect(html).toContain("https://webinarreg-wksscmbd.manus.space/unsubscribe");
    expect(html).not.toContain("internal-run-host");
  });

  it("delivers requested event access independently of earlier marketing opt-outs", async () => {
    unsubscribedFlag = true;
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.registration.create({
      eventDate,
      firstName: "Opted",
      lastName: "Out",
      email: "opted@example.com",
    });

    expect(result.emailed).toBe(true);
    expect(result.marketingRequested).toBe(false);
    expect(sentSignupEmails).toHaveLength(0);
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
