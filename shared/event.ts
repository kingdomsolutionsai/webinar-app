/**
 * Event detail defaults. These are placeholders on purpose: the owner edits them
 * from the dashboard, and the values are persisted in the `eventSettings` table.
 * Nothing here requires a code change to update.
 */
export const EVENT_SETTING_KEYS = [
  "date",
  "time",
  "duration",
  "price",
  "joinUrl",
  "publicSiteUrl",
  "replayUrl",
] as const;

export type EventSettingKey = (typeof EVENT_SETTING_KEYS)[number];

export const EVENT_DEFAULTS: Record<EventSettingKey, string> = {
  date: "[DATE]",
  time: "[TIME]",
  duration: "[DURATION]",
  price: "[PRICE]",
  joinUrl: "",
  publicSiteUrl: "",
  replayUrl: "",
};
export const EVENT_LABELS: Record<EventSettingKey, string> = {
  date: "Date",
  time: "Time",
  duration: "Duration",
  price: "Investment",
  joinUrl: "Join link",
  publicSiteUrl: "Public web address",
  replayUrl: "Replay link",
};

/** A value is still a placeholder if it is empty or wrapped in square brackets. */
export function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed.length === 0 || (trimmed.startsWith("[") && trimmed.endsWith("]"));
}

/**
 * The page runs in one of two modes, derived from whether a real date has been
 * entered. It is never set by hand, so the mode and the displayed date can
 * never disagree.
 *
 *  - "waitlist"  : no date yet. The page collects interest and delivers the
 *                  free sample chapter immediately. Nothing implies a schedule.
 *  - "scheduled" : a real date exists. The page becomes a registration page.
 */
export type PageMode = "waitlist" | "scheduled";

export function resolveMode(date: string | null | undefined): PageMode {
  return isPlaceholder(date) ? "waitlist" : "scheduled";
}

/**
 * The free sample chapter — Part One of the book, reproduced in full.
 * Delivered on signup in both modes.
 */
export const SAMPLE_CHAPTER = {
  url: "/downloads/Sample_Chapter_Part_One_84e9f7e6.pdf",
  filename: "What-Every-New-Entrepreneur-Needs-to-Know-Part-One.pdf",
  pages: 14,
  title: "Part One — The Big Picture: What Makes a Business Work",
} as const;

/** The second lead magnet: the fillable readiness checklist. */
export const READINESS_CHECKLIST = {
  url: "/downloads/First_Sale_Readiness_Checklist_Fillable_bf43ddb6.pdf",
  filename: "First-Sale-Readiness-Checklist-Fillable.pdf",
  pages: 8,
  fields: 51,
  title: "First-Sale Readiness Checklist",
} as const;

/**
 * The two free resources, offered as a choice. Different readers want different
 * things: one wants to understand, the other wants to act.
 */
export const RESOURCES = [
  {
    id: "chapter",
    label: "Part One of the book",
    meta: `${SAMPLE_CHAPTER.pages} pages · PDF`,
    forWho: "If you want to understand the whole picture first",
    blurb:
      "Six chapters and the Lincoln account: the eight systems every business runs on, why one weak system limits all the others, and the difference between a business and an expensive hobby.",
    download: SAMPLE_CHAPTER,
  },
  {
    id: "checklist",
    label: "First-Sale Readiness Checklist",
    meta: `${READINESS_CHECKLIST.pages} pages · fillable PDF`,
    forWho: "If you would rather start working today",
    blurb:
      "Fourteen conditions to meet before you take money from a client, an eight-system scoring diagnostic to find your constraint, and space to write your one sentence. Type into it and save it.",
    download: READINESS_CHECKLIST,
  },
] as const;

export type ResourceId = (typeof RESOURCES)[number]["id"];

/** What the visitor asked for. "both" is offered after signup, not as a third choice. */
export const RESOURCE_CHOICES = ["chapter", "checklist", "both"] as const;
export type ResourceChoice = (typeof RESOURCE_CHOICES)[number];

/**
 * Sender identity for every outbound email. Kingdom Solutions AI™ mail must always
 * come from this address — never from any other account the Brevo key can access.
 */
export const MAIL_FROM = {
  name: "Kingdom Solutions AI\u2122",
  email: "tabitha@kingdomsolutionsai.com",
} as const;

/** Where the owner's signup notifications are delivered. */
export const MAIL_OWNER = MAIL_FROM.email;

/**
 * Shown on the confirmation panel. Both resources are downloadable there
 * immediately, so the email is reassurance rather than the delivery mechanism.
 */
export const EMAIL_ON_ITS_WAY =
  "A copy is on its way to your inbox, so you will not lose these. If it has not arrived in a few minutes, please check your spam folder.";

/**
 * Brand image paths. These live here rather than in a client-only module because
 * the server needs them to build absolute URLs for email, where root-relative
 * paths cannot resolve.
 */
export const LION_MARK_URL = "/downloads/ksai-lion-mark_77a09ca9.png";
export const BOOK_COVER_URL = "/downloads/book-cover_a62b4665.png";

/**
 * Owner-editable public address of this page, e.g. https://webinar.kingdomsolutionsai.com
 *
 * Email cannot use root-relative paths, so images and download links have to be
 * absolute. Deriving them from the incoming request works, but it silently ties
 * the contents of an email to wherever it happened to be sent from — which is why
 * a message sent from the sandbox shows a broken image. Storing the real address
 * once removes that dependency entirely.
 */
