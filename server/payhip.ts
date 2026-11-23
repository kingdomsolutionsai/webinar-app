import { createHash, timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import postgres from "postgres";
import { sendEmail } from "./email";

const PRODUCT = "Nrvy5";
const START = Date.parse("2026-12-08T18:00:00Z");
const MIN = 60_000;
const API = "https://api.brevo.com/v3";
let client: ReturnType<typeof postgres> | undefined;
let initialized: Promise<unknown> | undefined;
let busy = false;

function configuration() {
  const apiKey = process.env.PAYHIP_API_KEY?.trim();
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  const customers = Number(process.env.PAYHIP_CUSTOMERS_LIST_ID);
  const marketing = Number(process.env.PAYHIP_MARKETING_LIST_ID);
  const zoom = process.env.Q1_WORKSHOP_ZOOM_URL?.trim();
  if (!apiKey || !brevoKey || !process.env.DATABASE_URL ||
      !Number.isSafeInteger(customers) || customers < 1 ||
      !Number.isSafeInteger(marketing) || marketing < 1 ||
      customers === marketing || !zoom) return null;
  try {
    const u = new URL(zoom);
    if (u.protocol !== "https:" || !(u.hostname === "zoom.us" || u.hostname.endsWith(".zoom.us"))) return null;
  } catch { return null; }
  return { apiKey, brevoKey, customers, marketing, zoom };
}

async function database() {
  if (!client) client = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 2 });
  const sql = client;
  if (!initialized) initialized = (async () => {
    await sql`create table if not exists payhip_orders (
      id text primary key, email text not null, workshop boolean not null,
      consent boolean not null, refunded boolean not null default false,
      synced boolean not null default false, created_at timestamptz not null default now()
    )`;
    await sql`create table if not exists payhip_q1_mail (
      email text not null, step text not null, state text not null,
      updated_at timestamptz not null default now(), primary key (email, step)
    )`;
  })().catch(error => { initialized = undefined; throw error; });
  await initialized;
  return sql;
}

export function validSignature(signature: unknown, apiKey: string) {
  if (typeof signature !== "string" || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature, "hex"), createHash("sha256").update(apiKey).digest());
}

export function parsePayhipEvent(body: any) {
  if (!body || !["paid", "refunded"].includes(body.type)) return null;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof body.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.id) ||
      !Array.isArray(body.items) || !body.items.length) return null;
  if (body.is_gift === true) return { ignored: true } as const;
  const workshop = body.items.some((item: any) => item?.product_key === PRODUCT);
  const consent = body.unconsented_from_emails === false;
  const refunded = body.type === "refunded";
  if (refunded && (typeof body.amount_refunded !== "number" || typeof body.price !== "number")) return null;
  if (refunded && body.amount_refunded < body.price) return { ignored: true } as const;
  return { ignored: false, id: body.id as string, email, workshop, consent, refunded } as const;
}

export function dueSteps(now: number, registered: number) {
  if (now >= START) return [];
  const result = ["confirmation"];
  // Do not send reminders whose scheduled window passed before registration.
  for (const [name, minutes, endMinutes] of [
    ["day", 1440, 60], ["hour", 60, 15], ["fifteen", 15, 0],
  ] as const) {
    const at = START - minutes * MIN;
    if (registered <= at && now >= at && now < START - endMinutes * MIN) result.push(name);
  }
  return result;
}

