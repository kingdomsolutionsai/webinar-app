import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { validSignature, parsePayhipEvent, dueSteps } from "./payhip";

const event = {
  id: "ExampleOrder1", email: "Buyer@example.com", type: "paid",
  price: 2200, items: [{ product_key: "Nrvy5" }],
  unconsented_from_emails: false, is_gift: false,
};
describe("Payhip webhook", () => {
  it("validates the documented SHA-256 signature", () => {
    const signature = createHash("sha256").update("test-key").digest("hex");
    expect(validSignature(signature, "test-key")).toBe(true);
    expect(validSignature(signature, "another-key")).toBe(false);
    expect(validSignature(undefined, "test-key")).toBe(false);
  });
  it("recognizes an explicitly consenting customer", () => {
    expect(parsePayhipEvent(event)).toMatchObject({ workshop: true, consent: true, email: "buyer@example.com", refunded: false });
  });
  it("does not grant marketing consent when denied or missing", () => {
    expect(parsePayhipEvent({ ...event, unconsented_from_emails: true })).toMatchObject({ consent: false });
    expect(parsePayhipEvent({ ...event, unconsented_from_emails: undefined })).toMatchObject({ consent: false });
  });
  it("keeps other products out of the Q1 reminder queue", () => {
    expect(parsePayhipEvent({ ...event, items: [{ product_key: "Other" }] })).toMatchObject({ workshop: false });
  });
  it("recognizes zero-cost orders if delivered as paid events", () => {
    expect(parsePayhipEvent({ ...event, price: 0 })).toMatchObject({ workshop: true });
  });
  it("distinguishes full from partial refunds", () => {
    expect(parsePayhipEvent({ ...event, type: "refunded", amount_refunded: 2200 })).toMatchObject({ refunded: true });
    expect(parsePayhipEvent({ ...event, type: "refunded", amount_refunded: 100 })).toEqual({ ignored: true });
  });
  it("rejects invalid contact details", () => {
    expect(parsePayhipEvent({ ...event, email: "" })).toBeNull();
  });
});
describe("Q1 Ready reminder windows", () => {
  const start = Date.parse("2026-12-08T18:00:00Z");
  const min = 60_000;
  const registered = start - 3 * 1440 * min;
  it("uses the 24-hour, one-hour and 15-minute Eastern deadlines", () => {
    expect(dueSteps(start - 1440 * min, registered)).toEqual(["confirmation", "day"]);
    expect(dueSteps(start - 60 * min, registered)).toEqual(["confirmation", "hour"]);
    expect(dueSteps(start - 15 * min, registered)).toEqual(["confirmation", "fifteen"]);
  });
  it("does not send obsolete reminders to late registrants", () => {
    expect(dueSteps(start - 10 * min, start - 11 * min)).toEqual(["confirmation"]);
  });
  it("stops sending when the workshop begins", () => {
    expect(dueSteps(start, registered)).toEqual([]);
  });
});
