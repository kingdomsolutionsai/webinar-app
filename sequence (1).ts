import {
  AUDIT_INVITATION,
  CORE_PROMISE_SHORT,
  EXERCISE_PROMPT,
  LION_MARK_URL,
  MAIL_FROM,
  READINESS_CHECKLIST,
  isPlaceholder,
} from "../shared/event";
import {
  claimSequenceStep,
  finishSequenceStep,
  listSequenceCandidates,
  listSequenceSends,
  releaseSequenceStep,
} from "./db";
import { trackedDownloadUrl } from "./downloads";
import { sendEmail } from "./email";
import { unsubscribeUrl } from "./unsubscribe";
/**
 * The post-signup sequence.
 *
 * Three letters, timed from each person's own signup date rather than from a
 * broadcast calendar, so somebody who joins today gets the same experience as
 * somebody who joined in March. The dispatcher runs on a schedule and asks a
 * single question per person: which letters are due and not yet sent.
 */
export const SEQUENCE_PAUSED_KEY = "sequencePaused";
/** Days after signup that each letter goes out. */
export const SEQUENCE_SCHEDULE = [
  { step: 1, day: 2 },
  { step: 2, day: 7 },
  { step: 3, day: 14 },
] as const;
export type SequenceStep = 1 | 2 | 3 | 4 | 5 | 6;
/**
 * Letter four is the exception to everything above.
 *
 * Letters 1-3 are timed from each person's own signup date. Letter four is timed
 * from the session itself — it goes out the morning after, to everyone on the
 * list, because attendance is never complete and this is the letter that
 * recovers the people who fully intended to be there.
 *
 * It therefore cannot appear in SEQUENCE_SCHEDULE, which is signup-relative.
 */
export const REPLAY_STEP = 4 as const;
/** Hours after the session start before the morning-after letter may go out. */
export const REPLAY_DELAY_HOURS = 14;
/**
 * The post-session arc. Like the replay letter, these are timed from the session
 * rather than from signup, so everyone moves through them together.
 *
 * Six is deliberately the last letter there will ever be. The audience is
 * depleted women who are already carrying too much; an indefinite nurture
 * sequence would take from them rather than give, and would eventually be
 * ignored anyway. After letter six the list goes quiet unless Tabitha
 * deliberately chooses to write again.
 */
export const POST_SESSION_SCHEDULE = [
  { step: 5, hoursAfter: 3 * 24 },
  { step: 6, hoursAfter: 7 * 24 },
] as const;
export const FINAL_STEP = 6 as const;
/* ------------------------------------------------------------------ *
 * Shared shell — one layout, so the three letters look like one voice
 * ------------------------------------------------------------------ */
const C = {
  ink: "#0B0B0B",
  gold: "#C9A227",
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
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function shell(input: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  baseUrl: string;
  logoUrl?: string;
  unsubscribeUrl?: string;
}) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(input.heading)}</title></head>
<body style="margin:0;padding:0;background-color:${C.goldTint};">
<div style="display:none;font-size:1px;color:${C.goldTint};max-height:0;overflow:hidden;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.goldTint};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${C.paper};">
  <tr><td style="background-color:${C.ink};padding:26px 36px;text-align:center;">
    ${
      input.logoUrl
        ? `<img src="${input.logoUrl}" width="48" height="48" alt="Kingdom Solutions AI" style="display:block;margin:0 auto 12px;width:48px;height:48px;border:0;" />`
        : ""
    }
    <div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${C.gold};">Kingdom Solutions AI&trade;</div>
  </td></tr>
  <tr><td style="height:3px;background-color:${C.gold};line-height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:36px 36px 0;">
    <h1 style="margin:0;font-family:${DISPLAY};font-size:25px;line-height:1.24;font-weight:700;color:${C.navy};">${escapeHtml(input.heading)}</h1>
    <div style="width:52px;height:3px;background-color:${C.gold};margin:18px 0 0;"></div>
  </td></tr>
  ${input.bodyHtml}
  <tr><td style="padding:30px 36px 38px;">
    <p style="margin:0;font-family:${SERIF};font-size:17px;line-height:1.6;color:${C.body};">Lead well,</p>
    <p style="margin:14px 0 0;font-family:${DISPLAY};font-size:18px;font-weight:700;color:${C.navy};">Tabitha Rector</p>
    <p style="margin:4px 0 0;font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:#9A7B12;">Founder, Kingdom Solutions AI&trade;</p>
  </td></tr>
  <tr><td style="background-color:${C.ink};padding:22px 36px;text-align:center;">
    <p style="margin:0;font-family:${SANS};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.5);">You are receiving this because you requested the free resources.</p>
    ${
      input.unsubscribeUrl
        ? `<p style="margin:10px 0 0;font-family:${SANS};font-size:10px;letter-spacing:1.2px;"><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:rgba(255,255,255,0.55);text-decoration:underline;">Unsubscribe</a></p>`
        : ""
    }
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
function paragraph(text: string) {
  return `<tr><td style="padding:20px 36px 0;"><p style="margin:0;font-family:${SERIF};font-size:17px;line-height:1.65;color:${C.body};">${text}</p></td></tr>`;
}
function pullQuote(text: string) {
  return `<tr><td style="padding:24px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-left:3px solid ${C.gold};padding:4px 0 4px 18px;"><p style="margin:0;font-family:${DISPLAY};font-size:19px;line-height:1.45;font-style:italic;color:${C.navy};">${text}</p></td></tr></table></td></tr>`;
}
function buttonRow(label: string, url: string) {
  return `<tr><td style="padding:26px 36px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${C.ink};"><a href="${url}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${C.gold};text-decoration:none;">${escapeHtml(label)}</a></td></tr></table></td></tr>`;
}
/**
 * The audit postscript. Set below a hairline rule in smaller, muted type so it
 * reads as a genuine afterthought rather than the purpose of the letter.
 *
 * Used on letter two only. Letter one must give without asking for anything, and
 * letter three carries the session announcement — putting a second ask beside it
 * would compete with the one action that letter exists to produce.
 */
