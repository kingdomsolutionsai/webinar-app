import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  EVENT_DEFAULTS,
  EVENT_SETTING_KEYS,
  PUBLIC_SETTING_KEYS,
  isPlaceholder,
  LION_MARK_URL,
  MAIL_OWNER,
  PUBLIC_URL_KEY,
  resolveEmailBaseUrl,
} from "../shared/event";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { confirmUrl, verifyConfirm } from "./confirm";
import { sendAttendanceRewardEmail, sendConfirmEmail, sendEmail, sendSignupEmails } from "./email";
import {
  claimSequenceStep,
  confirmRegistration,
  createRegistration,
  finishSequenceStep,
  getAllEventSettings,
  isUnsubscribed,
  listDownloads,
  listRegistrations,
  listSequenceSends,
  markAttended,
  releaseSequenceStep,
  setRegistrationEmailStatus,
  setEventSetting,
  unmarkAttended,
  unsubscribeByEmail,
} from "./db";
import { trackedDownloadUrl } from "./downloads";
import { toPipelineCsv } from "./pipelineExport";
import {
  buildSequenceEmail,
  FINAL_STEP,
  POST_SESSION_SCHEDULE,
  REPLAY_STEP,
  runSequenceDispatch,
  SEQUENCE_PAUSED_KEY,
  SEQUENCE_SCHEDULE,
} from "./sequence";
import { unsubscribeUrl, verifyUnsubscribe } from "./unsubscribe";
import { brevoStatus, sendBrevoTests, setupBrevo, syncInBackground } from "./brevo";
/** Only the project owner may read registrations or edit event details. */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Owner access required." });
  }
  return next({ ctx });
});
const nameField = z
  .string()
  .trim()
  .min(1, "Required")
  .max(120, "Please use 120 characters or fewer");
