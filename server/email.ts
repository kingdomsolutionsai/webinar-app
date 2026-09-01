import {
  EXERCISE_PROMPT,
  MAIL_FROM,
  MAIL_OWNER,
  READINESS_CHECKLIST,
  type ResourceChoice,
} from "../shared/event";
/**
 * Transactional email via Brevo.
 *
 * Three messages exist now: the double opt-in confirmation link (sent the
 * moment someone signs up), the resource + exercise prompt email (sent only
 * after that link is clicked), and a short notification to Tabitha (also sent
 * only after confirmation, since an unconfirmed address is not yet a verified
 * lead). None of these are allowed to fail the registration itself — a person
 * who has already typed their details should never see an error because a
 * mail provider was slow.
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
 * Double opt-in confirmation email
 * ------------------------------------------------------------------ */
/**
 * The very first email a registrant gets. It delivers nothing except the
 * confirm link — the checklist is not attached and not linked here, on
 * purpose, so an unverified address can never receive the file.
 */
export function buildConfirmEmail(input: { firstName: string; confirmUrl: string; logoUrl?: string }) {
  const name = escapeHtml(input.firstName.trim() || "friend");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Confirm your email</title>
</head>
<body style="margin:0;padding:0;background-color:${C.goldTint};">
<div style="display:none;font-size:1px;color:${C.goldTint};max-height:0;overflow:hidden;">One click and the checklist is on its way.</div>
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
    <h1 style="margin:0;font-family:${DISPLAY};font-size:26px;line-height:1.22;font-weight:700;color:${C.navy};">One click, ${name}, and it's on its way.</h1>
    <div style="width:52px;height:3px;background-color:${C.gold};margin:18px 0 0;"></div>
    <p style="margin:22px 0 0;font-family:${SERIF};font-size:17px;line-height:1.65;color:${C.body};">
      Please confirm this is your email address so I know the First-Sale Readiness Checklist is going somewhere real. Nothing else needs to happen &mdash; one click and the file is sent straight to this inbox.
    </p>
  </td></tr>
  <!-- CTA -->
  <tr><td style="padding:30px 36px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.gold};background-color:${C.goldTint};">
      <tr><td style="padding:26px 28px;text-align:center;">
        <p style="margin:0 0 18px;font-family:${DISPLAY};font-size:18px;line-height:1.3;font-weight:700;color:${C.navy};">${escapeHtml(READINESS_CHECKLIST.title)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr><td style="background-color:${C.ink};">
            <a href="${input.confirmUrl}" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${C.gold};text-decoration:none;">Confirm my email</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-family:${SERIF};font-size:14px;line-height:1.6;color:${C.muted};">
      If the button does not work, copy and paste this link into your browser:<br />
      <a href="${input.confirmUrl}" style="color:${C.muted};word-break:break-all;">${escapeHtml(input.confirmUrl)}</a>
    </p>
  </td></tr>
  <!-- Not you -->
  <tr><td style="padding:26px 36px 0;">
    <p style="margin:0;font-family:${SERIF};font-size:14px;line-height:1.6;color:${C.muted};">
      If you did not request this, you can ignore this email and nothing further will happen.
    </p>
  </td></tr>
  <!-- Signature -->
  <tr><td style="padding:26px 36px 38px;">
    <p style="margin:0;font-family:${SERIF};font-size:17px;line-height:1.6;color:${C.body};">Lead well,</p>
    <p style="margin:14px 0 0;font-family:${DISPLAY};font-size:18px;font-weight:700;color:${C.navy};">Tabitha Rector</p>
    <p style="margin:4px 0 0;font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:#9A7B12;">Founder, Kingdom Solutions AI&trade;</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = [
    `One click, ${input.firstName.trim() || "friend"}, and it's on its way.`,
    ``,
    `Please confirm this is your email address so I know the First-Sale Readiness Checklist is going somewhere real. Nothing else needs to happen -- one click and the file is sent straight to this inbox.`,
    ``,
    `Confirm my email: ${input.confirmUrl}`,
    ``,
    `If you did not request this, you can ignore this email and nothing further will happen.`,
    ``,
    `Lead well,`,
    `Tabitha Rector`,
    `Founder, Kingdom Solutions AI(TM)`,
  ].join("\n");
  return { subject: "Confirm your email to get the checklist", html, text };
}
/** Sends the confirmation email. Never throws — same contract as sendEmail. */
export async function sendConfirmEmail(input: {
  firstName: string;
  lastName: string;
  email: string;
  confirmUrl: string;
  logoUrl?: string;
}): Promise<EmailResult> {
  const message = buildConfirmEmail({
    firstName: input.firstName,
    confirmUrl: input.confirmUrl,
    logoUrl: input.logoUrl,
  });
  return sendEmail({
    to: { email: input.email, name: `${input.firstName} ${input.lastName}`.trim() },
    subject: message.subject,
    html: message.html,
    text: message.text,
    tags: ["confirm-email"],
  });
}
/* ------------------------------------------------------------------ *
 * Registrant email — sent only after the confirm link is clicked
 * ------------------------------------------------------------------ */
export function buildRegistrantEmail(input: {
  firstName: string;
  baseUrl: string;
  logoUrl?: string;
  /** Opt-out URL. Omitted only in tests that do not exercise the footer. */
  unsubscribeUrl?: string;
  /**
   * Counted download link for the checklist. When absent the raw file URL is
   * used, so a missing tracker can never produce a dead link.
   */
  trackedUrls?: { checklist: string };
}) {
  const { firstName, baseUrl } = input;
  const checklistUrl = input.trackedUrls?.checklist ?? absolute(baseUrl, READINESS_CHECKLIST.url);
  const name = escapeHtml(firstName.trim() || "friend");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Your checklist</title>
</head>
<body style="margin:0;padding:0;background-color:${C.goldTint};">
<div style="display:none;font-size:1px;color:${C.goldTint};max-height:0;overflow:hidden;">Your checklist is inside, plus the one question worth four minutes.</div>
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
    <h1 style="margin:0;font-family:${DISPLAY};font-size:26px;line-height:1.22;font-weight:700;color:${C.navy};">Your checklist is inside, ${name}.</h1>
    <div style="width:52px;height:3px;background-color:${C.gold};margin:18px 0 0;"></div>
    <p style="margin:22px 0 0;font-family:${SERIF};font-size:17px;line-height:1.65;color:${C.body};">
      Nothing has been held back. This is the full instrument, not a sample of it.
    </p>
    <p style="margin:16px 0 0;font-family:${SERIF};font-size:17px;line-height:1.65;color:${C.body};">
      Before you open it, I would like to give you the four minutes that matter most.
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
  <!-- The resource -->
  <tr><td style="padding:30px 36px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.gold};background-color:${C.goldTint};">
      <tr><td style="padding:26px 28px;">
        <div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9A7B12;">Ready now</div>
        <p style="margin:11px 0 0;font-family:${DISPLAY};font-size:19px;line-height:1.3;font-weight:700;color:${C.navy};">${escapeHtml(READINESS_CHECKLIST.title)}</p>
        <p style="margin:7px 0 0;font-family:${SANS};font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${C.muted};">${READINESS_CHECKLIST.pages} pages · ${READINESS_CHECKLIST.fields} fillable fields</p>
        <p style="margin:13px 0 0;font-family:${SERIF};font-size:16px;line-height:1.62;color:${C.body};">Fourteen conditions to meet before you take money from a client, plus an eight-system scoring diagnostic. Type your answers straight into it and save the file &mdash; nothing to print.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
          <tr><td style="background-color:${C.ink};">
            <a href="${checklistUrl}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${C.gold};text-decoration:none;">Download the checklist</a>
          </td></tr>
        </table>
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
      You are receiving this because you requested this resource and confirmed your email.
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
    `Your checklist is inside, ${firstName.trim() || "friend"}.`,
    ``,
    `Nothing has been held back. This is the full instrument, not a sample of it.`,
    ``,
    `Before you open it, here are the four minutes that matter most.`,
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
    `YOUR RESOURCE`,
    `${READINESS_CHECKLIST.title}: ${checklistUrl}`,
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
    subject: "Your checklist is inside",
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
 * Fire the resource-delivery email plus the owner notification. Called only
 * once an address has confirmed via the double opt-in link — never at raw
 * signup. Never throws: bookkeeping and notification must not take down a
 * confirmation that already succeeded.
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
  trackedUrls?: { checklist: string };
}): Promise<EmailResult> {
  const registrant = buildRegistrantEmail({
    firstName: input.firstName,
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