function postscriptRow(text: string, label: string, url: string) {
  return `<tr><td style="padding:30px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${C.rule};padding-top:18px;">
    <p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${C.muted};">${escapeHtml(text)} <a href="${url}" style="color:${C.navy};text-decoration:underline;">${escapeHtml(label)}</a></p>
  </td></tr></table></td></tr>`;
}
/* ------------------------------------------------------------------ *
 * The three letters
 * ------------------------------------------------------------------ */
export type SequenceContext = {
  firstName: string;
  email: string;
  baseUrl: string;
  logoUrl?: string;
  unsubscribeUrl?: string;
  /** Set once Tabitha enters a real date; changes letter three from tease to invitation. */
  eventDate?: string;
  eventTime?: string;
  /** Owner-editable recording link. Absent means the letter mentions no recording. */
  replayUrl?: string;
  /** True when this person has not opened either resource yet. */
  hasDownloaded?: boolean;
};
/** Letter one, day two: the promised heads-up, and a nudge to actually open the file. */
export function buildSequenceStepOne(ctx: SequenceContext) {
  const name = escapeHtml(ctx.firstName.trim() || "friend");
  const checklistUrl = trackedDownloadUrl(ctx.baseUrl, "checklist", ctx.email);
  const body = [
    paragraph(
      `When I said something was coming, ${name}, I meant it — and I would rather tell you now than surprise you later.`,
    ),
    paragraph(
      `I am preparing a live session that walks the whole sequence in order: the eight systems every business runs on, which one to build first, and where AI belongs once the human decisions are settled. You are on the list, so you will get the date before it goes anywhere else.`,
    ),
    pullQuote(escapeHtml(CORE_PROMISE_SHORT)),
    paragraph(
      ctx.hasDownloaded
        ? `In the meantime, thank you for opening what I sent. If you have not reached the page at the back yet, that is the part I would not skip.`
        : `In the meantime, the checklist is still sitting there unopened. I am not going to pretend that matters to me more than it matters to you — but it is the piece that shows you which of the eight systems is quietly limiting all the others, and it takes about twenty minutes.`,
    ),
    buttonRow(ctx.hasDownloaded ? "Open it again" : "Open the checklist", checklistUrl),
  ].join("");
  const text = [
    `When I said something was coming, ${ctx.firstName.trim() || "friend"}, I meant it.`,
    ``,
    `I am preparing a live session that walks the whole sequence in order: the eight systems every business runs on, which one to build first, and where AI belongs once the human decisions are settled. You are on the list, so you will get the date before it goes anywhere else.`,
    ``,
    CORE_PROMISE_SHORT,
    ``,
    ctx.hasDownloaded
      ? `Thank you for opening what I sent. If you have not reached the page at the back yet, that is the part I would not skip.`
      : `In the meantime, the checklist is still unopened. It is the piece that shows you which of the eight systems is quietly limiting all the others, and it takes about twenty minutes.`,
    ``,
    `Open the checklist: ${checklistUrl}`,
    ``,
    `Lead well,`,
    `Tabitha Rector`,
    `Founder, Kingdom Solutions AI(TM)`,
    ...(ctx.unsubscribeUrl ? ["", `To stop receiving these: ${ctx.unsubscribeUrl}`] : []),
  ].join("\n");
  return {
    subject: "The thing I mentioned",
    html: shell({
      preheader: "A live session is coming, and you will hear the date here first.",
      heading: "About that something.",
      bodyHtml: body,
      baseUrl: ctx.baseUrl,
      logoUrl: ctx.logoUrl,
      unsubscribeUrl: ctx.unsubscribeUrl,
    }),
    text,
  };
}
/** Letter two, day seven: the exercise, revisited — the highest-value four minutes. */
export function buildSequenceStepTwo(ctx: SequenceContext) {
  const name = escapeHtml(ctx.firstName.trim() || "friend");
  const checklistUrl = trackedDownloadUrl(ctx.baseUrl, "checklist", ctx.email);
  const body = [
    paragraph(
      `A week ago I asked you to write one sentence, ${name}. I want to come back to it, because it is the single exercise I have seen change the most outcomes.`,
    ),
    `<tr><td style="padding:24px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.navy};"><tr><td style="padding:26px 28px;">
      <div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:#E3C55A;">${escapeHtml(EXERCISE_PROMPT.heading)}</div>
      <p style="margin:14px 0 0;font-family:${SERIF};font-size:17px;line-height:1.62;color:#FFFFFF;">${escapeHtml(EXERCISE_PROMPT.instruction)}</p>
    </td></tr></table></td></tr>`,
    paragraph(
      `Most people cannot write it on the first attempt. I could not. That is not a verdict on your ability — it is information, and it is the most useful information you can have this early, because it tells you exactly where your work begins.`,
    ),
    paragraph(escapeHtml(EXERCISE_PROMPT.check)),
    pullQuote(
      `If you cannot write it yet, that is not a failure. That is your diagnosis.`,
    ),
    paragraph(
      `The checklist has a page at the back for this sentence, and it is the last page for a reason. Everything before it exists to make that sentence possible.`,
    ),
    buttonRow("Open the checklist", checklistUrl),
    postscriptRow(
      `P.S. — ${AUDIT_INVITATION.postscript}`,
      "Take the Capacity Leak Audit™",
      AUDIT_INVITATION.url,
    ),
  ].join("");
  const text = [
    `A week ago I asked you to write one sentence. I want to come back to it.`,
    ``,
    EXERCISE_PROMPT.heading.toUpperCase(),
    EXERCISE_PROMPT.instruction,
    ``,
    `Most people cannot write it on the first attempt. I could not. That is not a verdict on your ability -- it is information, and it tells you where your work begins.`,
    ``,
    EXERCISE_PROMPT.check,
    ``,
    `If you cannot write it yet, that is not a failure. That is your diagnosis.`,
    ``,
    `The checklist has a page at the back for this sentence: ${checklistUrl}`,
    ``,
    `P.S. -- ${AUDIT_INVITATION.postscript}`,
    AUDIT_INVITATION.url,
    ``,
    `Lead well,`,
    `Tabitha Rector`,
    `Founder, Kingdom Solutions AI(TM)`,
    ...(ctx.unsubscribeUrl ? ["", `To stop receiving these: ${ctx.unsubscribeUrl}`] : []),
  ].join("\n");
  return {
    subject: "The one sentence, revisited",
    html: shell({
      preheader: "The four minutes that change the most outcomes.",
      heading: "One sentence, one week later.",
      bodyHtml: body,
      baseUrl: ctx.baseUrl,
      logoUrl: ctx.logoUrl,
      unsubscribeUrl: ctx.unsubscribeUrl,
    }),
    text,
  };
}
/**
 * Letter three, day fourteen: the announcement.
 *
 * Adapts to reality. With a date set it invites; without one it says plainly that
 * the date is not fixed yet, which is far better than an invitation to nothing.
 */
