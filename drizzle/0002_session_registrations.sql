CREATE TABLE IF NOT EXISTS "sessionRegistrations" (
  "id" serial PRIMARY KEY NOT NULL,
  "sessionKey" varchar(10) NOT NULL,
  "email" varchar(320) NOT NULL,
  "firstName" varchar(120) NOT NULL,
  "lastName" varchar(120) NOT NULL,
  "track" varchar(40),
  "confirmedAt" timestamp,
  "attendedAt" timestamp,
  "unsubscribedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessionRegistrations_event_email_idx" ON "sessionRegistrations" USING btree ("sessionKey","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessionRegistrations_event_idx" ON "sessionRegistrations" USING btree ("sessionKey");