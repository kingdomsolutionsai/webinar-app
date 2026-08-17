/**
 * Export registrants in the column shape of Tabitha's Lead Qualifier pipeline,
 * so a webinar audience can be imported without retyping.
 *
 * Deliberate restraint: this file only ever emits facts the registrant supplied
 * or actions they actually took. Deal Size, Industry and Fit Score are left
 * blank. Fit Score especially — that is the qualifier's own computed judgement,
 * and pre-filling a guess upstream would corrupt the one number Tabitha relies
 * on to decide who to talk to.
 */

/** Column order matches the pipeline table exactly, so import needs no mapping. */
export const PIPELINE_HEADERS = [
  "Name",
  "Email",
  "Stage",
  "Source",
  "Industry",
  "Deal Size",
  "Next Follow-Up",
  "Last Contact",
  "Notes",
  "Fit Score",
] as const;

/** How each signup described themselves, in words rather than internal codes. */
const TRACK_WORDS: Record<string, string> = {
  pre_revenue: "Pre-revenue — starting from scratch",
  serving_clients: "Already serving clients — wants the correct order",
  reorganizing: "Operating but overwhelmed — needs to reorganise",
};

const RESOURCE_WORDS: Record<string, string> = {
  chapter: "sample chapter",
  checklist: "readiness checklist",
  both: "sample chapter and readiness checklist",
};

export type PipelineRow = {
  firstName: string;
  lastName: string;
  email: string;
  track: string | null;
  resource: string | null;
  createdAt: Date | string;
  /** Resources actually opened, from the download ledger. */
  opened?: string[];
  unsubscribedAt?: Date | string | null;
};

const csvEscape = (value: string) => {
  // A leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
  // Prefixing an apostrophe keeps names like "-Smith" from executing.
  const cleaned = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${cleaned.replace(/"/g, '""')}"`;
};

const isoDate = (value: Date | string) => new Date(value).toISOString().slice(0, 10);

/**
 * Stage reflects observed behaviour only.
 *
 * Someone who opened a resource has done something; someone who only left an
 * address has not. Neither is "Qualified" — that word belongs to the qualifier
 * after Tabitha has actually spoken to them, and claiming it here would put
 * unearned confidence into her pipeline.
 */
export function deriveStage(row: PipelineRow): string {
  if (row.unsubscribedAt) return "Unsubscribed";
  return row.opened && row.opened.length > 0 ? "Engaged" : "New lead";
}

/** Notes are assembled from facts, never from inference about intent. */
export function buildNotes(row: PipelineRow): string {
  const parts: string[] = [];
  if (row.track && TRACK_WORDS[row.track]) parts.push(TRACK_WORDS[row.track]);
  if (row.resource && RESOURCE_WORDS[row.resource]) {
    parts.push(`Asked for the ${RESOURCE_WORDS[row.resource]}`);
  }
  if (row.opened && row.opened.length > 0) {
    const names = row.opened.map(r => RESOURCE_WORDS[r] ?? r).join(" and ");
    parts.push(`Opened the ${names}`);
  } else {
    parts.push("Has not opened a resource yet");
  }
  parts.push("Source: webinar registration page");
  return parts.join(". ") + ".";
}

export function toPipelineCsv(rows: PipelineRow[]): string {
  const body = rows.map(row =>
    [
      csvEscape(`${row.firstName} ${row.lastName}`.trim()),
      csvEscape(row.email),
      csvEscape(deriveStage(row)),
      csvEscape("Webinar registration — What Every New Entrepreneur Needs to Know"),
      csvEscape(""), // Industry: not collected. Blank beats a guess.
      csvEscape(""), // Deal Size: unknowable at signup.
      csvEscape(""), // Next Follow-Up: Tabitha's decision, not ours.
      csvEscape(isoDate(row.createdAt)), // Last Contact: the signup itself.
      csvEscape(buildNotes(row)),
      csvEscape(""), // Fit Score: the qualifier computes this. Never pre-fill.
    ].join(","),
  );
  return [PIPELINE_HEADERS.map(csvEscape).join(","), ...body].join("\r\n");
}