export function buildSequenceStepThree(ctx: SequenceContext) {
  const name = escapeHtml(ctx.firstName.trim() || "friend");
  const hasDate = !isPlaceholder(ctx.eventDate);
  const when = hasDate
    ? [ctx.eventDate, ctx.eventTime].filter(v => v && !isPlaceholder(v)).join(" at ")
    : "";
  const body = hasDate
    ? [
        paragraph(`The date is set, ${name}.`),
        `<tr><td style="padding:24px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.gold};background-color:${C.goldTint};"><tr><td style="padding:24px 28px;text-align:center;">
          <div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9A7B12;">What Every New Entrepreneur Needs to Know</div>
          <p style="margin:12px 0 0;font-family:${DISPLAY};font-size:22px;font-weight:700;color:${C.navy};">${escapeHtml(when)}</p>
        </td></tr></table></td></tr>`,
        paragraph(
          `We walk the whole sequence in order — the eight systems, the order to build them in, the six steps that produce evidence before expense, and where AI belongs once the human decisions are made. You will leave knowing which stage you are actually at, which is usually not the stage people assume.`,
        ),
        pullQuote(escapeHtml(CORE_PROMISE_SHORT)),
        buttonRow("Reserve your seat", ctx.baseUrl),
      ].join("")
    : [
        paragraph(
          `Two weeks ago you asked for the checklist, ${name}, and I promised you would hear about the live session before anyone else.`,
        ),
        paragraph(
          `I am holding to that. The date is not fixed yet, and I would rather tell you that plainly than send you an invitation to something I cannot yet deliver. When it is set, this list hears first.`,
        ),
        paragraph(
          `In the meantime, the checklist remains yours, and the one-sentence exercise is still the most valuable four minutes available to you. If you have written that sentence, you are further along than most.`,
        ),
        pullQuote(escapeHtml(CORE_PROMISE_SHORT)),
        buttonRow("Revisit the checklist", ctx.baseUrl),
      ].join("");
  const text = hasDate
    ? [
        `The date is set.`,
        ``,
        `What Every New Entrepreneur Needs to Know -- ${when}`,
        ``,
        `We walk the whole sequence in order: the eight systems, the order to build them in, the six steps that produce evidence before expense, and where AI belongs once the human decisions are made.`,
        ``,
        CORE_PROMISE_SHORT,
        ``,
        `Reserve your seat: ${ctx.baseUrl}`,
      ].join("\n")
    : [
        `Two weeks ago you asked for the checklist, and I promised you would hear about the live session first.`,
        ``,
        `The date is not fixed yet, and I would rather tell you plainly than send an invitation to something I cannot yet deliver. When it is set, this list hears first.`,
        ``,
        `The checklist remains yours, and the one-sentence exercise is still the most valuable four minutes available to you.`,
        ``,
        CORE_PROMISE_SHORT,
        ``,
        ctx.baseUrl,
      ].join("\n");
  return {
    subject: hasDate ? `The date is set: ${when}` : "Still coming, and you will hear first",
    html: shell({
      preheader: hasDate ? "Your seat is waiting." : "An honest update on the live session.",
      heading: hasDate ? "The date is set." : "An honest update.",
      bodyHtml: body,
      baseUrl: ctx.baseUrl,
      logoUrl: ctx.logoUrl,
      unsubscribeUrl: ctx.unsubscribeUrl,
    }),
    text: [
      text,
      ``,
      `Lead well,`,
      `Tabitha Rector`,
      `Founder, Kingdom Solutions AI(TM)`,
      ...(ctx.unsubscribeUrl ? ["", `To stop receiving these: ${ctx.unsubscribeUrl}`] : []),
    ].join("\n"),
  };
}
export function buildSequenceEmail(step: SequenceStep, ctx: SequenceContext) {
  if (step === 1) return buildSequenceStepOne(ctx);
  if (step === 2) return buildSequenceStepTwo(ctx);
  if (step === 4) return buildReplayLetter(ctx);
  if (step === 5) return buildPostSessionLetter(ctx);
  if (step === 6) return buildFinalLetter(ctx);
  return buildSequenceStepThree(ctx);
}
/**
 * Letter five, three days after: the objection letter.
 *
 * The stall after a session like this is rarely disagreement. It is that she now
 * sees eight systems, agrees with all of it, and has no idea which one is hers to
 * touch first. This letter names that plainly and answers it, which is what the
 * audit exists to do.
 */
