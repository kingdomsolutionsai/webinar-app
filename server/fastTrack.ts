import { AUDIT_INVITATION, CORE_PROMISE_SHORT, EXERCISE_PROMPT, FAST_TRACK } from "../shared/event";
import {
  C,
  DISPLAY,
  SANS,
  SERIF,
  buttonRow,
  escapeHtml,
  paragraph,
  postscriptRow,
  pullQuote,
  shell,
  type SequenceContext,
} from "./sequence";
import { trackedDownloadUrl } from "./downloads";

/**
 * The Fast Track arc: the post-session letters while enrollment is open.
 *
 * Five letters, every other day from the morning after the session until the
 * day before enrollment closes, sent to everyone who registered. The price is
 * named from the third letter on, never in the first two. Every letter has
 * one ask (the Strategy Call), and the arc still ends with a plain "this is
 * the last of these letters", so nobody is left wondering when it stops.
 *
 * Copy rules that apply here: no em dashes, no "founding" wording, and no
 * claim that is not true of the program as written.
 */

export type FastTrackContext = SequenceContext & {
  /** Owner-written client story for letter three. Empty means the letter skips it. */
  clientStory?: string;
};

const FOOTER = "You are receiving this because you registered for What Entrepreneurs Need to Know.";
const CTA = "Book a Strategy Call";

function wrap(ctx: FastTrackContext, input: { subject: string; preheader: string; heading: string; body: string[] }) {
  const html = shell({
    preheader: input.preheader,
    heading: input.heading,
    bodyHtml: input.body.join(""),
    baseUrl: ctx.baseUrl,
    logoUrl: ctx.logoUrl,
    unsubscribeUrl: ctx.unsubscribeUrl,
    footerNote: FOOTER,
  });
  return { subject: input.subject, html, text: toText(html) };
}

