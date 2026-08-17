CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "eventSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"settingKey" varchar(64) NOT NULL,
	"settingValue" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "eventSettings_settingKey_unique" UNIQUE("settingKey")
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"firstName" varchar(120) NOT NULL,
	"lastName" varchar(120) NOT NULL,
	"email" varchar(320) NOT NULL,
	"track" varchar(40),
	"resource" varchar(40),
	"emailStatus" varchar(20),
	"emailDetail" text,
	"unsubscribedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "resourceDownloads" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"resource" varchar(40) NOT NULL,
	"userAgent" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequenceSends" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"step" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"detail" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sequenceSends_email_step_idx" UNIQUE("email","step")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE INDEX "resourceDownloads_email_idx" ON "resourceDownloads" USING btree ("email");