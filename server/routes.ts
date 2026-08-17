import type { Express, Request, Response } from "express";
import { PUBLIC_URL_KEY, resolveEmailBaseUrl } from "../shared/event";
import { sdk } from "./_core/sdk";
import { getAllEventSettings, recordDownload } from "./db";
import { isResourceId, resourceFile, verifyDownload } from "./downloads";
import { runSequenceDispatch } from "./sequence";
import { ENV } from "./_core/env";

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
  }

  return res.redirect(302, file.url);
}

/**
 * POST /api/scheduled/sequence — the platform scheduler calls this.
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

    const stored = await getAllEventSettings();
    const baseUrl = resolveEmailBaseUrl(stored[PUBLIC_URL_KEY], "");
    const summary = await runSequenceDispatch({ baseUrl, settings: stored });
    return res.json({ ok: true, ...summary });
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

export function registerRoutes(app: Express) {
  app.get("/api/download", downloadHandler);
  app.post("/api/scheduled/sequence", sequenceHandler);
}
