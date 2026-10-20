import { beforeEach, describe, expect, it, vi } from "vitest";

const deliver = vi.fn(async (_input: { text: string; html: string }) => ({ ok: true as const, messageId: "test-message" }));
vi.mock("./email", () => ({ sendEmail: deliver }));
vi.mock("./db", () => ({ recordDownload: vi.fn() }));
vi.mock("./brevo", () => ({ syncInBackground: vi.fn() }));
vi.mock("./_core/env", () => ({ ENV: { cronSecret: "test" } }));

const { feedbackHandler } = await import("./routes");

function makeRes() {
  return {
    code: 200,
    payload: undefined as unknown,
    status(code: number) { this.code = code; return this; },
    json(payload: unknown) { this.payload = payload; return this; },
  };
}
const valid = {
  name: "Sample Attendee",
  email: "person@example.com",
  helpful: "very",
  mostValuable: "eight_systems",
  confusing: "",
  question: "Where should I start?",
  nextAction: "Review my offer",
  website: "",
};
let ipNumber = 0;
const req = (body: unknown) => ({ body, ip: "test-ip-" + ++ipNumber });

beforeEach(() => {
  deliver.mockClear();
  deliver.mockResolvedValue({ ok: true, messageId: "test-message" });
});

describe("POST /api/webinar-feedback", () => {
  it("sends feedback only to the owner and accepts optional text", async () => {
    const res = makeRes();
    await feedbackHandler(req(valid) as never, res as never);
    expect(res.code).toBe(200);
    expect(res.payload).toEqual({ ok: true });
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0][0].text).toContain("Where should I start?");
  });
  it("rejects incomplete or invalid submissions", async () => {
    const res = makeRes();
    await feedbackHandler(req({ ...valid, mostValuable: "invented" }) as never, res as never);
    expect(res.code).toBe(400);
    expect(deliver).not.toHaveBeenCalled();
  });
  it("silently discards honeypot submissions", async () => {
    const res = makeRes();
    await feedbackHandler(req({ ...valid, website: "https://spam.example" }) as never, res as never);
    expect(res.code).toBe(200);
    expect(deliver).not.toHaveBeenCalled();
  });
  it("does not confirm receipt when email delivery fails", async () => {
    deliver.mockResolvedValueOnce({ ok: false, error: "unavailable" } as never);
    const res = makeRes();
    await feedbackHandler(req(valid) as never, res as never);
    expect(res.code).toBe(503);
  });
  it("escapes HTML supplied by attendees in the owner notification", async () => {
    const res = makeRes();
    await feedbackHandler(req({ ...valid, question: "<script>alert(1)</script>" }) as never, res as never);
    expect(res.code).toBe(200);
    expect(deliver.mock.calls[0][0].html).toContain("&lt;script&gt;");
    expect(deliver.mock.calls[0][0].html).not.toContain("<script>");
  });
});
