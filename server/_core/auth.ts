// Single-admin login. Replaces the Manus OAuth identity provider.
// The password is never stored — only a bcrypt hash lives in the ADMIN_PASSWORD_HASH
// env var. On successful login the admin's user row is ensured in the DB so the
// rest of the app (which keys off users.openId) works unchanged.

import bcrypt from "bcryptjs";
import * as db from "../db";
import { ENV } from "./env";

/** The admin's stable account id. Using the email keeps it human-readable. */
export function adminOpenId(): string {
  return ENV.adminEmail || "admin";
}

/**
 * Verify a login attempt. Returns the admin openId on success, null otherwise.
 * Constant-ish: always runs bcrypt.compare so a wrong email and a wrong password
 * take about the same time.
 */
export async function verifyAdminLogin(
  email: string,
  password: string
): Promise<string | null> {
  const submitted = (email || "").trim().toLowerCase();
  const hash = ENV.adminPasswordHash;

  if (!hash || !ENV.adminEmail) {
    console.error("[Auth] ADMIN_EMAIL / ADMIN_PASSWORD_HASH not configured");
    return null;
  }

  const emailMatches = submitted === ENV.adminEmail;
  const passwordMatches = await bcrypt.compare(password || "", hash);

  if (!emailMatches || !passwordMatches) return null;

  // Ensure the admin row exists and is marked admin.
  await db.upsertUser({
    openId: adminOpenId(),
    name: "Tabitha Rector",
    email: ENV.adminEmail,
    loginMethod: "password",
    role: "admin",
    lastSignedIn: new Date(),
  });

  return adminOpenId();
}
