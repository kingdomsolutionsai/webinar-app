import { describe, expect, it } from "vitest";
import { decodeOAuthState, encodeOAuthState, sanitizeReturnTo } from "@shared/const";

/**
 * Signing in from /dashboard must return to /dashboard. The path travels through
 * a URL the user can edit, so the same tests that prove the convenience works
 * also prove it cannot be turned into a phishing redirect.
 */
describe("sign-in return path", () => {
  it("keeps a plain in-app path", () => {
    expect(sanitizeReturnTo("/dashboard")).toBe("/dashboard");
  });

  it("keeps a query string, since dashboard state may live there", () => {
    expect(sanitizeReturnTo("/dashboard?sort=created")).toBe("/dashboard?sort=created");
  });

  it("falls back to the front page when nothing was supplied", () => {
    expect(sanitizeReturnTo(undefined)).toBe("/");
    expect(sanitizeReturnTo("")).toBe("/");
  });

  it("refuses an absolute URL, which would be an open redirect", () => {
    expect(sanitizeReturnTo("https://evil.test/steal")).toBe("/");
  });

  it("refuses a scheme-relative URL", () => {
    // "//evil.test" is a valid absolute URL to a browser, and the classic bypass.
    expect(sanitizeReturnTo("//evil.test")).toBe("/");
  });

  it("refuses backslash variants that some browsers normalise to //", () => {
    expect(sanitizeReturnTo("/\\evil.test")).toBe("/");
    expect(sanitizeReturnTo("/dash\\board")).toBe("/");
  });

  it("refuses embedded newlines, which can split headers", () => {
    expect(sanitizeReturnTo("/dashboard\r\nLocation: https://evil.test")).toBe("/");
  });

  it("never bounces back into the auth endpoints", () => {
    expect(sanitizeReturnTo("/api/oauth/callback")).toBe("/");
  });

  it("survives a round trip through the encoded state", () => {
    const state = encodeOAuthState({
      redirectUri: "https://example.test/api/oauth/callback",
      nonce: "abc",
      returnTo: "/dashboard",
    });
    expect(decodeOAuthState(state).returnTo).toBe("/dashboard");
  });

  it("neutralizes a hostile path that was tampered with inside the state", () => {
    const state = encodeOAuthState({
      redirectUri: "https://example.test/api/oauth/callback",
      nonce: "abc",
      returnTo: "https://evil.test",
    });
    expect(decodeOAuthState(state).returnTo).toBe("/");
  });

  it("gives legacy state objects a sane default rather than undefined", () => {
    const legacy = btoa("https://example.test/api/oauth/callback");
    expect(decodeOAuthState(legacy).returnTo).toBe("/");
  });
});