const registrationInput = z.object({
  firstName: nameField,
  lastName: nameField,
  email: z
    .string()
    .trim()
    .min(1, "Required")
    .max(320, "Please use 320 characters or fewer")
    .email("Please enter a valid email address"),
  track: z.enum(["pre_revenue", "serving_clients", "reorganizing"]).nullish(),
  /** Which free resource the visitor asked for. */
  resource: z.enum(["chapter", "checklist", "both"]).nullish(),
});
function toCsv(
  rows: {
    firstName: string;
    lastName: string;
    email: string;
    track: string | null;
    resource: string | null;
    emailStatus?: string | null;
    opened?: string[];
    createdAt: Date;
  }[],
) {
  const escape = (value: string) => {
    // Guard against CSV formula injection as well as delimiter breakage.
    const cleaned = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${cleaned.replace(/"/g, '""')}"`;
  };
  const header = [
    "First name",
    "Last name",
    "Email",
    "Track",
    "Resource",
    "Email delivery",
    "Opened",
    "Registered",
  ];
  const body = rows.map(row =>
    [
      escape(row.firstName),
      escape(row.lastName),
      escape(row.email),
      escape(row.track ?? ""),
      escape(row.resource ?? ""),
      escape(row.emailStatus ?? "not attempted"),
      escape(row.opened && row.opened.length ? row.opened.join(" + ") : "not opened"),
      escape(new Date(row.createdAt).toISOString()),
    ].join(","),
  );
  return [header.map(escape).join(","), ...body].join("\r\n");
}
/**
 * Public base URL for this request, used to build absolute links in email.
 * Behind the managed runtime the original scheme arrives via x-forwarded-proto.
 */
function resolveBaseUrl(req: { protocol?: string; headers: Record<string, unknown> }) {
  const forwarded = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  const proto = forwarded || req.protocol || "https";
  const host = String(req.headers.host ?? "").trim();
  return host ? `${proto}://${host}` : "";
}
/** Counted links for both resources, used in every outbound email. */
function trackedUrlsFor(baseUrl: string, email: string) {
  return {
    chapter: trackedDownloadUrl(baseUrl, "chapter", email),
    checklist: trackedDownloadUrl(baseUrl, "checklist", email),
  };
}
export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  registration: router({
    /**
     * Public signup. Stores the row with a submission timestamp, then sends
     * only the double opt-in confirmation link — never the checklist itself.
     * The checklist, the exercise-prompt email, and the owner notification all
     * wait for `registration.confirm`, so an address that is never clicked is
     * never treated as a verified lead.
     */
    create: publicProcedure.input(registrationInput).mutation(async ({ input, ctx }) => {
      const row = await createRegistration({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        track: input.track ?? null,
        resource: input.resource ?? null,
      });
      // Copy to Brevo so the reminders reach them. Background: never slows signup.
      syncInBackground(input.email);
      // Wrapped so that no mail failure can turn a successful signup into an
      // error for someone who has already typed their details — they still see
      // the "check your email" confirmation panel either way.
      let emailed = false;
      // Resolved once and reused, so the confirmation panel and the email agree
      // on the same address. Behind the managed runtime the request host is an
      // internal hostname, which is why the saved public address wins.
      const storedForLinks = await getAllEventSettings();
      const linkBaseUrl = resolveEmailBaseUrl(
        storedForLinks[PUBLIC_URL_KEY],
        resolveBaseUrl(ctx.req),
      );
      try {
        const baseUrl = linkBaseUrl;
        // Never mail someone who has opted out, even if they submit again.
        if (await isUnsubscribed(input.email)) {
          await setRegistrationEmailStatus(input.email, "skipped", "Recipient has unsubscribed");
        } else {
          const result = await sendConfirmEmail({
            firstName: row?.firstName ?? input.firstName,
            lastName: row?.lastName ?? input.lastName,
            email: input.email,
            confirmUrl: confirmUrl(baseUrl, input.email),
            logoUrl: baseUrl ? `${baseUrl}${LION_MARK_URL}` : undefined,
          });
          emailed = result.ok;
          await setRegistrationEmailStatus(
            input.email,
            result.ok ? "sent" : "failed",
            result.ok ? result.messageId : result.error,
          );
          if (!result.ok) console.error("[Email] Confirmation send failed:", result.error);
        }
      } catch (error) {
        console.error("[Email] Unexpected send error:", error);
        await setRegistrationEmailStatus(
          input.email,
          "failed",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
      return {
        success: true as const,
        firstName: row?.firstName ?? input.firstName,
        emailed,
      };
    }),
    /**
     * Public double opt-in confirmation, reached from the link in the
     * confirmation email. No login: the signed token proves the click came from
     * an email we actually sent, so one address can never confirm another.
     *
     * The checklist and the owner notification are sent from here, the first
     * time only — `confirmRegistration` reports whether this address was
     * already confirmed, so a second click (or a slow double-click) can never
     * produce a duplicate delivery.
     */
    confirm: publicProcedure
      .input(z.object({ email: z.string().email(), token: z.string().min(8) }))
      .mutation(async ({ input, ctx }) => {
        if (!verifyConfirm(input.email, input.token)) {
          return { ok: false as const, reason: "invalid" as const };
        }
        const { row, alreadyConfirmed } = await confirmRegistration(input.email);
        if (!row) {
          return { ok: false as const, reason: "not_found" as const };
        }
        const stored = await getAllEventSettings();
        const baseUrl = resolveEmailBaseUrl(stored[PUBLIC_URL_KEY], resolveBaseUrl(ctx.req));
        if (!alreadyConfirmed) {
          // Joining the Nurture list in Brevo is what starts the day 2/7/14 letters.
          syncInBackground(row.email);
          try {
            if (await isUnsubscribed(row.email)) {
              await setRegistrationEmailStatus(row.email, "skipped", "Recipient has unsubscribed");
            } else {
              const result = await sendSignupEmails({
                firstName: row.firstName,
                lastName: row.lastName,
                email: row.email,
                track: row.track,
                resource: (row.resource ?? null) as never,
                baseUrl,
                logoUrl: baseUrl ? `${baseUrl}${LION_MARK_URL}` : undefined,
                unsubscribeUrl: unsubscribeUrl(baseUrl, row.email),
                trackedUrls: trackedUrlsFor(baseUrl, row.email),
              });
              await setRegistrationEmailStatus(
                row.email,
                result.ok ? "sent" : "failed",
                result.ok ? result.messageId : result.error,
              );
              if (!result.ok) console.error("[Email] Delivery failed:", result.error);
            }
          } catch (error) {
            console.error("[Email] Unexpected send error:", error);
            await setRegistrationEmailStatus(
              row.email,
              "failed",
              error instanceof Error ? error.message : "Unknown error",
            );
          }
        }
        return {
          ok: true as const,
          firstName: row.firstName,
          track: row.track,
          alreadyConfirmed,
          // Counted link, so an open from the confirm page is recorded the same
          // way as an open from the delivery email.
          downloads: trackedUrlsFor(baseUrl, row.email),
        };
      }),
    list: adminProcedure.query(() => listRegistrations()),
    /**
     * Public opt-out. No login, because the link is clicked from a mail client.
     * The signed token proves the request came from an email we sent, so one
     * person cannot unsubscribe another.
     */
    unsubscribe: publicProcedure
      .input(z.object({ email: z.string().email(), token: z.string().min(8) }))
      .mutation(async ({ input }) => {
        if (!verifyUnsubscribe(input.email, input.token)) {
          return { ok: false as const, reason: "invalid" as const };
        }
        const row = await unsubscribeByEmail(input.email);
        syncInBackground(input.email);
        return {
          ok: true as const,
          firstName: row?.firstName ?? null,
          alreadyDone: Boolean(row?.unsubscribedAt),
        };
      }),
    /** Owner-only resend, for a delivery that failed or an address that asked again. */
    resend: adminProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input, ctx }) => {
        const rows = await listRegistrations();
        const row = rows.find(r => r.email === input.email.trim().toLowerCase());
        if (!row) return { ok: false as const, error: "No such registration" };
        if (row.unsubscribedAt) {
          return { ok: false as const, error: "This person has unsubscribed" };
        }
        if (!row.confirmedAt) {
          return { ok: false as const, error: "This person has not confirmed their email yet" };
        }
        const stored = await getAllEventSettings();
        const baseUrl = resolveEmailBaseUrl(stored[PUBLIC_URL_KEY], resolveBaseUrl(ctx.req));
        const result = await sendSignupEmails({
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          track: row.track,
          resource: (row.resource ?? null) as never,
          baseUrl,
          logoUrl: `${baseUrl}${LION_MARK_URL}`,
          unsubscribeUrl: unsubscribeUrl(baseUrl, row.email),
          trackedUrls: trackedUrlsFor(baseUrl, row.email),
        });
        await setRegistrationEmailStatus(
          row.email,
          result.ok ? "sent" : "failed",
          result.ok ? result.messageId : result.error,
        );
        return result.ok
          ? { ok: true as const }
          : { ok: false as const, error: result.error };
      }),
    /**
     * Owner-only. The single action that gates the First-Sale Readiness
     * Checklist: marking someone attended sends the checklist reward email
     * the first time only (idempotent, same pattern as `confirm`). Never
     * triggered automatically — this is the only path that can send it.
     */
    markAttended: adminProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input, ctx }) => {
        const { row, alreadyAttended } = await markAttended(input.email);
        if (!row) return { ok: false as const, error: "No such registration" };
        syncInBackground(row.email);
        if (!alreadyAttended) {
          const stored = await getAllEventSettings();
          const baseUrl = resolveEmailBaseUrl(stored[PUBLIC_URL_KEY], resolveBaseUrl(ctx.req));
          try {
            if (!(await isUnsubscribed(row.email))) {
              await sendAttendanceRewardEmail({
                firstName: row.firstName,
                lastName: row.lastName,
                email: row.email,
                baseUrl,
                logoUrl: baseUrl ? `${baseUrl}${LION_MARK_URL}` : undefined,
                unsubscribeUrl: unsubscribeUrl(baseUrl, row.email),
                trackedUrls: { checklist: trackedDownloadUrl(baseUrl, "checklist", row.email) },
              });
            }
          } catch (error) {
            console.error("[Email] Attendance reward send failed:", error);
          }
        }
        return { ok: true as const, alreadyAttended };
      }),
    /** Owner-only. Corrects a mis-click — does not recall an email already sent. */
    unmarkAttended: adminProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const row = await unmarkAttended(input.email);
        if (row) syncInBackground(row.email);
        return row ? { ok: true as const } : { ok: false as const, error: "No such registration" };
      }),
    exportCsv: adminProcedure.query(async () => {
      const rows = await listRegistrations();
      const downloads = await listDownloads();
      const opened = new Map<string, string[]>();
      for (const d of downloads) {
        const key = d.email.toLowerCase();
        const list = opened.get(key) ?? [];
        if (!list.includes(d.resource)) list.push(d.resource);
        opened.set(key, list);
      }
      return {
        filename: `ksai-webinar-registrations-${new Date().toISOString().slice(0, 10)}.csv`,
        csv: toCsv(
          rows.map(row => ({
            ...row,
            opened: opened.get(row.email.toLowerCase()) ?? [],
          })),
        ),
        count: rows.length,
      };
    }),
    /**
     * Per-person download activity for the dashboard: which resources each
     * address opened, and when it was last opened.
     */
    downloads: adminProcedure.query(async () => {
      const rows = await listDownloads();
      const byEmail = new Map<
        string,
        { resources: string[]; count: number; lastAt: Date }
      >();
      for (const row of rows) {
        const key = row.email.toLowerCase();
        const entry = byEmail.get(key);
        if (!entry) {
          byEmail.set(key, {
            resources: [row.resource],
            count: 1,
            lastAt: row.createdAt,
          });
          continue;
        }
        entry.count += 1;
        if (!entry.resources.includes(row.resource)) entry.resources.push(row.resource);
        if (new Date(row.createdAt) > new Date(entry.lastAt)) entry.lastAt = row.createdAt;
      }
      return Array.from(byEmail.entries()).map(([email, v]) => ({ email, ...v }));
    }),
    /**
     * Export in the column shape of the Lead Qualifier pipeline, so a webinar
     * audience can be imported without retyping. Kept separate from exportCsv,
     * which stays as the complete record for Tabitha's own files.
     */
    exportPipelineCsv: adminProcedure.query(async () => {
      const rows = await listDownloads();
      const byEmail = new Map<
        string,
        { resources: string[]; count: number; lastAt: Date }
      >();
      for (const row of rows) {
        const key = row.email.toLowerCase();
        const entry = byEmail.get(key);
        if (!entry) {
          byEmail.set(key, {
            resources: [row.resource],
            count: 1,
            lastAt: row.createdAt,
          });
          continue;
        }
        entry.count += 1;
        if (!entry.resources.includes(row.resource)) entry.resources.push(row.resource);
        if (new Date(row.createdAt) > new Date(entry.lastAt)) entry.lastAt = row.createdAt;
      }
      const registrations = await listRegistrations();
      return {
        filename: `ksai-pipeline-import-${new Date().toISOString().slice(0, 10)}.csv`,
        csv: toPipelineCsv(
          registrations.map(row => ({
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            track: row.track,
            resource: row.resource ?? null,
            createdAt: row.createdAt,
            opened: byEmail.get(row.email.toLowerCase())?.resources ?? [],
            unsubscribedAt: row.unsubscribedAt ?? null,
          })),
        ),
        count: registrations.length,
      };
    }),
  }),
  /** The post-signup follow-up sequence. */
  sequence: router({
    /** Status overview: schedule, whether it is paused, and what has been sent. */
    status: adminProcedure.query(async () => {
      const [sends, settings] = await Promise.all([
        listSequenceSends(),
        getAllEventSettings(),
      ]);
      const byStep = SEQUENCE_SCHEDULE.map(({ step, day }) => ({
        step,
        day,
        sent: sends.filter(s => s.step === step && s.status === "sent").length,
      }));
      return {
        paused: settings[SEQUENCE_PAUSED_KEY] === "true",
        steps: byStep,
        /**
         * The morning-after letter is reported separately because it is anchored
         * to the session rather than to each person's signup date, so a "day
         * number" would be meaningless for it.
         */
        replay: {
          step: REPLAY_STEP,
          sent: sends.filter(s => s.step === REPLAY_STEP && s.status === "sent").length,
          hasReplayUrl: Boolean((settings.replayUrl ?? "").trim()),
          armed: !isPlaceholder(settings.date),
        },
        /**
         * The post-session arc, also event-anchored. Reported with days-after so
         * the dashboard can explain the timing without duplicating the schedule.
         */
        postSession: POST_SESSION_SCHEDULE.map(({ step, hoursAfter }) => ({
          step,
          days: Math.round(hoursAfter / 24),
          sent: sends.filter(s => s.step === step && s.status === "sent").length,
          isFinal: step === FINAL_STEP,
        })),
        total: sends.filter(s => s.status === "sent").length,
      };
    }),
    /** Pause or resume. Paused means the dispatcher returns without sending. */
    setPaused: adminProcedure
      .input(z.object({ paused: z.boolean() }))
      .mutation(async ({ input }) => {
        await setEventSetting(SEQUENCE_PAUSED_KEY, input.paused ? "true" : "false");
        return { success: true as const, paused: input.paused };
      }),
    /**
     * Owner-triggered run of whatever is currently due. The scheduler calls the
     * same code path, so this is a way to see the sequence work rather than a
     * separate mechanism that might behave differently.
     */
    runNow: adminProcedure.mutation(async () => {
      // The sequence is sent by Brevo now. Sending here as well would email
      // people twice, so this deliberately does nothing.
      return { considered: 0, sent: 0, failed: 0, skipped: 0, paused: true, handedToBrevo: true };
    }),
    /**
     * Sends one letter to Tabitha herself so she can read it before it reaches
     * anyone else. Deliberately bypasses the ledger: a preview must never consume
     * a real recipient's step.
     */
    preview: adminProcedure
      .input(
        z.object({
          step: z.union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
            z.literal(5),
            z.literal(6),
          ]),
          /** Only affects letter six's wording — lets Tabitha preview both variants. */
          attended: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const settings = await getAllEventSettings();
        const baseUrl = resolveEmailBaseUrl(settings[PUBLIC_URL_KEY], resolveBaseUrl(ctx.req));
        const to = MAIL_OWNER;
        const letter = buildSequenceEmail(input.step, {
          firstName: "Tabitha",
          email: to,
          baseUrl,
          logoUrl: baseUrl ? `${baseUrl}${LION_MARK_URL}` : undefined,
          unsubscribeUrl: unsubscribeUrl(baseUrl, to),
          eventDate: settings.date,
          eventTime: settings.time,
          replayUrl: settings.replayUrl,
          attended: input.attended ?? false,
        });
        const result = await sendEmail({
          to: { email: to, name: "Tabitha Rector" },
          subject: `[Preview] ${letter.subject}`,
          html: letter.html,
          text: letter.text,
          tags: ["sequence-preview"],
        });
        return result.ok
          ? { ok: true as const }
          : { ok: false as const, error: result.error };
      }),
  }),
  /** Brevo now sends the reminders and the follow-up letters. */
  brevo: router({
    status: adminProcedure.query(() => brevoStatus()),
    setup: adminProcedure.mutation(({ ctx }) => setupBrevo({ requestOrigin: resolveBaseUrl(ctx.req) })),
    sendTests: adminProcedure.mutation(({ ctx }) =>
      sendBrevoTests({ requestOrigin: resolveBaseUrl(ctx.req) }),
    ),
  }),
  settings: router({
    /** Public read so the landing page can show current event details. */
    get: publicProcedure.query(async () => {
      const stored = await getAllEventSettings();
      const merged: Record<string, string> = { ...EVENT_DEFAULTS, ...stored };
      // Only what the public page displays. The Zoom link and passcode stay private.
      return Object.fromEntries(PUBLIC_SETTING_KEYS.map(key => [key, merged[key] ?? ""])) as Record<
        (typeof PUBLIC_SETTING_KEYS)[number],
        string
      >;
    }),
    /** Everything the owner can edit, for the dashboard. */
    getAll: adminProcedure.query(async () => {
      const stored = await getAllEventSettings();
      const merged: Record<string, string> = { ...EVENT_DEFAULTS, ...stored };
      return Object.fromEntries(EVENT_SETTING_KEYS.map(key => [key, merged[key] ?? ""])) as Record<
        (typeof EVENT_SETTING_KEYS)[number],
        string
      >;
    }),
    update: adminProcedure
      .input(
        z.object({
          values: z.record(z.enum(EVENT_SETTING_KEYS), z.string().max(300)),
        }),
      )
      .mutation(async ({ input }) => {
        for (const [key, value] of Object.entries(input.values)) {
          await setEventSetting(key, value);
        }
        return { success: true as const };
      }),
  }),
});
export type AppRouter = typeof appRouter;
 