export const PUBLIC_URL_KEY = "publicSiteUrl";

/** Normalizes owner input: trims, adds https:// if missing, drops any trailing slash. */
export function normalizePublicUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}

/**
 * The address email should point at. Prefers the stored public URL, and only
 * falls back to the request origin when the owner has not set one yet.
 */
export function resolveEmailBaseUrl(stored: string | undefined, requestOrigin: string): string {
  const configured = normalizePublicUrl(stored ?? "");
  return configured || requestOrigin;
}

/** Mode-dependent copy, kept in one place so the two modes stay coherent. */

/**
 * The core promise — approved wording. This is the line every reader is meant to
 * recognise themselves in, whichever of the three tracks they belong to.
 */
export const CORE_PROMISE =
  "You are not afraid of hard work — you are afraid of getting it wrong, and this session exists so that the time and money you are about to invest are spent in the right order, the first time.";

/** The short form, used where the long sentence would crowd the layout. */
export const CORE_PROMISE_SHORT =
  "Set it up right on day one, and you never pay twice for the same mistake.";

/**
 * The one-sentence exercise from the close of the session — approved wording.
 * Three parts, and the third is the one that matters most: nobody leaves having
 * failed the exercise.
 */
export const EXERCISE_PROMPT = {
  heading: "Your one-sentence exercise",
  instruction:
    "Write one sentence that names who you serve and the specific problem you solve for them. Not a tagline. Not something for a website. One plain sentence you could say out loud to a stranger.",
  checkLabel: "If you can write it",
  check:
    "Read it back and ask one question: would the person I just described recognize themselves in it? That question has saved founders entire years.",
  reframeLabel: "If you cannot write it yet",
  reframe:
    "That is not a failure — that is your diagnosis. It means the validation conversations in Part II are where your work begins, and knowing that is worth more than anything else you could take from today.",
} as const;

export const MODE_COPY: Record<
  PageMode,
  {
    navCta: string;
    heroCta: string;
    formHeading: string;
    formSubmit: string;
    formSubmitting: string;
    sectionOverline: string;
    sectionHeading: string;
    confirmOverline: string;
  }
> = {
  waitlist: {
    navCta: "Get both free",
    heroCta: "Send me both, free",
    formHeading: "Start with either one",
    formSubmit: "Send me both",
    formSubmitting: "Preparing your files",
    sectionOverline: "Start Reading Today",
    sectionHeading: "The date is not set. The work can start anyway.",
    confirmOverline: "Both are ready",
  },
  scheduled: {
    navCta: "Reserve your seat",
    heroCta: "Reserve your seat",
    formHeading: "Save my seat",
    formSubmit: "Reserve my seat",
    formSubmitting: "Reserving your seat",
    sectionOverline: "Reserve Your Seat",
    sectionHeading: "Join me for this session",
    confirmOverline: "Your seat is reserved",
  },
};

export const THREE_TRACKS = [
  {
    id: "pre_revenue",
    label: "Pre-revenue, still deciding",
    summary:
      "You have expertise and an idea, and you have not yet charged for it. You need the sequence from the beginning.",
    startHere: "Start at Part II — the six steps that produce evidence before expense.",
    accent: "navy",
  },
  {
    id: "serving_clients",
    label: "Already serving clients",
    summary:
      "You have revenue, and you suspect something underneath it was never finished. You need to find the gap.",
    startHere: "Start at Part I — score the eight systems and enter at your first incomplete stage.",
    accent: "gold",
  },
  {
    id: "reorganizing",
    label: "Overwhelmed and reorganizing",
    summary:
      "You are carrying more than the structure can hold. You need capacity restored before anything is added.",
    startHere: "Start at Parts V and VI — command center and weekly scorecard. Nothing else yet.",
    accent: "green",
  },
] as const;

export type TrackId = (typeof THREE_TRACKS)[number]["id"];

/**
 * The Capacity Leak Audit™ invitation — approved wording.
 *
 * Two deliberate constraints, both agreed with Tabitha:
 *
 *  - "Six fields, no login" is literally true. The audit is a form, not an
 *    account, and it answers the real objection — that this is another burden.
 *  - Nothing here claims the audit is free, promises what it will conclude, or
 *    invents urgency. The audience is anxious, depleted leaders; manufactured
 *    pressure would convert a few and cost the trust of the rest.
 *
 * The heading is a question rather than a claim so that a reader who does not
 * have this problem reads one line and moves on without friction.
 */
export const AUDIT_INVITATION = {
  url: "https://www.kingdomsolutionsai.com/capacity-leak-audit",
  heading: "Not sure what to fix first?",
  body: "The Capacity Leak Audit\u2122 shows whether clarity, capacity, follow-up, operations or revenue is the thing holding you back — so your next month goes to the right one. Six fields, no login.",
  cta: "Take the Capacity Leak Audit\u2122",
  /**
   * Softest form, for the postscript of follow-up letter two. Never letter one:
   * the first letter should give without asking for anything in return.
   */
  postscript:
    "If the exercise raised more questions than it answered, that is useful information. The Capacity Leak Audit\u2122 names which one to work on first.",
} as const;
