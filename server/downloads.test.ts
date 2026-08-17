import { beforeAll, describe, expect, it } from "vitest";
import {
  isResourceId,
  resourceFile,
  signDownload,
  trackedDownloadUrl,
  verifyDownload,
} from "./downloads";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-for-download-links";
});

describe("download link signing", () => {
  it("accepts a signature it produced", () => {
    const token = signDownload("reader@example.com", "chapter");
    expect(verifyDownload("reader@example.com", "chapter", token)).toBe(true);
  });

  it("is case and whitespace insensitive, since mail clients rewrite addresses", () => {
    const token = signDownload("reader@example.com", "chapter");
    expect(verifyDownload("  Reader@Example.com  ", "chapter", token)).toBe(true);
  });

  it("rejects a token issued for a different address", () => {
    const token = signDownload("someone@example.com", "chapter");
    expect(verifyDownload("other@example.com", "chapter", token)).toBe(false);
  });

  it("rejects a token issued for the other resource, so opens cannot be misattributed", () => {
    const token = signDownload("reader@example.com", "chapter");
    expect(verifyDownload("reader@example.com", "checklist", token)).toBe(false);
  });

  it("rejects a forged or truncated token without throwing", () => {
    expect(verifyDownload("reader@example.com", "chapter", "")).toBe(false);
    expect(verifyDownload("reader@example.com", "chapter", "deadbeef")).toBe(false);
    expect(verifyDownload("reader@example.com", "chapter", "z".repeat(16))).toBe(false);
  });
});

describe("resource identity", () => {
  it("recognises only the two real resources", () => {
    expect(isResourceId("chapter")).toBe(true);
    expect(isResourceId("checklist")).toBe(true);
    expect(isResourceId("both")).toBe(false);
    expect(isResourceId("../../etc/passwd")).toBe(false);
  });

  it("maps each resource to a stored file", () => {
    expect(resourceFile("chapter").url).toContain(".pdf");
    expect(resourceFile("checklist").url).toContain(".pdf");
    expect(resourceFile("chapter").url).not.toBe(resourceFile("checklist").url);
  });
});

describe("tracked URLs", () => {
  const base = "https://start.kingdomsolutionsai.com";

  it("builds an absolute counted link carrying resource, address and signature", () => {
    const url = new URL(trackedDownloadUrl(base, "chapter", "reader@example.com"));
    expect(url.origin).toBe(base);
    expect(url.pathname).toBe("/api/download");
    expect(url.searchParams.get("r")).toBe("chapter");
    expect(url.searchParams.get("e")).toBe("reader@example.com");
    expect(
      verifyDownload("reader@example.com", "chapter", url.searchParams.get("t") ?? ""),
    ).toBe(true);
  });

  it("falls back to the raw file when there is no address, so a link is never dead", () => {
    const url = trackedDownloadUrl(base, "checklist", null);
    expect(url).toBe(`${base}${resourceFile("checklist").url}`);
    expect(url).not.toContain("/api/download");
  });

  it("does not double a trailing slash on the configured base address", () => {
    const url = trackedDownloadUrl(`${base}/`, "chapter", "reader@example.com");
    expect(url.startsWith(`${base}/api/download`)).toBe(true);
  });
});