/** A plain-text version for clients that do not render HTML. */
function toText(html: string) {
  return html
    .replace(/<div style="display:none[^>]*>[\s\S]*?<\/div>/, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, "$2: $1")
    .replace(/<\/(p|tr|h1|li)>/g, "\n\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&trade;/g, "(TM)")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

function navyPanel(label: string, inner: string) {
  return `<tr><td style="padding:24px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.navy};"><tr><td style="padding:26px 28px;">
      <div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:#E3C55A;">${escapeHtml(label)}</div>
      ${inner}
    </td></tr></table></td></tr>`;
}

function panelText(text: string) {
  return `<p style="margin:14px 0 0;font-family:${SERIF};font-size:17px;line-height:1.62;color:#FFFFFF;">${text}</p>`;
}

function smallLabel(text: string) {
  return `<tr><td style="padding:26px 36px 0;"><div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:#9A7B12;">${escapeHtml(text)}</div></td></tr>`;
}

function includedList(items: string[]) {
  const rows = items
    .map(
      item =>
        `<tr><td valign="top" style="width:22px;padding:8px 0 0;font-family:${DISPLAY};font-size:16px;color:${C.gold};">&#10003;</td><td style="padding:8px 0 0;font-family:${SERIF};font-size:17px;line-height:1.5;color:${C.body};">${item}</td></tr>`,
    )
    .join("");
  return `<tr><td style="padding:12px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>`;
}

const name = (ctx: FastTrackContext) => escapeHtml(ctx.firstName.trim() || "friend");
const hasReplay = (ctx: FastTrackContext) => Boolean(ctx.replayUrl && ctx.replayUrl.trim());

const OFFER_LINE = `one clear offer, a message people understand, and a revenue path`;
const DETAILS = `It is ${FAST_TRACK.price}, limited to ${FAST_TRACK.seats} women so each one gets real attention, and it begins ${FAST_TRACK.startsLabel}. Enrollment closes ${FAST_TRACK.closesLabel}.`;
const CALL_PS = `The Strategy Call is thirty minutes on Zoom. You will leave knowing your next step, whether or not the Fast Track is the right fit.`;

/** Letter one, the morning after: the exercise, the replay, and the invitation. */
export function buildFastTrackMorningAfter(ctx: FastTrackContext) {
  const replay = hasReplay(ctx);
  const body = [
    paragraph(
      replay
        ? `Yesterday we walked the whole sequence, ${name(ctx)}. If you were there, thank you for giving me that time. If you were not, the recording is below and nothing was held back from it.`
        : `Yesterday we walked the whole sequence, ${name(ctx)}. If you were there, thank you for giving me that time. If life got in the way, I am not going to make you feel badly about it, so here is the part that mattered most, in writing.`,
    ),
    ...(replay ? [buttonRow("Watch the session", ctx.replayUrl!.trim())] : []),
    paragraph(
      `One thing I asked of everyone, and it is the only assignment from the whole session. It takes about four minutes and it is worth more than any note you took.`,
    ),
    navyPanel(EXERCISE_PROMPT.heading, panelText(escapeHtml(EXERCISE_PROMPT.instruction))),
    paragraph(`If you cannot write it yet, ${escapeHtml(EXERCISE_PROMPT.reframe.charAt(0).toLowerCase() + EXERCISE_PROMPT.reframe.slice(1))}`),
    paragraph(
      `If you attended, your First-Sale Readiness Checklist is either already in your inbox or on its way in a separate email, so there is no link to hunt for here.`,
    ),
    smallLabel("What comes next"),
    paragraph(
      `For anyone who wants to put yesterday into practice instead of carrying it around, I am opening the ${FAST_TRACK.name}. In thirty days, working with me directly, you leave with ${OFFER_LINE} for the next ninety days. We begin ${FAST_TRACK.startsLabel}.`,
    ),
    paragraph(`If that sounds like what you need, the first step is a short conversation.`),
    buttonRow(CTA, FAST_TRACK.callUrl),
    pullQuote(escapeHtml(CORE_PROMISE_SHORT)),
  ];
  return wrap(ctx, {
    subject: replay ? "The recording, the one sentence, and what comes next" : "The one sentence, and what comes next",
    preheader: "The only assignment from yesterday, and an invitation.",
    heading: replay ? "Yesterday, in full." : "The part that mattered most.",
    body,
  });
}

/** Letter two, three days after: agreeing is not the same as starting. */
export function buildFastTrackAgreeing(ctx: FastTrackContext) {
  const body = [
    paragraph(`Three days on, ${name(ctx)}, I want to name something I have watched happen many times, including to me.`),
    paragraph(
      `A session like that one does not usually leave people disagreeing. It leaves them agreeing with all of it and then stalling, because agreeing with eight systems is not the same as knowing which one is yours to touch on Monday morning.`,
    ),
    pullQuote(`Clarity is not knowing everything. It is knowing what is next.`),
    paragraph(`If you have written your sentence and taken one step, keep going. You are doing the work.`),
    paragraph(
      `If you have not, the reason is almost certainly not laziness and almost certainly not lack of ability. It is that nothing has told you where to begin. That is exactly what the ${FAST_TRACK.name} is for. We start by naming your week-one priority, so the next thirty days go to the right thing in the right order instead of to everything at once.`,
    ),
    buttonRow(CTA, FAST_TRACK.callUrl),
    postscriptRow(
      `P.S. ${CALL_PS} Not ready for a conversation? The Capacity Leak Audit™ names what to fix first.`,
      "Take the audit",
      AUDIT_INVITATION.url,
    ),
  ];
  return wrap(ctx, {
    subject: "Agreeing is not the same as starting",
    preheader: "Why good sessions still end in a stall, and what to do about it.",
    heading: "The gap between agreeing and starting.",
    body,
  });
}

/** Letter three, five days after: what building in the right order looks like, and the price. */
export function buildFastTrackStory(ctx: FastTrackContext) {
  const story = (ctx.clientStory ?? "").trim();
  const replay = hasReplay(ctx);
  const body = [
    paragraph(`${name(ctx)}, I want to show you what building in the right order looks like when it is someone's real business.`),
    ...(story
      ? [navyPanel("From a client", panelText(escapeHtml(story)))]
      : [
          paragraph(
            `Most of the women I work with are not short on effort. They are short on order. They have been working hard on the right things in the wrong sequence, and it has been costing them time, money, and confidence they did not need to spend.`,
          ),
        ]),
    paragraph(
      `That is what the ${FAST_TRACK.name} changes. Thirty days, working with me directly, and you leave with ${OFFER_LINE} for the next ninety days.`,
    ),
    paragraph(DETAILS),
    buttonRow(CTA, FAST_TRACK.callUrl),
    ...(replay
      ? [postscriptRow(`P.S. If you missed the session, the recording is still here.`, "Watch the session", ctx.replayUrl!.trim())]
      : [postscriptRow(`P.S. ${CALL_PS}`, "Choose a time", FAST_TRACK.callUrl)]),
  ];
  return wrap(ctx, {
    subject: "What thirty days can change",
    preheader: "What building in the right order looks like in practice.",
    heading: "What thirty days can change.",
    body,
  });
}

/** Letter four, seven days after: exactly what is inside, and the Right Order Promise. */
export function buildFastTrackInside(ctx: FastTrackContext) {
  const body = [
    paragraph(`${name(ctx)}, here is exactly what the ${FAST_TRACK.name} includes, plainly.`),
    includedList([
      `A private kickoff, with a 90-minute strategy session and assessment`,
      `Four guided implementation sessions`,
      `Reviews of your offer and your messaging`,
      `Support between sessions`,
      `Clarity Pro™, with 90 days of continued access`,
      `The Fast Track Toolkit: the digital book, worksheets, and templates`,
    ]),
    navyPanel(
      "The Right Order Promise",
      panelText(
        `By the end of week one you will have a clear priority and a plan. If you do not, I will give you a private realignment session at no additional cost.`,
      ),
    ),
    paragraph(`What you leave with: ${OFFER_LINE} for the next ninety days, ready for the first quarter of 2027.`),
    paragraph(DETAILS),
    buttonRow(CTA, FAST_TRACK.callUrl),
    postscriptRow(`P.S. ${CALL_PS}`, "Choose a time", FAST_TRACK.callUrl),
  ];
  return wrap(ctx, {
    subject: "Exactly what is inside the Fast Track",
    preheader: "Everything included, and the promise behind it.",
    heading: "Exactly what is inside.",
    body,
  });
}

/** Letter five, nine days after: enrollment closes tomorrow, and this is the last letter. */
export function buildFastTrackLast(ctx: FastTrackContext) {
  const chapterUrl = ctx.chapterUrlOverride ?? trackedDownloadUrl(ctx.baseUrl, "chapter", ctx.email);
  const remainsYours = ctx.attended
    ? `Whatever you decide, nothing else expires. The chapter and the checklist remain yours, and if you come back a year from now with a different question, I will still answer it.`
    : `Whatever you decide, nothing else expires. Part One remains yours, and if a future session comes around, the checklist will be waiting for you there too.`;
  const body = [
    paragraph(
      `${name(ctx)}, enrollment for the ${FAST_TRACK.name} closes tomorrow, ${FAST_TRACK.closesLabel}. We begin ${FAST_TRACK.startsLabel}, and there are ${FAST_TRACK.seats} places in total.`,
    ),
    paragraph(
      `If you have been weighing it, a Strategy Call is the easiest way to decide. Thirty minutes, and you leave knowing your next step either way. Times are open through tomorrow.`,
    ),
    buttonRow(CTA, FAST_TRACK.callUrl),
    paragraph(
      `This is also the last of these letters. I would rather tell you that than keep arriving in your inbox indefinitely. You are carrying enough.`,
    ),
    paragraph(remainsYours),
    pullQuote(escapeHtml(CORE_PROMISE_SHORT)),
    postscriptRow(`P.S. If you would rather sit with the book a while longer, that is a legitimate choice and not a lesser one.`, "Read Part One again", chapterUrl),
  ];
  return wrap(ctx, {
    subject: "Enrollment closes tomorrow",
    preheader: "The Fast Track closes tomorrow, and this is the last of these letters.",
    heading: "Enrollment closes tomorrow.",
    body,
  });
}

/** True while the Fast Track is still open for a session starting at `start`. */
export function fastTrackOpenFor(start: Date) {
  return start.getTime() < new Date(FAST_TRACK.closesAt).getTime();
}
