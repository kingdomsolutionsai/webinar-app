import { describe, expect, it } from "vitest";
import {
  canonicalEmail,
  signUnsubscribe,
  unsubscribeUrl,
  verifyUnsubscribe,
} from "./unsubscribe";

describe("unsubscribe tokens", () => {
  it("accepts a token it produced for the same address", () => {
    const email = "reader@example.com";
    expect(verifyUnsubscribe(email, signUnsubscribe(email))).toBe(true);
  });

  it("rejects a token issued for a different address", () => {
    // Otherwise one person could unsubscribe another by editing the address.
    const token = signUnsubscribe("reader@example.com");
    expect(verifyUnsubscribe("someone.else@example.com", token)).toBe(false);
  });

  it("rejects a tampered or empty token", () => {
    const email = "reader@example.com";
    const good = signUnsubscribe(email);
    expect(verifyUnsubscribe(email, good.slice(0, -1) + "0")).toBe(false);
    expect(verifyUnsubscribe(email, "")).toBe(false);
  });

  it("ignores capitalisation and surrounding spaces", () => {
    // A mail client may rewrite the address casing; the link must still work.
    const token = signUnsubscribe("Reader@Example.com");
    expect(verifyUnsubscribe("  reader@example.com ", token)).toBe(true);
    expect(canonicalEmail(" READER@example.COM ")).toBe("reader@example.com");
  });

  it("builds an absolute opt-out URL carrying address and signature", () => {
    const url = unsubscribeUrl("https://start.kingdomsolutionsai.com/", "reader@example.com");
    expect(url).toContain("https://start.kingdomsolutionsai.com/unsubscribe?");
    // No double slash from the trailing slash on the base.
    expect(url).not.toContain(".com//unsubscribe");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("e")).toBe("reader@example.com");
    expect(verifyUnsubscribe("reader@example.com", parsed.searchParams.get("t")!)).toBe(true);
  });
});
