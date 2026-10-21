import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { recordDownload } from "./db";
import { isResourceId, resourceFile, verifyDownload } from "./downloads";
import { syncInBackground } from "./brevo";
import { ENV } from "./_core/env";
import { sendEmail } from "./email";
import { MAIL_OWNER } from "../shared/event";

/**
 * Plain Express routes, for the two things tRPC cannot do: redirect a browser to
 * a file, and receive a POST from the platform scheduler.
 */

/**
 * GET /api/download — counts the open, then redirects to the real file.
 *
 * The redirect matters. Serving the bytes through this process would put a
 * multi-megabyte PDF through the app on every click; a redirect hands the file
 * to storage and keeps this route cheap. A person who has lost their email and
 * clicks an old raw link still gets the file, they simply are not counted.
 */
export async function downloadHandler(req: Request, res: Response) {
  const resource = String(req.query.r ?? "");
  const email = String(req.query.e ?? "");
  const token = String(req.query.t ?? "");

  if (!isResourceId(resource)) {
    return res.status(404).send("Unknown resource");
  }

  const file = resourceFile(resource);

  // Count only when the link is genuinely one of ours. An unverified link still
  // delivers the file — the visitor did nothing wrong — but it is not recorded,
  // so the number in the dashboard stays honest.
  if (email && verifyDownload(email, resource, token)) {
    await recordDownload({
      email,
      resource,
      userAgent: req.headers["user-agent"] ? String(req.headers["user-agent"]) : null,
    });
    // Letter one in Brevo reads this to thank people who have opened Part One.
    if (resource === "chapter") syncInBackground(email);
  }

  return res.redirect(302, file.url);
}

/**
 * POST /api/scheduled/sequence: the Render cron job calls this hourly. Retired.
 *
 * Cron-only: the body is attacker-controllable, so nothing in it is trusted, and
 * the caller must present a cron identity.
 */
export async function sequenceHandler(req: Request, res: Response) {
  try {
    // Cron-only: the Render Cron Job presents the shared secret. The request body
    // is still never trusted. A missing/blank secret env means locked-down (deny).
    const presented =
      (req.headers["x-cron-secret"] as string | undefined) ??
      (typeof req.query.secret === "string" ? req.query.secret : undefined);
    if (!ENV.cronSecret || presented !== ENV.cronSecret) {
      return res.status(403).json({ error: "cron-only" });
    }

    // The follow-up letters and reminders are sent by Brevo now. This endpoint
    // stays so the Render cron job does not report failures, but it sends
    // nothing: sending here as well would email people twice.
    return res.json({ ok: true, handedToBrevo: true, sent: 0 });
  } catch (error) {
    // JSON-encoded so the platform's Investigate view shows something useful
    // rather than an opaque 500.
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown dispatch error",
      stack: error instanceof Error ? error.stack : undefined,
      context: { url: req.originalUrl },
      timestamp: new Date().toISOString(),
    });
  }
}


/* ------------------------------------------------------------------ *
 * Public attendee feedback form
 * Kept separate from registration and the marketing automation pipeline.
 * Each response is delivered directly to the owner by transactional email.
 * ------------------------------------------------------------------ */
const helpfulChoices: Record<string, string> = {
  very: "Very helpful",
  somewhat: "Somewhat helpful",
  unsure: "Still unsure what to do next",
};
const valuableChoices: Record<string, string> = {
  eight_systems: "Understanding the eight business systems",
  priority: "Identifying the first business priority",
  right_order: "Building in the right order",
  ai: "AI support with human authority",
  other: "Something else",
};
const feedbackRate = new Map<string, { count: number; reset: number }>();
function escapeFeedbackHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function feedbackField(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max + 1) : "";
}
export async function feedbackHandler(req: Request, res: Response) {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  // Bots frequently fill invisible fields. Pretend to succeed without
  // creating mail or giving automated requests feedback.
  if (feedbackField(body.website, 200)) return res.json({ ok: true });

  const name = feedbackField(body.name, 120);
  const email = feedbackField(body.email, 320).toLowerCase();
  const helpful = feedbackField(body.helpful, 25);
  const mostValuable = feedbackField(body.mostValuable, 25);
  const confusing = feedbackField(body.confusing, 1500);
  const question = feedbackField(body.question, 1500);
  const nextAction = feedbackField(body.nextAction, 1500);
  if (
    !name || name.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 ||
    !Object.hasOwn(helpfulChoices, helpful) || !Object.hasOwn(valuableChoices, mostValuable) ||
    confusing.length > 1500 || question.length > 1500 || nextAction.length > 1500
  ) {
    return res.status(400).json({ error: "Please complete the required fields." });
  }

  // Lightweight rate limit; more than three people can respond from one
  // shared network, but obvious automated repeats cannot flood the mailbox.
  const now = Date.now();
  const ip = req.ip || "unknown";
  const key = ip + ":" + email;
  const existing = feedbackRate.get(key);
  const active = existing && existing.reset > now ? existing : { count: 0, reset: now + 3_600_000 };
  if (active.count >= 5) return res.status(429).json({ error: "Please try again later." });
  active.count++;
  feedbackRate.set(key, active);
  if (feedbackRate.size > 1500) {
    feedbackRate.forEach((state, entry) => { if (state.reset < now) feedbackRate.delete(entry); });
    if (feedbackRate.size > 1500) feedbackRate.clear();
  }

  const fields: [string, string][] = [
    ["Attendee", name],
    ["Email", email],
    ["How helpful", helpfulChoices[helpful]],
    ["Most valuable", valuableChoices[mostValuable]],
    ["What needs explaining", confusing || "(No response)"],
    ["Q&A question", question || "(No response)"],
    ["Next action", nextAction || "(No response)"],
    ["Submitted at", new Date(now).toISOString()],
  ];
  const html = [
    '<div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;color:#171717">',
    '<h1 style="padding:25px;background:#111;color:#ddbd70;font-size:22px">Webinar attendee feedback</h1>',
    ...fields.map(([label, value]) => '<div style="padding:12px 18px;border-bottom:1px solid #ddd">' +
      '<strong>' + escapeFeedbackHtml(label) + '</strong><br/>' +
      '<span style="white-space:pre-wrap">' + escapeFeedbackHtml(value) + '</span></div>'),
    '</div>',
  ].join("");
  const text = fields.map(([label, value]) => label + ":\n" + value).join("\n\n");
  try {
    const result = await sendEmail({
      to: { email: MAIL_OWNER, name: "Kingdom Solutions AI" },
      subject: "Webinar feedback: " + name,
      html,
      text,
      replyTo: { email, name },
      tags: ["webinar-feedback"],
    });
    if (!result.ok) {
      console.error("[Webinar feedback] Owner email failed:", result.error);
      return res.status(503).json({ error: "Unable to send feedback right now." });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error("[Webinar feedback] Unhandled error:", error);
    return res.status(503).json({ error: "Unable to send feedback right now." });
  }
}

export function registerRoutes(app: Express) {
  app.post("/api/webinar-feedback", feedbackHandler);
  app.get("/api/download", downloadHandler);
  app.post("/api/scheduled/sequence", sequenceHandler);
}
