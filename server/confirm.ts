import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalEmail } from "./unsubscribe";

function secret(): string {
  return process.env.JWT_SECRET || "unsubscribe-development-fallback";
}

export function signConfirm(email: string, sessionKey?: string): string {
  return createHmac("sha256", secret()).update(`confirm:${canonicalEmail(email)}${sessionKey ? `:${sessionKey}` : ""}`).digest("hex").slice(0, 32);
}

export function verifyConfirm(email: string, token: string, sessionKey?: string): boolean {
  const expected = signConfirm(email, sessionKey);
  if (typeof token !== "string" || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function confirmUrl(baseUrl: string, email: string, sessionKey?: string): string {
  const params = new URLSearchParams({ e: canonicalEmail(email), t: signConfirm(email, sessionKey) });
  if (sessionKey) params.set("s", sessionKey);
  return `${baseUrl.replace(/\/+$/, "")}/confirm?${params.toString()}`;
}
