import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level specs for the two plain Express endpoints: the counted download
 * redirect, and the cron-only sequence dispatch.
 */

const recorded: { email: string; resource: string; userAgent?: string | null }[] = [];

vi.mock("./db", () => ({
  recordDownload: vi.fn(async (input: { email: string; resource: string }) => {
    recorded.push(input);
  }),
  getAllEventSettings: vi.fn(async () => ({})),
}));

/** Dispatch itself is covered in sequence.test.ts; here we only assert the guard. */
const dispatch = vi.fn(async () => ({
  considered: 0,
  sent: 0,
  failed: 0,
  skipped: 0,
  paused: false,
}));
vi.mock("./sequence", () => ({ runSequenceDispatch: dispatch }));

const synced: string[] = [];
vi.mock("./brevo", () => ({ syncInBackground: vi.fn((email: string) => synced.push(email)) }));

vi.mock("./_core/env", () => ({ ENV: { cronSecret: "cron-secret" } }));

let authResult: { isCron?: boolean; taskUid?: string } | Error = { isCron: true, taskUid: "t1" };
vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn(async () => {
      if (authResult instanceof Error) throw authResult;
      return authResult;
    }),
  },
}));

const { downloadHandler, sequenceHandler } = await import("./routes");
const { signDownload } = await import("./downloads");

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-for-routes";
});

beforeEach(() => {
  recorded.length = 0;
  synced.length = 0;
  dispatch.mockClear();
});

function makeRes() {
  const res = {
    statusCode: 200,
    redirectedTo: "" as string,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
    redirect(code: number, url: string) {
      this.statusCode = code;
      this.redirectedTo = url;
      return this;
    },
  };
  return res;
}

function makeReq(query: Record<string, string>, userAgent = "Mozilla/5.0") {
  return {
    query,
    headers: { "user-agent": userAgent },
    originalUrl: "/api/download",
  };
}

describe("GET /api/download", () => {
  it("records the open and redirects to the stored file", async () => {
    const email = "reader@example.com";
    const res = makeRes();
    await downloadHandler(
      makeReq({ r: "chapter", e: email, t: signDownload(email, "chapter") }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(302);
    expect(res.redirectedTo).toContain(".pdf");
    expect(recorded).toEqual([
      { email, resource: "chapter", userAgent: "Mozilla/5.0" },
    ]);
  });

  it("still delivers the file when the signature is wrong, but does not count it", async () => {
    // A visitor with a mangled link did nothing wrong and should get their file;
    // counting it would corrupt the only engagement number Tabitha relies on.
    const res = makeRes();
    await downloadHandler(
      makeReq({ r: "checklist", e: "reader@example.com", t: "0".repeat(16) }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(302);
    expect(res.redirectedTo).toContain(".pdf");
    expect(recorded).toHaveLength(0);
  });

  it("serves the file for a link with no address at all", async () => {
    const res = makeRes();
    await downloadHandler(makeReq({ r: "chapter" }) as never, res as never);
    expect(res.statusCode).toBe(302);
    expect(recorded).toHaveLength(0);
  });

  it("refuses an unknown resource rather than guessing", async () => {
    const res = makeRes();
    await downloadHandler(makeReq({ r: "../secrets", e: "a@b.com", t: "x" }) as never, res as never);
    expect(res.statusCode).toBe(404);
    expect(res.redirectedTo).toBe("");
  });
});

describe("POST /api/scheduled/sequence (retired: Brevo sends now)", () => {
  it("answers the Render cron job without sending anything", async () => {
    const res = makeRes();
    await sequenceHandler(
      { headers: { "x-cron-secret": "cron-secret" }, query: {}, originalUrl: "/api/scheduled/sequence" } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, handedToBrevo: true, sent: 0 });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("still refuses a caller without the cron secret", async () => {
    const res = makeRes();
    await sequenceHandler(
      { headers: {}, query: {}, originalUrl: "/api/scheduled/sequence" } as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
