
Db updated · TS
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  eventSettings,
  InsertUser,
  Registration,
  registrations,
  resourceDownloads,
  sequenceSends,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';
let _db: ReturnType<typeof drizzle> | null = null;
// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Render Postgres requires SSL. postgres-js: ssl "require" is correct for
      // Render's managed instances. Single low-max pool is plenty for one admin
      // dashboard plus an hourly cron.
      const client = postgres(process.env.DATABASE_URL, {
        ssl: "require",
        max: 5,
      });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
/* ------------------------------------------------------------------ *
 * Webinar registrations
 * ------------------------------------------------------------------ */
export type NewRegistration = {
  firstName: string;
  lastName: string;
  email: string;
  track?: string | null;
  resource?: string | null;
};
/**
 * Insert a registration. Email is unique, so a repeat submission from the same
 * address updates the existing row rather than creating a duplicate — a visitor
 * who registers twice should not appear twice in the owner's list.
 */
export async function createRegistration(input: NewRegistration) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const email = input.email.trim().toLowerCase();
  await db
    .insert(registrations)
    .values({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email,
      track: input.track ?? null,
      resource: input.resource ?? null,
    })
    .onConflictDoUpdate({
      target: registrations.email,
      set: {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        track: input.track ?? null,
        resource: input.resource ?? null,
      },
    });
  const rows = await db
    .select()
    .from(registrations)
    .where(eq(registrations.email, email))
    .limit(1);
  return rows[0];
}
/** All registrations, newest first. Ordering in the UI is handled client-side. */
export async function listRegistrations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(registrations).orderBy(desc(registrations.createdAt));
}
/** One registration by email, or undefined if none exists. Used by the double
 * opt-in confirm handler to look up who is confirming without a separate list. */
export async function getRegistrationByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const key = email.trim().toLowerCase();
  const rows = await db.select().from(registrations).where(eq(registrations.email, key)).limit(1);
  return rows[0];
}
/**
 * Marks an address as having clicked the double opt-in confirmation link.
 * Idempotent: clicking the link twice is harmless. `alreadyConfirmed` tells the
 * caller whether this click is the first (so it should fire the delivery +
 * owner-notification emails) or a repeat (so it should not send them again).
 */
export async function confirmRegistration(
  email: string,
): Promise<{ row: Registration | undefined; alreadyConfirmed: boolean }> {
  const db = await getDb();
  if (!db) return { row: undefined, alreadyConfirmed: false };
  const key = email.trim().toLowerCase();
  const existing = await db
    .select()
    .from(registrations)
    .where(eq(registrations.email, key))
    .limit(1);
  const row = existing[0];
  if (!row) return { row: undefined, alreadyConfirmed: false };
  if (row.confirmedAt) return { row, alreadyConfirmed: true };
  const confirmedAt = new Date();
  await db.update(registrations).set({ confirmedAt }).where(eq(registrations.email, key));
  return { row: { ...row, confirmedAt }, alreadyConfirmed: false };
}
/**
 * Records the outcome of the resource-delivery email so a failure is visible in
 * the dashboard rather than silent. Never throws: bookkeeping must not take down
 * a signup that already succeeded.
 */
export async function setRegistrationEmailStatus(
  email: string,
  status: "sent" | "failed" | "skipped",
  detail: string,
) {
  try {
    const db = await getDb();
    if (!db) return;
    await db
      .update(registrations)
      .set({ emailStatus: status, emailDetail: detail.slice(0, 500) })
      .where(eq(registrations.email, email.trim().toLowerCase()));
  } catch (error) {
    console.error("[Email] Could not record send status:", error);
  }
}
export async function countRegistrations() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(registrations);
  return rows.length;
}
/**
 * Marks an address as opted out. Idempotent: clicking the link twice is harmless,
 * and the first opt-out time is preserved rather than overwritten.
 *
 * Returns the row when found, so the page can greet the person by name.
 */
export async function unsubscribeByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const key = email.trim().toLowerCase();
  const existing = await db
    .select()
    .from(registrations)
    .where(eq(registrations.email, key))
    .limit(1);
  const row = existing[0];
  if (!row) return undefined;
  if (!row.unsubscribedAt) {
    await db
      .update(registrations)
      .set({ unsubscribedAt: new Date() })
      .where(eq(registrations.email, key));
  }
  return row;
}
/** True when this address has opted out and must not be emailed again. */
export async function isUnsubscribed(email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ unsubscribedAt: registrations.unsubscribedAt })
    .from(registrations)
    .where(eq(registrations.email, email.trim().toLowerCase()))
    .limit(1);
  return Boolean(rows[0]?.unsubscribedAt);
}
/* ------------------------------------------------------------------ *
 * Event settings (owner-editable placeholders)
 * ------------------------------------------------------------------ */
