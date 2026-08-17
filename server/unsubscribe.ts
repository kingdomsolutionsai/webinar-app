import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * An unsubscribe link has to work with no login, from any mail client, long
 * after it was sent. So the link carries the address plus a signature over it,
 * and we verify the signature rather than storing single-use tokens that could
 * expire or be lost.
 *
 * Signed with JWT_SECRET, which the platform already provides and injects.
 */
function secret(): string {
  return process.env.JWT_SECRET || "unsubscribe-development-fallback";
}

/** Lowercased and trimmed, so a signature never depends on how it was typed. */
export function canonicalEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function signUnsubscribe(email: string): string {
  return createHmac("sha256", secret()).update(canonicalEmail(email)).digest("hex").slice(0, 32);
}

export function verifyUnsubscribe(email: string, token: string): boolean {
  const expected = signUnsubscribe(email);
  if (typeof token !== "string" || token.length !== expected.length) return false;
  // Constant-time compare so a token cannot be discovered by timing.
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

/** The opt-out URL placed in the email footer. */
export function unsubscribeUrl(baseUrl: string, email: string): string {
  const params = new URLSearchParams({
    e: canonicalEmail(email),
    t: signUnsubscribe(email),
  });
  return `${baseUrl.replace(/\/+$/, "")}/unsubscribe?${params.toString()}`;
}