export function buildPostSessionLetter(ctx: SequenceContext) {
  const name = escapeHtml(ctx.firstName.trim() || "friend");
  const body = [
    paragraph(
      `Three days on, ${name}, I want to name something I have watched happen many times — including to me.`,
    ),
    paragraph(
      `A session like that one does not usually leave people disagreeing. It leaves them agreeing with all of it and then stalling, because agreeing with eight systems is not the same as knowing which one is yours to touch on Monday morning.`,
    ),
    pullQuote(`Clarity is not knowing everything. It is knowing what is next.`),
    paragraph(
      `If you have written your sentence and taken one step, you do not need anything else from me this week. Keep going.`,
    ),
    paragraph(
      `If you have not, the reason is almost certainly not laziness and almost certainly not lack of ability. It is that nothing has told you where to begin. That is a solvable problem, and it is the only problem the Capacity Leak Audit™ tries to solve — it names which of the five areas is actually holding you back, so your next month goes to one thing instead of all of them.`,
    ),
    buttonRow("Find out what to fix first", AUDIT_INVITATION.url),
  ].join("");
  const text = [
    `Three days on, I want to name something I have watched happen many times, including to me.`,
    ``,
    `A session like that one does not usually leave people disagreeing. It leaves them agreeing with all of it and then stalling, because agreeing with eight systems is not the same as knowing which one is yours to touch on Monday morning.`,
    ``,
    `Clarity is not knowing everything. It is knowing what is next.`,
    ``,
    `If you have written your sentence and taken one step, you do not need anything else from me this week. Keep going.`,
    ``,
    `If you have not, the reason is almost certainly not laziness. It is that nothing has told you where to begin. That is the only problem the Capacity Leak Audit(TM) tries to solve: it names which of the five areas is actually holding you back.`,
    ``,
    `Find out what to fix first: ${AUDIT_INVITATION.url}`,
    ``,
    `Lead well,`,
    `Tabitha Rector`,
    `Founder, Kingdom Solutions AI(TM)`,
    ...(ctx.unsubscribeUrl ? ["", `To stop receiving these: ${ctx.unsubscribeUrl}`] : []),
  ].join("\n");
  return {
    subject: "Agreeing is not the same as starting",
    html: shell({
      preheader: "Why good sessions still end in a stall, and what to do about it.",
      heading: "The gap between agreeing and starting.",
      bodyHtml: body,
      baseUrl: ctx.baseUrl,
      logoUrl: ctx.logoUrl,
      unsubscribeUrl: ctx.unsubscribeUrl,
    }),
    text,
  };
}
/**
 * Letter six, seven days after: the last word.
 *
 * Says plainly that it is the last letter, which is both courteous and more
 * persuasive than pretending otherwise. Nothing is withdrawn and no deadline is
 * invented — the resources stay available, and the door stays open on her
 * timetable rather than a marketing calendar.
 */
