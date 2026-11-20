import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { getAllEventSettings } from "./db";
import { createSessionRegistration } from "./sessions";
import { sendEmail } from "./email";
import { subscribeWebinarRegistrant, syncFutureRegistration, syncInBackground } from "./brevo";

vi.mock("./db", async original => ({ ...await original<typeof import("./db")>(), getAllEventSettings: vi.fn() }));
vi.mock("./sessions", async original => ({ ...await original<typeof import("./sessions")>(), createSessionRegistration: vi.fn() }));
vi.mock("./email", async original => ({ ...await original<typeof import("./email")>(), sendEmail: vi.fn() }));
vi.mock("./brevo", async original => ({ ...await original<typeof import("./brevo")>(), syncInBackground: vi.fn(), syncFutureRegistration: vi.fn(async () => {}), subscribeWebinarRegistrant: vi.fn(async () => true) }));

const caller = appRouter.createCaller({ req: { protocol: "https", headers: { host: "example.test" } } } as unknown as TrpcContext);
const event = { date: "December 8, 2099", time: "11 AM", joinUrl: "https://example.test/j/123", zoomPasscode: "test-code" };
const input = { eventDate: event.date, firstName: "Test", lastName: "Attendee", email: "attendee@example.test" };

describe("session access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAllEventSettings).mockResolvedValue(event);
    vi.mocked(createSessionRegistration).mockResolvedValue({ ...input } as Awaited<ReturnType<typeof createSessionRegistration>>);
    vi.mocked(sendEmail).mockResolvedValue({ ok: true, messageId: "accepted" });
  });

  it("emails joining details at signup without marketing enrollment", async () => {
    expect((await caller.registration.create(input)).emailed).toBe(true);
    const message = vi.mocked(sendEmail).mock.calls[0][0];
    expect(message.text).toContain(event.joinUrl);
    expect(message.text).toContain(event.zoomPasscode);
    expect(message.text).toContain("/downloads/Finding-Your-Business-Gap-5-Minute-Clarity-Exercise.pdf");
    expect(subscribeWebinarRegistrant).not.toHaveBeenCalled();
    expect(syncFutureRegistration).toHaveBeenCalled();
    expect(syncInBackground).not.toHaveBeenCalled();
  });

  it("preserves event access when the optional marketing signup fails", async () => {
    vi.mocked(subscribeWebinarRegistrant).mockRejectedValueOnce(new Error("offline"));
    const result = await caller.registration.create({ ...input, marketingConsent: true });
    expect(result.emailed).toBe(true);
    expect(result.marketingSubscribed).toBe(false);
    expect(subscribeWebinarRegistrant).toHaveBeenCalledWith(input.email);
  });

  it("adds a registrant to the marketing list when checked", async () => {
    const result = await caller.registration.create({ ...input, marketingConsent: true });
    expect(result.marketingSubscribed).toBe(true);
    expect(result.emailed).toBe(true);
    expect(subscribeWebinarRegistrant).toHaveBeenCalledWith(input.email);
  });

  it("allows retry after a delivery failure", async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce({ ok: false, error: "unavailable" });
    expect((await caller.registration.create(input)).emailed).toBe(false);
    expect((await caller.registration.create(input)).emailed).toBe(true);
  });

  it.each([{ ...event, date: "November 17, 2000" }, { ...event, joinUrl: "" }])("closes unavailable sessions", async settings => {
    vi.mocked(getAllEventSettings).mockResolvedValue(settings);
    expect((await caller.settings.get()).registrationOpen).toBe(false);
    await expect(caller.registration.create({ ...input, eventDate: settings.date })).rejects.toThrow();
    expect(createSessionRegistration).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
