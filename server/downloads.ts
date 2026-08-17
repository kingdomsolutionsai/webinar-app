import { createHmac, timingSafeEqual } from "node:crypto";
import { READINESS_CHECKLIST, SAMPLE_CHAPTER, type ResourceId } from "../shared/event";

/**
 * Counted download links.
 *
 * A signup tells Tabitha somebody was interested. A download tells her somebody
 * actually began. Those are different people, and knowing which is which changes
 * what is worth writing to them next.
 *
 * The link carries the recipient's address, so it is signed for the same reason
 * the unsubscribe link is: an unsigned link would let anyone attribute a download
 * to any address, which would quietly corrupt the only number here worth trusting.
 */

const RESOURCE_FILES: Record<ResourceId, { url: string; filename: string }> = {
  chapter: { url: SAMPLE_CHAPTER.url, filename: SAMPLE_CHAPTER.filename },
  checklist: { url: READINESS_CHECKLIST.url, filename: READINESS_CHECKLIST.filename },
};

export function isResourceId(value: string): value is ResourceId {
  return value === "chapter" || value === "checklist";
}

export function resourceFile(resource: ResourceId) {
  return RESOURCE_FILES[resource];
}

function secret() {
  // Same secret as the session layer. Present in every environment that can send
  // mail, so a link is verifiable wherever it is clicked.
  return process.env.JWT_SECRET ?? "";
}

/** Short signature over address + resource. 16 hex chars is ample for a link. */
export function signDownload(email: string, resource: ResourceId): string {
  return createHmac("sha256", secret())
    .update(`download:${email.trim().toLowerCase()}:${resource}`)
    .digest("hex")
    .slice(0, 16);
}

export function verifyDownload(email: string, resource: ResourceId, token: string): boolean {
  const expected = signDownload(email, resource);
  if (typeof token !== "string" || token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

/**
 * The tracked URL to put in an email or on the confirmation panel.
 *
 * Falls back to the raw file when there is no address to attribute the open to,
 * because an untracked download is a far smaller problem than a broken link.
 */
export function trackedDownloadUrl(
  baseUrl: string,
  resource: ResourceId,
  email?: string | null,
): string {
  const file = RESOURCE_FILES[resource];
  const base = baseUrl.replace(/\/+$/, "");
  if (!email) return `${base}${file.url}`;
  const params = new URLSearchParams({
    r: resource,
    e: email.trim().toLowerCase(),
    t: signDownload(email, resource),
  });
  return `${base}/api/download?${params.toString()}`;
}
