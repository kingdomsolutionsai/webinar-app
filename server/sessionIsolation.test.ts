import { describe, expect, it } from "vitest";
import { sessionKeyFor } from "./sessions";
import { signConfirm, verifyConfirm } from "./confirm";
describe("future webinar registration isolation", () => {
  it("keeps the legacy October 20 event on the original registration path", () => {
    expect(sessionKeyFor("Tuesday, October 20, 2026")).toBeNull();
  });
  it("gives November and December different event keys", () => {
    expect(sessionKeyFor("Tuesday, November 17, 2026")).toBe("2026-11-17");
    expect(sessionKeyFor("Tuesday, December 8, 2026")).toBe("2026-12-08");
  });
  it("does not accept November links for the December session", () => {
    const token=signConfirm("Attendee@example.com","2026-11-17");
    expect(verifyConfirm("attendee@example.com",token,"2026-11-17")).toBe(true);
    expect(verifyConfirm("attendee@example.com",token,"2026-12-08")).toBe(false);
    expect(verifyConfirm("attendee@example.com",token)).toBe(false);
  });
  it("does not accept the legacy October confirmation for November", () => {
    const oldToken=signConfirm("attendee@example.com");
    expect(verifyConfirm("attendee@example.com",oldToken,"2026-11-17")).toBe(false);
  });
});
