import {
  EXERCISE_PROMPT,
  MAIL_FROM,
  MAIL_OWNER,
  READINESS_CHECKLIST,
  SAMPLE_CHAPTER,
  type ResourceChoice,
} from "../shared/event";

/**
 * Transactional email via Brevo.
 *
 * Two messages go out on each signup: the resources and exercise prompt to the
 * registrant, and a short notification to Tabitha. Neither is allowed to fail the
 * registration itself — a person who has already typed their details should never
 * see an error because a mail provider was slow.
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/* ------------------------------------------------------------------ *
 * Brand tokens. Inline styles only — email clients discard <style>.
 * ------------------------------------------------------------------ */
const C = {
  ink: "#0B0B0B",
  gold: "#C9A227",
  goldLight: "#E3C55A",
  goldTint: "#FBF7EA",
  navy: "#14213D",
  green: "#159447",
  paper: "#FFFFFF",
  body: "#2A2A2A",
  muted: "#6B6B6B",
  rule: "#E5E2D9",
};

const SERIF = "'EB Garamond', Georgia, 'Times New Roman', serif";
const SANS = "'Montserrat', 'Helvetica Neue', Arial, sans-serif";
const DISPLAY = "'Playfair Display', Georgia, serif";

export type EmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/** Absolute URL for a stored asset, needed because email cannot use root-relative paths. */
function absolute(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ *
 * Registrant email
 * ------------------------------------------------------------------ */
export function buildRegistrantEmail(input: {
  firstName: string;
  resource: ResourceChoice | null;
  baseUrl: string;
  logoUrl?: string;
  /** Opt-out URL. Omitted only in tests that do not exercise the footer. */
  unsubscribeUrl?: string;
  /**
   * Counted download links, one per resource. When absent the raw file URLs are
   * used, so a missing tracker can never produce a dead link.
   */
  trackedUrls?: { chapter: string; checklist: string };
}) {
  const { firstName, resource, baseUrl } = input;
  const chapterUrl = input.trackedUrls?.chapter ?? absolute(baseUrl, SAMPLE_CHAPTER.url);
  const checklistUrl = input.trackedUrls?.checklist ?? absolute(baseUrl, READINESS_CHECKLIST.url);
  const checklistFirst = resource === "checklist";

  const primary = checklistFirst
    ? {
        title: READINESS_CHECKLIST.title,
        url: checklistUrl,
        meta: `${READINESS_CHECKLIST.pages} pages \u00b7 ${READINESS_CHECKLIST.fields} fillable fields`,
        blurb:
          "Fourteen conditions to meet before you take money from a client, plus an eight-system scoring diagnostic. Type your answers straight into it and save the file \u2014 nothing to print.",
        cta: "Download the checklist",
      }
    : {
        title: SAMPLE_CHAPTER.title,
        url: chapterUrl,
        meta: `${SAMPLE_CHAPTER.pages} pages \u00b7 complete chapter`,
        blurb:
          "Six chapters and the Lincoln account: the eight systems every business runs on, why one weak system limits all the others, and the difference between a business and an expensive hobby.",
        cta: "Download Part One",
      };

  const secondary = checklistFirst
    ? { title: SAMPLE_CHAPTER.title, url: chapterUrl }
    : { title: READINESS_CHECKLIST.title, url: checklistUrl };

  const name = escapeHtml(firstName.trim() || "friend");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Your resources</title>
</head>
<body style="margin:0;padding:0;background-color:${C.goldTint};">
<div style="display:none;font-size:1px;color:${C.goldTint};max-height:0;overflow:hidden;">Both files are inside, plus the one question worth four minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.goldTint};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${C.paper};">

  <!-- Masthead -->
  <tr><td style="background-color:${C.ink};padding:30px 36px;text-align:center;">
    ${
      input.logoUrl
        ? `<img src="${input.logoUrl}" width="56" height="56" alt="Kingdom Solutions AI" style="display:block;margin:0 auto 14px;width:56px;height:56px;border:0;" />`
        : ""
    }
    <div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${C.gold};">Kingdom Solutions AI&trade;</div>
    <div style="font-family:${SERIF};font-size:14px;font-style:italic;color:#FFFFFF;opacity:0.72;margin-top:7px;">Leadership, clarity, and sustainable systems</div>
  </td></tr>
  <tr><td style="height:3px;background-color:${C.gold};line-height:3px;font-size:0;">&nbsp;</td></tr>

  <!-- Greeting -->
  <tr><td style="padding:38px 36px 0;">
    <h1 style="margin:0;font-family:${DISPLAY};font-size:26px;line-height:1.22;font-weight:700;color:${C.navy};">Both files are inside, ${name}.</h1>
    <div style="width:52px;height:3px;background-color:${C.gold};margin:18px 0 0;"></div>
    <p style="margin:22px 0 0;font-family:${SERIF};font-size:17px;line-height:1.65;color:${C.body};">
      Nothing has been held back. Part One is the complete chapter as it appears in the book, and the checklist is the full instrument &mdash; not a sample of either.
    </p>
    <p style="margin:16px 0 0;font-family:${SERIF};font-size:17px;line-height:1.65;color:${C.body};">
      Before you open either one, I would like to give you the four minutes that matter most.
    </p>
  </td></tr>

  <!-- The exercise -->
  <tr><td style="padding:26px 36px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.navy};">
      <tr><td style="padding:26px 28px;">
        <div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:${C.goldLight};">${escapeHtml(EXERCISE_PROMPT.heading)}</div>
        <p style="margin:14px 0 0;font-family:${SERIF};font-size:17px;line-height:1.62;color:#FFFFFF;">${escapeHtml(EXERCISE_PROMPT.instruction)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-top:1px solid rgba(255,255,255,0.18);">
          <tr><td style="padding-top:18px;">
            <div style="font-family:${SANS};font-size:9.5px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:#7BE0A6;">${escapeHtml(EXERCISE_PROMPT.checkLabel)}</div>
            <p style="margin:7px 0 0;font-family:${SERIF};font-size:16px;line-height:1.6;color:rgba(255,255,255,0.82);">${escapeHtml(EXERCISE_PROMPT.check)}</p>
          </td></tr>
          <tr><td style="padding-top:18px;">
            <div style="font-family:${SANS};font-size:9.5px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${C.goldLight};">${escapeHtml(EXERCISE_PROMPT.reframeLabel)}</div>
            <p style="margin:7px 0 0;font-family:${SERIF};font-size:16px;line-height:1.6;color:rgba(255,255,255,0.82);">${escapeHtml(EXERCISE_PROMPT.reframe)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-family:${SERIF};font-size:16px;line-height:1.6;color:${C.muted};">
      There is a page at the back of the checklist for this sentence. It is the last page for a reason.
    </p>
  </td></tr>

  <!-- Primary resource -->
  <tr><td style="padding:30px 36px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.gold};background-color:${C.goldTint};">
      <tr><td style="padding:26px 28px;">
        <div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9A7B12;">Ready now</div>
        <p style="margin:11px 0 0;font-family:${DISPLAY};font-size:19px;line-height:1.3;font-weight:700;color:${C.navy};">${escapeHtml(primary.title)}</p>
        <p style="margin:7px 0 0;font-family:${SANS};font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${C.muted};">${escapeHtml(primary.meta)}</p>
        <p style="margin:13px 0 0;font-family:${SERIF};font-size:16px;line-height:1.62;color:${C.body};">${escapeHtml(primary.blurb)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
          <tr><td style="background-color:${C.ink};">
            <a href="${primary.url}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${C.gold};text-decoration:none;">${escapeHtml(primary.cta)}</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- Secondary resource -->
  <tr><td style="padding:12px 36px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.rule};">
      <tr><td style="padding:18px 24px;">
        <div style="font-family:${SANS};font-size:9.5px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${C.muted};">Also yours, at no cost</div>
        <p style="margin:6px 0 0;font-family:${DISPLAY};font-size:16px;font-weight:700;color:${C.navy};">${escapeHtml(secondary.title)}</p>
        <p style="margin:11px 0 0;"><a href="${secondary.url}" style="font-family:${SANS};font-size:10.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.navy};text-decoration:underline;">Download</a></p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Something coming -->
  <tr><td style="padding:30px 36px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="border-left:3px solid ${C.green};padding:4px 0 4px 18px;">
        <p style="margin:0;font-family:${SERIF};font-size:16px;line-height:1.62;color:${C.body};">
          One more thing. I am preparing something for the people on this list, and you will hear about it here first. More soon.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Signature -->
  <tr><td style="padding:32px 36px 38px;">
    <p style="margin:0;font-family:${SERIF};font-size:17px;line-height:1.6;color:${C.body};">Lead well,</p>
    <p style="margin:14px 0 0;font-family:${DISPLAY};font-size:18px;font-weight:700;color:${C.navy};">Tabitha Rector</p>
    <p style="margin:4px 0 0;font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:#9A7B12;">Founder, Kingdom Solutions AI&trade;</p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background-color:${C.ink};padding:22px 36px;text-align:center;">
    <p style="margin:0;font-family:${SANS};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.5);">
      You are receiving this because you requested these resources.
    </p>
    <p style="margin:8px 0 0;font-family:${SANS};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;">
      <a href="${escapeHtml(baseUrl)}" style="color:${C.gold};text-decoration:none;">kingdomsolutionsai.com</a>
    </p>
    ${
      input.unsubscribeUrl
        ? `<p style="margin:10px 0 0;font-family:${SANS};font-size:10px;letter-spacing:1.2px;color:rgba(255,255,255,0.42);">
      <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:rgba(255,255,255,0.55);text-decoration:underline;">Unsubscribe</a>
    </p>`
        : ""
    }
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    `Both files are inside, ${firstName.trim() || "friend"}.`,
    ``,
    `Nothing has been held back. Part One is the complete chapter as it appears in the book, and the checklist is the full instrument -- not a sample of either.`,
    ``,
    `Before you open either one, here are the four minutes that matter most.`,
    ``,
    EXERCISE_PROMPT.heading.toUpperCase(),
    EXERCISE_PROMPT.instruction,
    ``,
    `${EXERCISE_PROMPT.checkLabel}: ${EXERCISE_PROMPT.check}`,
    ``,
    `${EXERCISE_PROMPT.reframeLabel}: ${EXERCISE_PROMPT.reframe}`,
    ``,
    `There is a page at the back of the checklist for this sentence. It is the last page for a reason.`,
    ``,
    `YOUR RESOURCES`,
    `${primary.title}: ${primary.url}`,
    `${secondary.title}: ${secondary.url}`,
    ``,
    `One more thing. I am preparing something for the people on this list, and you will hear about it here first. More soon.`,
    ``,
    `Lead well,`,
    `Tabitha Rector`,
    `Founder, Kingdom Solutions AI(TM)`,
    baseUrl,
    ...(input.unsubscribeUrl
      ? ["", `To stop receiving these emails: ${input.unsubscribeUrl}`]
      : []),
  ].join("\n");

  return {
    subject: checklistFirst
      ? "Your checklist and chapter are inside"
      : "Your chapter and checklist are inside",
    html,
    text,
  };
}

/* ------------------------------------------------------------------ *
 * Owner notification
 * ------------------------------------------------------------------ */
export function buildOwnerEmail(input: {
  firstName: string;
  lastName: string;
  email: string;
  track: string | null;
  resource: ResourceChoice | null;
  baseUrl: string;
  total?: number;
}) {
  const rows: [string, string][] = [
    ["Name", `${input.firstName} ${input.lastName}`.trim()],
    ["Email", input.email],
    ["Wanted first", input.resource ?? "not stated"],
    ["Starting point", input.track ?? "not stated"],
    ["Received", new Date().toLocaleString("en-US", { timeZone: "America/New_York" })],
  ];
  if (typeof input.total === "number") rows.push(["Total signups", String(input.total)]);

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background-color:#F5F3EC;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;margin:0 auto;background-color:#FFFFFF;border:1px solid ${C.rule};">
  <tr><td style="background-color:${C.ink};padding:20px 26px;">
    <div style="font-family:${SANS};font-size:9.5px;font-weight:600;letter-spacing:2.4px;text-transform:uppercase;color:${C.gold};">Kingdom Solutions AI&trade;</div>
    <div style="font-family:${DISPLAY};font-size:18px;font-weight:700;color:#FFFFFF;margin-top:5px;">New signup</div>
  </td></tr>
  <tr><td style="padding:24px 26px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${rows
        .map(
          ([k, v]) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:9.5px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:${C.muted};width:38%;">${escapeHtml(k)}</td>
        <td style="padding:8px 0;border-bottom:1px solid ${C.rule};font-family:${SERIF};font-size:16px;color:${C.body};">${escapeHtml(v)}</td>
      </tr>`,
        )
        .join("")}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
      <tr><td style="background-color:${C.navy};">
        <a href="${absolute(input.baseUrl, "/dashboard")}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">Open dashboard</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");

  return {
    subject: `New signup: ${input.firstName} ${input.lastName}`.trim(),
    html,
    text,
  };
}

/* ------------------------------------------------------------------ *
 * Send
 * ------------------------------------------------------------------ */
export async function sendEmail(input: {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  replyTo?: { email: string; name?: string };
  tags?: string[];
  /**
   * When present, sent as List-Unsubscribe headers so Gmail and Outlook show
   * their own unsubscribe control beside the sender name. Mailbox providers
   * treat that as a positive signal, which protects deliverability.
   */
  unsubscribeUrl?: string;
}): Promise<EmailResult> {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, error: "BREVO_API_KEY is not configured" };

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": key,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: MAIL_FROM.name, email: MAIL_FROM.email },
        to: [input.to],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
        ...(input.unsubscribeUrl
          ? {
              headers: {
                "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }
          : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
    }

    const data = (await response.json()) as { messageId?: string };
    return { ok: true, messageId: data.messageId ?? "sent" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown send error" };
  }
}

/**
 * Fire both signup emails. Never throws: the caller's registration must succeed
 * regardless of what the mail provider does.
 */
export async function sendSignupEmails(input: {
  firstName: string;
  lastName: string;
  email: string;
  track: string | null;
  resource: ResourceChoice | null;
  baseUrl: string;
  logoUrl?: string;
  total?: number;
  unsubscribeUrl?: string;
  trackedUrls?: { chapter: string; checklist: string };
}): Promise<EmailResult> {
  const registrant = buildRegistrantEmail({
    firstName: input.firstName,
    resource: input.resource,
    baseUrl: input.baseUrl,
    logoUrl: input.logoUrl,
    unsubscribeUrl: input.unsubscribeUrl,
    trackedUrls: input.trackedUrls,
  });

  const result = await sendEmail({
    to: { email: input.email, name: `${input.firstName} ${input.lastName}`.trim() },
    subject: registrant.subject,
    html: registrant.html,
    text: registrant.text,
    tags: ["resource-delivery"],
    // Lets Gmail and Outlook offer their own one-click unsubscribe control.
    unsubscribeUrl: input.unsubscribeUrl,
  });

  // Owner notification is best-effort and must not affect the reported outcome.
  const owner = buildOwnerEmail({ ...input });
  void sendEmail({
    to: { email: MAIL_OWNER, name: "Tabitha Rector" },
    subject: owner.subject,
    html: owner.html,
    text: owner.text,
    // So Tabitha can reply straight to the person who signed up.
    replyTo: { email: input.email, name: `${input.firstName} ${input.lastName}`.trim() },
    tags: ["owner-notification"],
  }).catch(() => undefined);

  return result;
}