export function buildFinalLetter(ctx: SequenceContext) {
  const name = escapeHtml(ctx.firstName.trim() || "friend");
  const checklistUrl = trackedDownloadUrl(ctx.baseUrl, "checklist", ctx.email);
  const body = [
    paragraph(
      `This is the last of these letters, ${name}. I would rather tell you that than keep arriving in your inbox indefinitely — you are carrying enough.`,
    ),
    paragraph(
      `Nothing here expires. The checklist remains yours, the audit will still be there in six months, and if you come back a year from now with a different question, I will still answer it.`,
    ),
    pullQuote(escapeHtml(CORE_PROMISE_SHORT)),
    paragraph(
      `What I hope you take from all of this is not a system or a tool. It is the conviction that building something worthwhile does not require you to run yourself into the ground first. That was the lie I believed, and it cost me a season I would rather not repeat.`,
    ),
    paragraph(
      `If you want a place to begin, the audit names which area is holding you back. If you would rather sit with the checklist a while longer, that is a legitimate choice and not a lesser one.`,
    ),
    buttonRow("Open the checklist again", checklistUrl),
    postscriptRow(
      `P.S. — If you would rather start with a diagnosis than a decision:`,
      "Take the Capacity Leak Audit™",
      AUDIT_INVITATION.url,
    ),
  ].join("");
  const text = [
    `This is the last of these letters. I would rather tell you that than keep arriving in your inbox indefinitely -- you are carrying enough.`,
    ``,
    `Nothing here expires. The checklist remains yours, the audit will still be there in six months, and if you come back a year from now with a different question, I will still answer it.`,
    ``,
    CORE_PROMISE_SHORT,
    ``,
    `What I hope you take from all of this is not a system or a tool. It is the conviction that building something worthwhile does not require you to run yourself into the ground first. That was the lie I believed, and it cost me a season I would rather not repeat.`,
    ``,
    `If you want a place to begin, the audit names which area is holding you back. If you would rather sit with the checklist a while longer, that is a legitimate choice and not a lesser one.`,
    ``,
    `Open the checklist again: ${checklistUrl}`,
    ``,
    `P.S. -- If you would rather start with a diagnosis than a decision: ${AUDIT_INVITATION.url}`,
    ``,
    `Lead well,`,
    `Tabitha Rector`,
    `Founder, Kingdom Solutions AI(TM)`,
    ...(ctx.unsubscribeUrl ? ["", `To stop receiving these: ${ctx.unsubscribeUrl}`] : []),
  ].join("\n");
  return {
    subject: "The last letter",
    html: shell({
      preheader: "Nothing expires, and this is the last of these.",
      heading: "The last letter.",
      bodyHtml: body,
      baseUrl: ctx.baseUrl,
      logoUrl: ctx.logoUrl,
      unsubscribeUrl: ctx.unsubscribeUrl,
    }),
    text,
  };
}
/**
 * Letter four, the morning after: the replay, and the exercise restated.
 *
 * Adapts honestly to whether a recording exists. With a replay link it offers
 * the recording; without one it says nothing about a recording at all rather
 * than implying one is coming. Promising a replay that never arrives would cost
 * more trust than the letter could ever earn.
 *
 * The exercise is restated in full either way, because it is the single action
 * the session asked for, and someone who missed the session has never seen it.
 */
