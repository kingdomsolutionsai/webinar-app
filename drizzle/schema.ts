import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Postgres schema (converted from the original Manus MySQL schema).
 * Column names are preserved exactly so the dashboard and all queries are unchanged.
 * `updatedAt` uses drizzle's `$onUpdate` to stamp on every write, replacing MySQL's
 * `ON UPDATE CURRENT_TIMESTAMP`.
 */

export const roleEnum = pgEnum("role", ["user", "admin"]);

/** Core user table backing auth flow (now a simple single-admin login). */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  /** Stable identifier for the account. For the single admin this is their email. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Webinar registrations. One row per signup; `email` unique so repeats update.
 *
 * `confirmedAt` is set once the double opt-in link is clicked — the router and
 * the drip sequence both gate on it, so it must exist here for either to work.
 * `attendedAt` is set manually from the dashboard after the live session, and
 * is what the First-Sale Readiness Checklist delivery is gated on: nobody
 * receives it until Tabitha marks them as having actually shown up.
 */
export const registrations = pgTable("registrations", {
  id: serial("id").primaryKey(),
  firstName: varchar("firstName", { length: 120 }).notNull(),
  lastName: varchar("lastName", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  track: varchar("track", { length: 40 }),
  resource: varchar("resource", { length: 40 }),
  emailStatus: varchar("emailStatus", { length: 20 }),
  emailDetail: text("emailDetail"),
  confirmedAt: timestamp("confirmedAt"),
  attendedAt: timestamp("attendedAt"),
  unsubscribedAt: timestamp("unsubscribedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Registration = typeof registrations.$inferSelect;
export type InsertRegistration = typeof registrations.$inferInsert;

/** Single-row key/value store for owner-editable event details. */
export const eventSettings = pgTable("eventSettings", {
  id: serial("id").primaryKey(),
  settingKey: varchar("settingKey", { length: 64 }).notNull().unique(),
  settingValue: text("settingValue"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type EventSetting = typeof eventSettings.$inferSelect;

/** One row per resource open (chapter/checklist), keyed by email. */
export const resourceDownloads = pgTable(
  "resourceDownloads",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    resource: varchar("resource", { length: 40 }).notNull(),
    userAgent: varchar("userAgent", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("resourceDownloads_email_idx").on(table.email)],
);

export type ResourceDownload = typeof resourceDownloads.$inferSelect;

/** Follow-up sequence ledger. Unique (email, step) makes double-sends impossible. */
export const sequenceSends = pgTable(
  "sequenceSends",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    step: integer("step").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    detail: text("detail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [unique("sequenceSends_email_step_idx").on(table.email, table.step)],
);

export type SequenceSend = typeof sequenceSends.$inferSelect;