async function syncContact(email: string, consent: boolean, config: NonNullable<ReturnType<typeof configuration>>) {
  // Operational list is not a marketing audience. Never clear any existing
  // email or SMS blacklist; absence of checkout consent never grants consent.
  const headers = { "api-key": config.brevoKey, "Content-Type": "application/json", Accept: "application/json" };
  const response = await fetch(API + "/contacts", {
    method: "POST", headers,
    body: JSON.stringify({
      email, updateEnabled: true,
      listIds: consent ? [config.customers, config.marketing] : [config.customers],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Brevo contact sync HTTP " + response.status);
}

function buildMessage(step: string, zoom: string) {
  const subjects: Record<string, string> = {
    confirmation: "You're registered! Welcome to Q1 Ready",
    day: "Tomorrow: Q1 Ready workshop",
    hour: "We begin in one hour: Q1 Ready",
    fifteen: "We begin in 15 minutes: Q1 Ready",
  };
  const intro: Record<string, string> = {
    confirmation: "Your seat is reserved! I'm looking forward to working alongside you as we identify the business gap that deserves your attention first.",
    day: "I'm looking forward to working alongside you tomorrow. Bring a notebook and your questions.",
    hour: "Our workshop begins in one hour. Have your notebook and questions ready.",
    fifteen: "We're getting ready to begin. Join a few minutes early so we can start promptly.",
  };
  const text = [intro[step], "", "Q1 Ready: The Business Fast Track Workshop", "Tuesday, December 8, 2026 | 1–2 PM Eastern | Live on Zoom", "", "Join Zoom: " + zoom, "", "Questions? Reply to this email.", "", "Tabitha Rector", "Founder | Kingdom Solutions Business & AI™"].join("\n");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return { subject: subjects[step], text, html: '<div style="max-width:600px;margin:auto;font:17px/1.6 Arial,sans-serif;color:#222"><div style="background:#111;color:#d7b45a;padding:20px">Kingdom Solutions Business &amp; AI™</div><h2>' + esc(subjects[step]) + '</h2><p>' + esc(intro[step]) + '</p><p><strong>Tuesday, December 8, 2026<br>1–2 PM Eastern | Live on Zoom</strong></p><p><a style="display:inline-block;padding:12px 20px;background:#111;color:#e2c46e;text-decoration:none" href="' + esc(zoom) + '">Join the workshop on Zoom</a></p><p>Questions? Reply to this email.</p><p>Tabitha Rector<br>Founder | Kingdom Solutions Business &amp; AI™</p></div>' };
}

export async function runPayhipJobs() {
  const config = configuration();
  if (!config || busy) return;
  busy = true;
  try {
    const sql = await database();
    const orders = await sql`select id,email,consent from payhip_orders where not synced and not refunded order by created_at limit 100`;
    for (const order of orders) {
      try {
        await syncContact(order.email, order.consent, config);
        await sql`update payhip_orders set synced=true where id=${order.id}`;
      } catch { console.error("[Payhip] Brevo contact sync failed; will retry"); }
    }
    if (Date.now() >= START) return;
    const attendees = await sql`select email, min(created_at) as registered from payhip_orders where workshop and not refunded group by email`;
    for (const attendee of attendees) {
      for (const step of dueSteps(Date.now(), new Date(attendee.registered).getTime())) {
        // Atomically claim before sending. Ambiguous network failures are not
        // automatically retried (avoid duplicates); inspect failed rows manually.
        const claimed = await sql`insert into payhip_q1_mail(email,step,state) values (${attendee.email},${step},'sending') on conflict do nothing returning email`;
        if (!claimed.length) continue;
        const active = await sql`select 1 from payhip_orders where email=${attendee.email} and workshop and not refunded limit 1`;
        if (!active.length) {
          await sql`delete from payhip_q1_mail where email=${attendee.email} and step=${step} and state='sending'`;
          continue;
        }
        const message = buildMessage(step, config.zoom);
        const result = await sendEmail({ to: { email: attendee.email }, ...message,
          replyTo: { email: "tabitha@kingdomsolutionsai.com", name: "Tabitha Rector" },
          tags: ["q1-ready-workshop", step] });
        await sql`update payhip_q1_mail set state=${result.ok ? "sent" : "failed"},updated_at=now() where email=${attendee.email} and step=${step}`;
        if (!result.ok) console.error("[Payhip] Workshop email failed; manual review required", step);
      }
    }
  } finally { busy = false; }
}

export function registerPayhipRoutes(app: Express) {
  app.get("/api/payhip/status", (_req, res) => res.status(configuration() ? 200 : 503).json({ configured: Boolean(configuration()) }));
  app.post("/api/payhip/webhook", async (req, res) => {
    const config = configuration();
    if (!config) return res.status(503).json({ error: "not configured" });
    if (!validSignature(req.body?.signature, config.apiKey)) return res.status(403).json({ error: "invalid signature" });
    const event = parsePayhipEvent(req.body);
    if (!event) return res.status(400).json({ error: "invalid event" });
    if (event.ignored) return res.status(200).json({ ok: true });
    try {
      const sql = await database();
      if (event.refunded) {
        // A refund tombstone prevents late/replayed paid events reactivating access.
        await sql`insert into payhip_orders(id,email,workshop,consent,refunded,synced) values
          (${event.id},${event.email},${event.workshop},false,true,true)
          on conflict(id) do update set refunded=true`;
      } else {
        await sql`insert into payhip_orders(id,email,workshop,consent) values
          (${event.id},${event.email},${event.workshop},${event.consent})
          on conflict(id) do nothing`;
      }
      return res.status(200).json({ ok: true });
    } catch { return res.status(503).json({ error: "storage unavailable" }); }
  });
}