export function buildReplayLetter(ctx: SequenceContext) {
  const name = escapeHtml(ctx.firstName.trim() || "friend");
  const hasReplay = Boolean(ctx.replayUrl && ctx.replayUrl.trim());
  const checklistUrl = trackedDownloadUrl(ctx.baseUrl, "checklist", ctx.email);
  const opening = hasReplay
    ? paragraph(
        `Yesterday we walked the whole sequence, ${name}. If you were there, thank you for giving me that time. If you were not, the recording is below and nothing was held back from it.`,
      )
    : paragraph(
        `Yesterday we walked the whole sequence, ${name}. If you were there, thank you for giving me that time. If life got in the way, I am not going to make you feel badly about it — so here is the part that mattered most, in writing.`,
      );
  const body = [
    opening,
    ...(hasReplay ? [buttonRow("Watch the session", ctx.replayUrl!.trim())] : []),
    paragraph(
      `One thing I asked of everyone, and it is the only assignment from the whole session. It takes about four minutes and it is worth more than any note you took.`,
    ),
    `<tr><td style="padding:24px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.navy};"><tr><td style="padding:26px 28px;">
      <div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:#E3C55A;">${escapeHtml(EXERCISE_PROMPT.heading)}</div>
      <p style="margin:14px 0 0;font-family:${SERIF};font-size:17px;line-height:1.62;color:#FFFFFF;">${escapeHtml(EXERCISE_PROMPT.instruction)}</p>
    </td></tr></table></td></tr>`,
    paragraph(escapeHtml(EXERCISE_PROMPT.reframe)),
    pullQuote(escapeHtml(CORE_PROMISE_SHORT)),
    paragraph(
      `The checklist has a page at the back for that sentence. If you write nothing else this week, write that.`,
    ),
    buttonRow("Open the checklist", checklistUrl),
    postscriptRow(
      `P.S. — ${AUDIT_INVITATION.postscript}`,
      "Take the Capacity Leak Audit™",
      AUDIT_INVITATION.url,
    ),
  ].join("");
  const text = [
    hasReplay
      ? `Yesterday we walked the whole sequence. If you were there, thank you. If you were not, the recording is here and nothing was held back from it.`
      : `Yesterday we walked the whole sequence. If you were there, thank you. If life got in the way, here is the part that mattered most, in writing.`,
    ...(hasReplay ? [``, `Watch the session: ${ctx.replayUrl!.trim()}`] : []),
    ``,
    `One thing I asked of everyone, and it is the only assignment from the whole session:`,
    ``,
    EXERCISE_PROMPT.heading.toUpperCase(),
    EXERCISE_PROMPT.instruction,
    ``,
    EXERCISE_PROMPT.reframe,
    ``,
    CORE_PROMISE_SHORT,
    ``,
    `The checklist has a page at the back for that sentence: ${checklistUrl}`,
    ``,
    `P.S. -- ${AUDIT_INVITATION.postscript}`,
    AUDIT_INVITATION.url,
    ``,
    `Lead well,`,
    `Tabitha Rector`,
    `Founder, Kingdom Solutions AI(TM)`,
    ...(ctx.unsubscribeUrl ? ["", `To stop receiving these: ${ctx.unsubscribeUrl}`] : []),
  ].join("\n");
  return {
    subject: hasReplay ? "The recording, and the one sentence" : "The one sentence, in writing",
    html: shell({
      preheader: hasReplay
        ? "Yesterday's session, and the only assignment from it."
        : "The part of yesterday that mattered most.",
      heading: hasReplay ? "Yesterday, in full." : "The part that mattered most.",
      bodyHtml: body,
      baseUrl: ctx.baseUrl,
      logoUrl: ctx.logoUrl,
      unsubscribeUrl: ctx.unsubscribeUrl,
    }),
    text,
  };
}
/**
 * Whether the morning-after letter may go out yet.
 *
 * Three conditions, all required: a real date exists, that date plus the delay
 * has passed, and this person has not already received it. The date check is the
 * important one — sending "yesterday we walked the sequence" before the session
 * has happened would be worse than never sending it at all.
 */