export async function getAllEventSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(eventSettings);
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (row.settingValue !== null) out[row.settingKey] = row.settingValue;
  }
  return out;
}
export async function setEventSetting(settingKey: string, settingValue: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(eventSettings)
    .values({ settingKey, settingValue })
    .onConflictDoUpdate({ target: eventSettings.settingKey, set: { settingValue } });
}
/* ------------------------------------------------------------------ *
 * Resource downloads
 * ------------------------------------------------------------------ */
/**
 * Records one resource open. Never throws: a tracking failure must never stop a
 * person from receiving the file they were promised.
 *
 * Rapid repeats are collapsed. Mail clients and link scanners routinely fetch a
 * URL more than once, and counting those would inflate the number that Tabitha
 * is meant to trust.
 */
export async function recordDownload(input: {
  email: string;
  resource: string;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const email = input.email.trim().toLowerCase();
    const recent = await db
      .select({ createdAt: resourceDownloads.createdAt })
      .from(resourceDownloads)
      .where(
        and(eq(resourceDownloads.email, email), eq(resourceDownloads.resource, input.resource)),
      )
      .orderBy(desc(resourceDownloads.createdAt))
      .limit(1);
    const last = recent[0]?.createdAt;
    if (last && Date.now() - new Date(last).getTime() < DOWNLOAD_DEDUPE_WINDOW_MS) return;
    await db.insert(resourceDownloads).values({
      email,
      resource: input.resource,
      userAgent: input.userAgent ? input.userAgent.slice(0, 255) : null,
    });
  } catch (error) {
    console.error("[Downloads] Could not record open:", error);
  }
}
/** Two opens of the same file inside this window count once. */
export const DOWNLOAD_DEDUPE_WINDOW_MS = 30 * 60 * 1000;
/** All download events, newest first. Aggregated per person in the router. */
export async function listDownloads() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(resourceDownloads).orderBy(desc(resourceDownloads.createdAt));
}
/* ------------------------------------------------------------------ *
 * Follow-up sequence
 * ------------------------------------------------------------------ */
/**
 * Everyone still eligible for the sequence: signed up, confirmed their email via
 * the double opt-in link, and never opted out. An unconfirmed address has never
 * verified it belongs to a real, reachable inbox, so the sequence must not send
 * to it. Step filtering happens in the dispatcher, which knows the schedule.
 */
export async function listSequenceCandidates() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(registrations)
    .where(and(isNull(registrations.unsubscribedAt), isNotNull(registrations.confirmedAt)))
    .orderBy(registrations.createdAt);
}
/** Every send already recorded, so the dispatcher never repeats one. */
export async function listSequenceSends() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sequenceSends);
}
/**
 * Claims a step for one person before sending.
 *
 * The unique index on (email, step) is what makes this safe: two overlapping
 * dispatch runs both try to insert, one loses, and the loser skips. Reserving
 * the slot first means a crash mid-send can never produce a duplicate letter —
 * the failure mode is a missing email, which is recoverable and visible, rather
 * than a second copy in someone's inbox, which is not.
 *
 * Returns false when the row already existed, i.e. someone else has it.
 */
export async function claimSequenceStep(email: string, step: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db
      .insert(sequenceSends)
      .values({ email: email.trim().toLowerCase(), step, status: "sending" });
    return true;
  } catch {
    // Duplicate key: another run already claimed this step.
    return false;
  }
}
/** Records the outcome against a previously claimed step. */
export async function finishSequenceStep(
  email: string,
  step: number,
  status: "sent" | "failed",
  detail: string,
) {
  try {
    const db = await getDb();
    if (!db) return;
    await db
      .update(sequenceSends)
      .set({ status, detail: detail.slice(0, 500) })
      .where(
        and(
          eq(sequenceSends.email, email.trim().toLowerCase()),
          eq(sequenceSends.step, step),
        ),
      );
  } catch (error) {
    console.error("[Sequence] Could not record send outcome:", error);
  }
}
/**
 * Releases a claimed step so a later run can retry it. Used when the send fails
 * for a reason that may be transient, e.g. the provider was briefly unreachable.
 */
export async function releaseSequenceStep(email: string, step: number) {
  try {
    const db = await getDb();
    if (!db) return;
    await db
      .delete(sequenceSends)
      .where(
        and(
          eq(sequenceSends.email, email.trim().toLowerCase()),
          eq(sequenceSends.step, step),
        ),
      );
  } catch (error) {
    console.error("[Sequence] Could not release step:", error);
  }
}
 