function eventStartedAt(eventDate?: string, eventTime?: string): Date | null {
  if (isPlaceholder(eventDate)) return null;
  const stamp = [eventDate, eventTime].filter(v => v && !isPlaceholder(v)).join(" ");
  const at = new Date(stamp);
  // An unparseable date must never be treated as "in the past".
  return Number.isNaN(at.getTime()) ? null : at;
}
export function isReplayDue(input: {
  eventDate?: string;
  eventTime?: string;
  sentSteps: number[];
  now?: Date;
}): boolean {
  if (input.sentSteps.includes(REPLAY_STEP)) return false;
  const eventAt = eventStartedAt(input.eventDate, input.eventTime);
  if (!eventAt) return false;
  const now = input.now ?? new Date();
  return now.getTime() >= eventAt.getTime() + REPLAY_DELAY_HOURS * 60 * 60 * 1000;
}
/**
 * Which event-anchored letter is due: the replay first, then the post-session arc
 * in order. One per run, and never before the session has happened.
 *
 * The replay letter must go before letters five and six under all circumstances,
 * because those two refer back to a session the reader is assumed to have had a
 * chance to see.
 */
export function selectEventAnchoredStep(input: {
  eventDate?: string;
  eventTime?: string;
  sentSteps: number[];
  now?: Date;
}): SequenceStep | null {
  const eventAt = eventStartedAt(input.eventDate, input.eventTime);
  if (!eventAt) return null;
  if (
    isReplayDue({
      eventDate: input.eventDate,
      eventTime: input.eventTime,
      sentSteps: input.sentSteps,
      now: input.now,
    })
  ) {
    return REPLAY_STEP;
  }
  // The post-session arc only begins once the replay letter has actually gone.
  if (!input.sentSteps.includes(REPLAY_STEP)) return null;
  const now = (input.now ?? new Date()).getTime();
  for (const { step, hoursAfter } of POST_SESSION_SCHEDULE) {
    if (input.sentSteps.includes(step)) continue;
    if (now >= eventAt.getTime() + hoursAfter * 60 * 60 * 1000) return step as SequenceStep;
    // Ordered, so the first not-yet-due step ends the search.
    return null;
  }
  return null;
}
/* ------------------------------------------------------------------ *
 * Which letters are due
 * ------------------------------------------------------------------ */
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Pure scheduling decision, kept separate from sending so it can be tested
 * without a database or a mail provider.
 *
 * Only one letter per person per run: if somebody is imported late and is
 * technically due for all three, sending three at once would read as a machine
 * emptying a queue. They arrive in order, one run at a time.
 */
export function selectDueSteps(input: {
  signedUpAt: Date;
  sentSteps: number[];
  now?: Date;
}): SequenceStep | null {
  const now = input.now ?? new Date();
  const ageDays = (now.getTime() - new Date(input.signedUpAt).getTime()) / DAY_MS;
  for (const { step, day } of SEQUENCE_SCHEDULE) {
    if (input.sentSteps.includes(step)) continue;
    if (ageDays >= day) return step as SequenceStep;
    // Steps are ordered, so the first not-yet-due step ends the search.
    return null;
  }
  return null;
}
export type DispatchSummary = {
  considered: number;
  sent: number;
  failed: number;
  skipped: number;
  paused: boolean;
};
/**
 * Sends whatever is due. Idempotent by construction: each step is claimed in the
 * database before the send, and the unique index means a second concurrent run
 * cannot claim the same step.
 */
export async function runSequenceDispatch(input: {
  baseUrl: string;
  settings: Record<string, string>;
  now?: Date;
  /** Injected in tests. */
  deps?: {
    listCandidates?: typeof listSequenceCandidates;
    listSends?: typeof listSequenceSends;
    claim?: typeof claimSequenceStep;
    finish?: typeof finishSequenceStep;
    release?: typeof releaseSequenceStep;
    send?: typeof sendEmail;
  };
}): Promise<DispatchSummary> {
  const listCandidates = input.deps?.listCandidates ?? listSequenceCandidates;
  const listSends = input.deps?.listSends ?? listSequenceSends;
  const claim = input.deps?.claim ?? claimSequenceStep;
  const finish = input.deps?.finish ?? finishSequenceStep;
  const release = input.deps?.release ?? releaseSequenceStep;
  const send = input.deps?.send ?? sendEmail;
  const paused = input.settings[SEQUENCE_PAUSED_KEY] === "true";
  const summary: DispatchSummary = {
    considered: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    paused,
  };
  if (paused) return summary;
  const [people, sends] = await Promise.all([listCandidates(), listSends()]);
  summary.considered = people.length;
  const sentByEmail = new Map<string, number[]>();
  for (const row of sends) {
    const key = row.email.toLowerCase();
    if (!sentByEmail.has(key)) sentByEmail.set(key, []);
    sentByEmail.get(key)!.push(row.step);
  }
  for (const person of people) {
    // Belt and braces: the query already excludes opt-outs, but this is the one
    // rule that must never be broken by a refactor.
    if (person.unsubscribedAt) {
      summary.skipped += 1;
      continue;
    }
    const step = selectDueSteps({
      signedUpAt: person.createdAt,
      sentSteps: sentByEmail.get(person.email.toLowerCase()) ?? [],
      now: input.now,
    });
    const sentSteps = sentByEmail.get(person.email.toLowerCase()) ?? [];
    // The morning-after letter takes precedence: it is tied to a moment that has
    // just passed, whereas the signup-relative letters are not time-critical and
    // will still be correct on the next run.
    const eventStep = selectEventAnchoredStep({
      eventDate: input.settings.date,
      eventTime: input.settings.time,
      sentSteps,
      now: input.now,
    });
    /*
     * Letter six ends the relationship, and it must end it completely.
     *
     * Without this, somebody who joined shortly before the session could receive
     * "the last letter" and then a cheerful day-2 letter afterwards, because the
     * signup-relative letters are tracked separately. That would make a promise
     * and break it three days later.
     */
    const finished = sentSteps.includes(FINAL_STEP);
    const chosenStep: SequenceStep | null = finished ? null : (eventStep ?? step);
    if (!chosenStep) {
      summary.skipped += 1;
      continue;
    }
    const claimed = await claim(person.email, chosenStep);
    if (!claimed) {
      summary.skipped += 1;
      continue;
    }
    const ctx: SequenceContext = {
      firstName: person.firstName,
      email: person.email,
      baseUrl: input.baseUrl,
      logoUrl: input.baseUrl ? `${input.baseUrl}${LION_MARK_URL}` : undefined,
      unsubscribeUrl: unsubscribeUrl(input.baseUrl, person.email),
      eventDate: input.settings.date,
      eventTime: input.settings.time,
      replayUrl: input.settings.replayUrl,
    };
    const letter = buildSequenceEmail(chosenStep, ctx);
    const result = await send({
      to: { email: person.email, name: `${person.firstName} ${person.lastName}`.trim() },
      subject: letter.subject,
      html: letter.html,
      text: letter.text,
      tags: [`sequence-${chosenStep}`],
      unsubscribeUrl: ctx.unsubscribeUrl,
    });
    if (result.ok) {
      await finish(person.email, chosenStep, "sent", result.messageId);
      summary.sent += 1;
    } else {
      // Release rather than mark failed, so a provider outage does not silently
      // consume somebody's letter. The next run will try again.
      await release(person.email, chosenStep);
      summary.failed += 1;
      console.error(`[Sequence] Step ${chosenStep} failed for ${person.email}: ${result.error}`);
    }
  }
  return summary;
}
/** Referenced so the resource metadata stays imported for future letter edits. */
export const SEQUENCE_RESOURCES = { READINESS_CHECKLIST, MAIL_FROM } as const;
