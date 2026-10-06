import { useAuth } from "@/_core/hooks/useAuth";
import { LionMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  EVENT_LABELS,
  EVENT_SETTING_KEYS,
  isPlaceholder,
  resolveMode,
  RESOURCES,
  THREE_TRACKS,
  type EventSettingKey,
} from "@shared/event";
import {
  ArrowDown,
  ArrowUp,
  BookOpenCheck,
  Check,
  Download,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Send,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type SortKey = "name" | "email" | "createdAt";
type SortDir = "asc" | "desc";

/* ------------------------------------------------------------------ *
 * Gate: signed out, or signed in without the owner role.
 * ------------------------------------------------------------------ */
function Gate({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-md border border-gold/40 bg-white p-10 text-center">
        <LionMark size={64} className="mx-auto" />
        <div className="mx-auto mt-6 flex size-10 items-center justify-center border border-navy">
          <Lock className="size-4 text-navy" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-black text-navy">{title}</h1>
        <div className="mx-auto mt-4 h-[3px] w-12 bg-gold" />
        <p className="mt-5 font-serif text-[16px] leading-relaxed text-ink/70">{body}</p>
        {action ? <div className="mt-8">{action}</div> : null}
        <div className="mt-8 border-t border-border pt-5">
          <Link
            href="/"
            className="font-sans text-[11px] uppercase tracking-[0.18em] text-ink/45 hover:text-navy">
            Return to the registration page
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Event detail editor
 * ------------------------------------------------------------------ */
function EventDetailsEditor() {
  const utils = trpc.useUtils();
  const { data: settings } = trpc.settings.getAll.useQuery();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);

  // Seed the draft once settings arrive; never during render.
  useEffect(() => {
    if (settings && draft === null) {
      const seed: Record<string, string> = {};
      for (const key of EVENT_SETTING_KEYS) seed[key] = settings[key] ?? "";
      setDraft(seed);
    }
  }, [settings, draft]);

  const save = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      utils.settings.getAll.invalidate();
      utils.brevo.status.invalidate();
      toast.success("Event details updated", {
        description: "The registration page now shows your new values.",
      });
    },
    onError: () => toast.error("Could not save. Please try again."),
  });

  if (!draft) {
    return (
      <div className="flex items-center gap-3 border border-border bg-white p-8">
        <Loader2 className="size-4 animate-spin text-gold" />
        <p className="font-sans text-[13px] text-ink/60">Loading event details</p>
      </div>
    );
  }

  return (
    <section className="border border-border bg-white">
      <div className="border-b border-border px-7 py-5">
        <h2 className="font-display text-lg font-bold text-navy">Event details</h2>
        <p className="mt-1.5 font-serif text-[15px] leading-relaxed text-ink/65">
          These appear in the hero and the registration panel. Edit them here &mdash; no code change
          needed. Leave a field in square brackets to keep showing it as a placeholder.
        </p>
      </div>

      {/* Mode indicator — derived from the date field, so it can never disagree
          with what the public page is actually showing. */}
      {(() => {
        const mode = resolveMode(draft.date);
        const waitlist = mode === "waitlist";
        return (
          <div
            className={cn(
              "flex flex-wrap items-start gap-3 border-b border-border px-7 py-5",
              waitlist ? "bg-gold-tint" : "bg-secondary/40",
            )}>
            <span
              className={cn(
                "mt-0.5 border px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.16em]",
                waitlist ? "border-gold text-gold-dark" : "border-green text-green",
              )}>
              {waitlist ? "Waitlist mode" : "Scheduled mode"}
            </span>
            <p className="max-w-2xl font-serif text-[15px] leading-relaxed text-ink/70">
              {waitlist ? (
                <>
                  The page is collecting interest and giving away Part One of the book. It does not
                  mention a seat or a date anywhere. <strong>Enter a real date below</strong> and the
                  page switches to registration automatically &mdash; headline, buttons, and copy all
                  change together.
                </>
              ) : (
                <>
                  The page is in full registration mode, showing your date, time, duration, and
                  investment. Put the date back in square brackets to return to waitlist mode.
                </>
              )}
            </p>
          </div>
        );
      })()}

      <div className="grid gap-5 px-7 py-6 sm:grid-cols-2">
        {EVENT_SETTING_KEYS.map(key => {
          const value = draft[key] ?? "";
          const isUrlField = key === "joinUrl" || key === "publicSiteUrl";
          const pending =
            isPlaceholder(value) && !isUrlField && key !== "zoomPasscode" && key !== "clientStory";
          const help =
            key === "publicSiteUrl"
              ? "The address visitors use, e.g. webinar.kingdomsolutionsai.com. Emails use this for the logo and download links, so set it once you publish."
              : key === "joinUrl"
                ? "Where registrants join the live session. Only sent in the reminder emails; it never appears on the public page."
                : key === "zoomPasscode"
                  ? "Shown in the reminders beside the meeting ID, for anyone whose link does not open."
                  : key === "clientStory"
                    ? "A few sentences about a client's result, in your words. It appears in the Oct 25 Fast Track letter; leave it empty and that letter skips the story. Press \"Set up in Brevo\" after saving."
                    : null;
          return (
            <div key={key} className={isUrlField || key === "clientStory" ? "sm:col-span-2" : undefined}>
              <Label
                htmlFor={`setting-${key}`}
                className="flex items-center gap-2 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
                {EVENT_LABELS[key as EventSettingKey]}
                {pending ? (
                  <span className="border border-gold px-1.5 py-0.5 text-[9px] tracking-[0.12em] text-gold-dark">
                    placeholder
                  </span>
                ) : null}
                {key === "publicSiteUrl" && !value.trim() ? (
                  <span className="border border-navy/30 px-1.5 py-0.5 text-[9px] tracking-[0.12em] text-navy">
                    set after publishing
                  </span>
                ) : null}
              </Label>
              <Input
                id={`setting-${key}`}
                value={value}
                placeholder={isUrlField ? "https://…" : undefined}
                onChange={event => setDraft({ ...draft, [key]: event.target.value })}
                className="mt-2 h-11 rounded-none border-input bg-white font-serif text-[15px] focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30"
              />
              {help ? (
                <p className="mt-2 font-serif text-[13px] leading-relaxed text-ink/55">{help}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 border-t border-border px-7 py-5">
        <Button
          onClick={() => save.mutate({ values: draft as Record<EventSettingKey, string> })}
          disabled={save.isPending}
          className="bg-navy font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-white hover:bg-navy-deep">
          {save.isPending ? (
            <>
              <Loader2 className="mr-2 size-3.5 animate-spin" />
              Saving
            </>
          ) : (
            <>
              <Check className="mr-1.5 size-3.5" />
              Save event details
            </>
          )}
        </Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Brevo: reminders and follow-up letters
 * ------------------------------------------------------------------ */

function StatusLine({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 font-serif text-[15px] leading-relaxed text-ink/75">
      <span
        className={cn(
          "mt-1.5 inline-block size-2 shrink-0 rounded-full",
          ok ? "bg-green" : "bg-gold",
        )}
        aria-hidden="true"
      />
      <span>{children}</span>
    </li>
  );
}

function BrevoPanel() {
  const utils = trpc.useUtils();
  const { data: status } = trpc.brevo.status.useQuery();
  const setup = trpc.brevo.setup.useMutation({
    onSuccess: report => {
      utils.brevo.status.invalidate();
      if (report.ok) toast.success("Brevo is set up", { description: "See the details below." });
      else toast.error("Brevo setup did not finish", { description: report.error });
    },
    onError: () => toast.error("Could not reach the server. Please try again."),
  });
  const tests = trpc.brevo.sendTests.useMutation({
    onSuccess: report => {
      utils.brevo.status.invalidate();
      const failed = report.results.filter(r => !r.ok).length;
      if (failed) toast.error(`${failed} test email(s) did not send`, { description: "See the details below." });
      else toast.success(`${report.results.length} test emails sent to ${report.to}`);
    },
    onError: () => toast.error("Could not send the tests. Please try again."),
  });

  const last = setup.data ?? status?.lastSetup ?? null;
  const lastTest = tests.data ?? status?.lastTest ?? null;

  return (
    <section className="border border-border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-7 py-5">
        <div>
          <h2 className="font-display text-lg font-bold text-navy">Reminders and follow-up in Brevo</h2>
          <p className="mt-1 max-w-2xl font-serif text-[15px] leading-relaxed text-ink/60">
            Brevo sends every reminder and follow-up letter. Press <strong>Set up in Brevo</strong>{" "}
            once now, and again whenever you change the date, the Zoom link, or add a replay link.
            It is safe to press more than once.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => tests.mutate()}
            disabled={tests.isPending || setup.isPending}
            className="border-navy/25 bg-white font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-navy hover:border-navy">
            {tests.isPending ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : <Mail className="mr-1.5 size-3" />}
            Email me test copies
          </Button>
          <Button
            onClick={() => setup.mutate()}
            disabled={setup.isPending || tests.isPending}
            className="bg-navy font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-white hover:bg-navy-deep">
            {setup.isPending ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : <Send className="mr-1.5 size-3" />}
            Set up in Brevo
          </Button>
        </div>
      </div>

      <div className="grid gap-8 px-7 py-6 lg:grid-cols-2">
        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">Ready to schedule?</p>
          <ul className="mt-3 space-y-2">
            <StatusLine ok={Boolean(status?.hasApiKey)}>
              {status?.hasApiKey ? "Brevo key is connected" : "Brevo key is missing on Render"}
            </StatusLine>
            <StatusLine ok={Boolean(status?.event)}>
              {status?.event
                ? `Session: ${status.event.label}`
                : `Cannot read the date and time ("${status?.dateText ?? ""}" / "${status?.timeText ?? ""}")`}
            </StatusLine>
            <StatusLine ok={Boolean(status?.hasJoinUrl)}>
              {status?.hasJoinUrl ? "Zoom join link is saved" : "No Zoom join link saved above"}
            </StatusLine>
            <StatusLine ok={Boolean(status?.hasPasscode)}>
              {status?.hasPasscode ? "Zoom passcode is saved" : "No Zoom passcode saved (optional)"}
            </StatusLine>
          </ul>
        </div>

        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">
            Last setup {last ? `· ${new Date(last.ranAt).toLocaleString()}` : ""}
          </p>
          {!last ? (
            <p className="mt-3 font-serif text-[15px] italic text-ink/50">Not set up yet.</p>
          ) : !last.ok ? (
            <p className="mt-3 font-serif text-[15px] text-red-700">Stopped: {last.error}</p>
          ) : (
            <div className="mt-3 space-y-3 font-serif text-[15px] leading-relaxed text-ink/75">
              <p>
                {last.contacts.synced} registrant{last.contacts.synced === 1 ? "" : "s"} copied to Brevo
                {last.contacts.failed ? `, ${last.contacts.failed} failed` : ""}.
              </p>
              <ul className="space-y-1.5">
                {last.campaigns.map(c => (
                  <li key={c.key} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-navy">{c.label}</span>
                    <span className="text-ink/55">{c.scheduledFor}</span>
                    <span
                      className={cn(
                        "border px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.12em]",
                        c.status === "queued" ? "border-green/40 text-green" : "border-gold text-gold-dark",
                      )}>
                      {c.status === "queued" ? "scheduled" : c.status}
                    </span>
                    {c.note ? <span className="text-[13px] italic text-ink/50">{c.note}</span> : null}
                  </li>
                ))}
              </ul>
              {last.templates.length ? (
                <p className="text-[14px] text-ink/60">
                  Letters 1 to 3 are saved as Brevo templates (IDs {last.templates.map(t => t.id).join(", ")}) for the
                  automation.
                </p>
              ) : null}
              {last.warnings.map(w => (
                <p key={w} className="text-[14px] text-gold-dark">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {lastTest ? (
        <div className="border-t border-border px-7 py-5">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">
            Test copies sent to {lastTest.to} · {new Date(lastTest.ranAt).toLocaleString()}
          </p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {lastTest.results.map(r => (
              <StatusLine key={r.label} ok={r.ok}>
                <span className="font-semibold text-navy">{r.label}</span>{" "}
                <span className="text-[13px] text-ink/55">
                  {r.ok ? (r.via === "brevo" ? "sent by Brevo" : r.detail) : `failed: ${r.detail}`}
                </span>
              </StatusLine>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Follow-up sequence
 * ------------------------------------------------------------------ */

/** Plain-language description of each letter, so the panel explains itself. */
const SEQUENCE_LETTERS: Record<number, { title: string; blurb: string }> = {
  1: {
    title: "The thing I mentioned",
    blurb:
      "Two days after signup. Tells them a live session is coming and that this list hears the date first, and nudges anyone who has not opened the chapter yet.",
  },
  2: {
    title: "The one sentence, revisited",
    blurb:
      "One week in. Brings back the exercise, gives permission to have found it hard, and points to the page at the back of the checklist.",
  },
  3: {
    title: "The announcement",
    blurb:
      "Two weeks in. With a date entered above it invites them to the session. With no date it says so plainly rather than promising something that does not exist yet.",
  },
};

/**
 * The two post-session letters. Kept separate from SEQUENCE_LETTERS because these
 * are timed from the session rather than from each person's signup date.
 */
const POST_SESSION_LETTERS: { step: 5 | 6; title: string; blurb: string }[] = [
  {
    step: 5,
    title: "Agreeing is not the same as starting",
    blurb:
      "Three days after the session. Names the real reason people stall — agreeing with all eight systems but not knowing which one is theirs to touch on Monday — and points to the audit as the way to answer it.",
  },
  {
    step: 6,
    title: "The last letter",
    blurb:
      "One week after the session. Says plainly that it is the last one, withdraws nothing, invents no deadline, and leaves the door open on her timetable rather than a marketing calendar.",
  },
];

function SequencePanel() {
  const { data: status } = trpc.sequence.status.useQuery();
  const [previewing, setPreviewing] = useState<number | null>(null);

  const preview = trpc.sequence.preview.useMutation({
    onMutate: variables => setPreviewing(variables.step),
    onSuccess: result => {
      if (result.ok) toast.success("Preview sent to your inbox");
      else toast.error(result.error ?? "Could not send the preview");
    },
    onError: () => toast.error("Could not send the preview."),
    onSettled: () => setPreviewing(null),
  });

  return (
    <section className="border border-border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-7 py-5">
        <div>
          <h2 className="font-display text-lg font-bold text-navy">Follow-up sequence</h2>
          <p className="mt-1 max-w-2xl font-serif text-[15px] leading-relaxed text-ink/60">
            Six letters, now sent by Brevo. The first three go out 2, 7 and 14 days after each
            person confirms, through the Brevo automation. The last three are scheduled for set
            times after the session. Sent counts and opens are in Brevo. Preview sends any letter
            to your own inbox.
          </p>
        </div>
      </div>


      <div className="divide-y divide-border">
        {[1, 2, 3].map(step => {
          const info = SEQUENCE_LETTERS[step];
          const stat = status?.steps.find(entry => entry.step === step);
          return (
            <div key={step} className="flex flex-wrap items-start gap-5 px-7 py-5">
              <div className="flex size-9 shrink-0 items-center justify-center border border-navy/25 bg-secondary/50 font-display text-[15px] font-bold text-navy">
                {step}
              </div>
              <div className="min-w-[260px] flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-display text-[16px] font-bold text-navy">{info.title}</p>
                  <span className="border border-navy/20 px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-ink/55">
                    Day {stat?.day ?? "—"}
                  </span>
                </div>
                <p className="mt-2 font-serif text-[15px] leading-relaxed text-ink/65">
                  {info.blurb}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => preview.mutate({ step: step as 1 | 2 | 3 })}
                  disabled={preview.isPending && previewing === step}
                  title="Send this letter to your own inbox first"
                  className="inline-flex items-center gap-1.5 border border-navy/20 px-3 py-2 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-navy transition-colors hover:border-navy hover:bg-navy hover:text-white disabled:opacity-50">
                  {preview.isPending && previewing === step ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Mail className="size-3" />
                  )}
                  Preview
                </button>
              </div>
            </div>
          );
        })}

        {/*
          The morning-after letter, set apart because it is anchored to the
          session rather than to each person's signup date. A "Day N" badge would
          be meaningless for it, so it carries its own status instead.
        */}
        <div className="flex flex-wrap items-start gap-5 bg-secondary/25 px-7 py-5">
          <div className="flex size-9 shrink-0 items-center justify-center border border-gold bg-gold-tint font-display text-[15px] font-bold text-gold-dark">
            4
          </div>
          <div className="min-w-[260px] flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-display text-[16px] font-bold text-navy">
                The morning after
              </p>
              <span className="border border-gold/50 px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-gold-dark">
                After the session
              </span>
              {status?.replay?.armed ? (
                status.replay.hasReplayUrl ? (
                  <span className="border border-green/40 px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-green">
                    Replay link set
                  </span>
                ) : (
                  <span className="border border-navy/20 px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-ink/55">
                    No replay link
                  </span>
                )
              ) : (
                <span className="border border-navy/20 px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-ink/45">
                  Waiting for a date
                </span>
              )}
            </div>
            <p className="mt-2 font-serif text-[15px] leading-relaxed text-ink/65">
              Goes out the morning after the session, to everyone on the list — attendance is
              never complete, and this is the letter that recovers the people who meant to be
              there. Add a replay link above and it offers the recording; leave it empty and the
              letter says nothing about a recording at all rather than promising one.
            </p>
            {!status?.replay?.armed ? (
              <p className="mt-2 font-serif text-[14px] italic leading-relaxed text-ink/45">
                It cannot send until a real date is entered above, so it can never tell anyone
                the session happened yesterday when it has not happened at all.
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => preview.mutate({ step: 4 })}
              disabled={preview.isPending && previewing === 4}
              title="Send this letter to your own inbox first"
              className="inline-flex items-center gap-1.5 border border-navy/20 px-3 py-2 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-navy transition-colors hover:border-navy hover:bg-navy hover:text-white disabled:opacity-50">
              {preview.isPending && previewing === 4 ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Mail className="size-3" />
              )}
              Preview
            </button>
          </div>
        </div>

        {/* The post-session arc: same event anchor, sent in order after the replay. */}
        {POST_SESSION_LETTERS.map(letter => {
          const stat = status?.postSession?.find(entry => entry.step === letter.step);
          return (
            <div
              key={letter.step}
              className="flex flex-wrap items-start gap-5 bg-secondary/25 px-7 py-5">
              <div className="flex size-9 shrink-0 items-center justify-center border border-gold bg-gold-tint font-display text-[15px] font-bold text-gold-dark">
                {letter.step}
              </div>
              <div className="min-w-[260px] flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-display text-[16px] font-bold text-navy">{letter.title}</p>
                  <span className="border border-gold/50 px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-gold-dark">
                    {stat ? `${stat.days} days after` : "After the session"}
                  </span>
                  {letter.step === 6 ? (
                    <span className="border border-navy/30 px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-navy">
                      Final letter
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 font-serif text-[15px] leading-relaxed text-ink/65">
                  {letter.blurb}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => preview.mutate({ step: letter.step })}
                  disabled={preview.isPending && previewing === letter.step}
                  title="Send this letter to your own inbox first"
                  className="inline-flex items-center gap-1.5 border border-navy/20 px-3 py-2 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-navy transition-colors hover:border-navy hover:bg-navy hover:text-white disabled:opacity-50">
                  {preview.isPending && previewing === letter.step ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Mail className="size-3" />
                  )}
                  Preview
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border bg-white px-7 py-4">
        <p className="font-serif text-[14px] leading-relaxed text-ink/55">
          Letter six is deliberately the last one. Nobody on this list receives mail from the
          sequence after it — no indefinite nurture, no re-runs. If you want to write to them
          again, that is a decision you make rather than something that happens automatically.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */
export default function Dashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  /** Which row's resend is in flight, so only that button shows a spinner. */
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);

  const isOwner = isAuthenticated && user?.role === "admin";

  const { data: rows, isLoading } = trpc.registration.list.useQuery(undefined, {
    enabled: Boolean(isOwner),
  });

  const { data: downloads } = trpc.registration.downloads.useQuery(undefined, {
    enabled: Boolean(isOwner),
  });

  /** Download activity keyed by address, for the Opened column. */
  const openedByEmail = useMemo(() => {
    const map = new Map<string, { resources: string[]; count: number; lastAt: Date }>();
    for (const entry of downloads ?? []) {
      map.set(entry.email.toLowerCase(), {
        resources: entry.resources,
        count: entry.count,
        lastAt: entry.lastAt,
      });
    }
    return map;
  }, [downloads]);

  const exportCsv = trpc.useUtils().registration.exportCsv;
  const exportPipeline = trpc.useUtils().registration.exportPipelineCsv;
  const utils = trpc.useUtils();

  const resend = trpc.registration.resend.useMutation({
    onMutate: variables => {
      setResendingEmail(variables.email);
    },
    onSuccess: result => {
      if (result.ok) {
        toast.success("Email sent again");
        utils.registration.list.invalidate();
      } else {
        toast.error(result.error ?? "Could not resend");
      }
    },
    onError: () => toast.error("Could not resend. Please try again."),
    onSettled: () => setResendingEmail(null),
  });

  /** Which row's attendance toggle is in flight, so only that button spins. */
  const [attendingEmail, setAttendingEmail] = useState<string | null>(null);

  const markAttended = trpc.registration.markAttended.useMutation({
    onMutate: variables => setAttendingEmail(variables.email),
    onSuccess: result => {
      if (result.ok) {
        toast.success(
          result.alreadyAttended ? "Already marked attended" : "Marked attended — checklist sent",
        );
        utils.registration.list.invalidate();
      } else {
        toast.error(result.error ?? "Could not mark attended");
      }
    },
    onError: () => toast.error("Could not mark attended. Please try again."),
    onSettled: () => setAttendingEmail(null),
  });

  const unmarkAttended = trpc.registration.unmarkAttended.useMutation({
    onMutate: variables => setAttendingEmail(variables.email),
    onSuccess: result => {
      if (result.ok) {
        toast.success("Attendance cleared");
        utils.registration.list.invalidate();
      } else {
        toast.error(result.error ?? "Could not clear attendance");
      }
    },
    onError: () => toast.error("Could not clear attendance. Please try again."),
    onSettled: () => setAttendingEmail(null),
  });

  const sorted = useMemo(() => {
    if (!rows) return [];
    const copy = [...rows];
    copy.sort((a, b) => {
      let result = 0;
      if (sortKey === "name") {
        result = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      } else if (sortKey === "email") {
        result = a.email.localeCompare(b.email);
      } else {
        result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDir === "asc" ? result : -result;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  };

  const handleExport = async () => {
    try {
      const result = await exportCsv.fetch();
      // Prepend a BOM so Excel opens UTF-8 names correctly.
      const blob = new Blob(["\uFEFF" + result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.count} registration${result.count === 1 ? "" : "s"}`);
    } catch {
      toast.error("Could not build the export. Please try again.");
    }
  };

  /**
   * Second export shaped for the Lead Qualifier pipeline, so an audience can be
   * imported without retyping. Deliberately leaves Fit Score, Deal Size and
   * Industry empty — those are the qualifier's own judgements to make.
   */
  const handlePipelineExport = async () => {
    try {
      const result = await exportPipeline.fetch();
      const blob = new Blob(["\uFEFF" + result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(
        `Pipeline file ready — ${result.count} lead${result.count === 1 ? "" : "s"}`,
      );
    } catch {
      toast.error("Could not build the pipeline export. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <Loader2 className="size-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Gate
        title="Owner access only"
        body="This dashboard holds registrant details, so it is kept behind a sign-in. Please sign in to continue."
        action={
          <Button
            onClick={() => startLogin()}
            size="lg"
            className="w-full bg-navy font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-white hover:bg-navy-deep">
            Sign in
          </Button>
        }
      />
    );
  }

  if (!isOwner) {
    return (
      <Gate
        title="Not authorized"
        body="This account does not have owner access to the registration dashboard. If this is your site, sign in with the account that owns it."
        action={
          <Button
            variant="outline"
            onClick={() => logout()}
            className="w-full border-navy font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-navy">
            <LogOut className="mr-1.5 size-3.5" />
            Sign out
          </Button>
        }
      />
    );
  }

  const trackLabel = (id: string | null) =>
    THREE_TRACKS.find(track => track.id === id)?.label ?? "—";

  /** How many registrants have opened at least one resource. */
  const openedCount = sorted.filter(row => openedByEmail.has(row.email.toLowerCase())).length;

  /** How many registrants have been marked attended — what unlocks the checklist. */
  const attendedCount = sorted.filter(row => Boolean(row.attendedAt)).length;

  /** Short label for the resource column; "both" is possible via a repeat signup. */
  const resourceLabel = (id: string) =>
    id === "both" ? "Both" : (RESOURCES.find(item => item.id === id)?.label ?? id);

  const SortButton = ({ label, column }: { label: string; column: SortKey }) => (
    <button
      type="button"
      onClick={() => handleSort(column)}
      className="flex items-center gap-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-white/75 transition-colors hover:text-gold">
      {label}
      {sortKey === column ? (
        sortDir === "asc" ? (
          <ArrowUp className="size-3 text-gold" />
        ) : (
          <ArrowDown className="size-3 text-gold" />
        )
      ) : (
        <span className="size-3" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Header */}
      <header className="border-b border-gold/25 bg-ink">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-4">
            <LionMark size={42} />
            <div>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">
                Kingdom Solutions AI&trade;
              </p>
              <p className="mt-0.5 font-display text-lg font-bold text-white">
                Registration dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-sans text-[10px] uppercase tracking-[0.18em] text-white/55 hover:text-gold">
              View page
            </Link>
            <Button
              variant="outline"
              onClick={() => logout()}
              className="border-white/25 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80 hover:border-gold hover:text-gold">
              <LogOut className="mr-1.5 size-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container space-y-8 py-10">
        {/* Summary */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="border border-border bg-white px-7 py-6">
            <div className="flex items-center gap-2">
              <Users className="size-3.5 text-gold" />
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">
                Total registrations
              </p>
            </div>
            <p className="mt-3 font-display text-4xl font-black text-navy">
              {isLoading ? "—" : sorted.length}
            </p>
          </div>

          {/* The number worth watching: signing up is interest, opening is intent. */}
          <div className="border border-gold/50 bg-gold-tint px-7 py-6">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="size-3.5 text-gold-dark" />
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">
                Opened a resource
              </p>
            </div>
            <p className="mt-3 font-display text-4xl font-black text-gold-dark">
              {isLoading ? "—" : openedCount}
            </p>
            <p className="mt-1.5 font-serif text-[14px] text-ink/55">
              {sorted.length > 0
                ? `${Math.round((openedCount / sorted.length) * 100)}% of signups`
                : "No signups yet"}
            </p>
          </div>

          {/* Attendance is what unlocks the checklist reward — worth its own card. */}
          <div className="border border-green/40 bg-green/5 px-7 py-6">
            <div className="flex items-center gap-2">
              <UserCheck className="size-3.5 text-green" />
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">
                Attended live
              </p>
            </div>
            <p className="mt-3 font-display text-4xl font-black text-green">
              {isLoading ? "—" : attendedCount}
            </p>
            <p className="mt-1.5 font-serif text-[14px] text-ink/55">
              Mark this from the table below
            </p>
          </div>

          {THREE_TRACKS.slice(0, 2).map((track, index) => {
            const count = sorted.filter(row => row.track === track.id).length;
            return (
              <div key={track.id} className="border border-border bg-white px-7 py-6">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">
                  {track.label}
                </p>
                <p
                  className={cn(
                    "mt-3 font-display text-4xl font-black",
                    index === 0 ? "text-gold-dark" : "text-green",
                  )}>
                  {isLoading ? "—" : count}
                </p>
              </div>
            );
          })}
        </div>

        <EventDetailsEditor />

        <BrevoPanel />
        <SequencePanel />

        {/* Registrations table */}
        <section className="border border-border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-7 py-5">
            <div>
              <h2 className="font-display text-lg font-bold text-navy">Registrations</h2>
              <p className="mt-1 font-serif text-[15px] text-ink/60">
                Click any column heading to sort.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handlePipelineExport}
                disabled={sorted.length === 0}
                variant="outline"
                className="border-navy bg-white font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-navy hover:bg-navy hover:text-white">
                <Download className="mr-1.5 size-3.5" />
                For the pipeline
              </Button>
              <Button
                onClick={handleExport}
                disabled={sorted.length === 0}
                className="bg-gold font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-ink hover:bg-gold-light">
                <Download className="mr-1.5 size-3.5" />
                Export CSV
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-3 px-7 py-14">
              <Loader2 className="size-4 animate-spin text-gold" />
              <p className="font-sans text-[13px] text-ink/60">Loading registrations</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="px-7 py-16 text-center">
              <LionMark size={52} className="mx-auto opacity-40" />
              <p className="mt-5 font-display text-lg font-bold text-navy">No signups yet</p>
              <p className="mx-auto mt-2 max-w-sm font-serif text-[16px] leading-relaxed text-ink/60">
                Signups will appear here the moment someone joins, with the date and time of
                submission. Every entry is captured whether the page is in waitlist or scheduled
                mode.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="bg-navy">
                    <th className="px-5 py-3.5 text-left">
                      <SortButton label="Name" column="name" />
                    </th>
                    <th className="px-5 py-3.5 text-left">
                      <SortButton label="Email" column="email" />
                    </th>
                    <th className="px-5 py-3.5 text-left">
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
                        Starting point
                      </span>
                    </th>
                    <th className="px-5 py-3.5 text-left">
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
                        Wanted first
                      </span>
                    </th>
                    <th className="px-5 py-3.5 text-left">
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
                        Opened
                      </span>
                    </th>
                    <th className="px-5 py-3.5 text-left">
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
                        Delivery
                      </span>
                    </th>
                    <th className="px-5 py-3.5 text-left">
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
                        Attended
                      </span>
                    </th>
                    <th className="px-5 py-3.5 text-left">
                      <SortButton label="Registered" column="createdAt" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border last:border-0",
                        index % 2 === 1 && "bg-secondary/40",
                      )}>
                      <td className="px-5 py-4 font-sans text-[14px] font-semibold text-navy">
                        {row.firstName} {row.lastName}
                      </td>
                      <td className="px-5 py-4 font-serif text-[15px] text-ink/80">{row.email}</td>
                      <td className="px-5 py-4 font-serif text-[15px] text-ink/65">
                        {trackLabel(row.track)}
                      </td>
                      <td className="px-5 py-4">
                        {row.resource ? (
                          <span
                            className={cn(
                              "whitespace-nowrap border px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.14em]",
                              row.resource === "checklist"
                                ? "border-green/45 bg-green/10 text-green"
                                : "border-navy/25 bg-navy/5 text-navy",
                            )}>
                            {resourceLabel(row.resource)}
                          </span>
                        ) : (
                          <span className="font-serif text-[15px] text-ink/40">&mdash;</span>
                        )}
                      </td>

                      {/* Opened: the difference between a name and a reader. */}
                      <td className="px-5 py-4">
                        {(() => {
                          const activity = openedByEmail.get(row.email.toLowerCase());
                          if (!activity) {
                            return (
                              <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/35">
                                Not yet
                              </span>
                            );
                          }
                          return (
                            <span
                              title={`Last opened ${new Date(activity.lastAt).toLocaleString()} · ${activity.count} open${activity.count === 1 ? "" : "s"}`}
                              className="inline-flex flex-wrap gap-1">
                              {activity.resources.map(resource => (
                                <span
                                  key={resource}
                                  className="whitespace-nowrap border border-gold/50 bg-gold-tint px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-gold-dark">
                                  {resource === "checklist" ? "Checklist" : "Chapter"}
                                </span>
                              ))}
                            </span>
                          );
                        })()}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {row.unsubscribedAt ? (
                            <span
                              title={`Opted out ${new Date(row.unsubscribedAt).toLocaleString()}`}
                              className="whitespace-nowrap border border-ink/25 bg-ink/5 px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-ink/60">
                              Opted out
                            </span>
                          ) : row.emailStatus === "sent" ? (
                            <span className="whitespace-nowrap border border-green/45 bg-green/10 px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-green">
                              Delivered
                            </span>
                          ) : row.emailStatus === "failed" ? (
                            <span
                              title={row.emailDetail ?? undefined}
                              className="whitespace-nowrap border border-destructive/45 bg-destructive/10 px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-destructive">
                              Failed
                            </span>
                          ) : (
                            <span className="font-serif text-[15px] text-ink/40">&mdash;</span>
                          )}

                          {/* Resend is offered for anyone still subscribed, not only failures:
                              people lose emails, and re-sending is harmless. */}
                          {!row.unsubscribedAt ? (
                            <button
                              type="button"
                              onClick={() => resend.mutate({ email: row.email })}
                              disabled={resend.isPending && resendingEmail === row.email}
                              title="Send the resources email again"
                              className="inline-flex items-center gap-1 border border-navy/20 px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-navy transition-colors hover:border-navy hover:bg-navy hover:text-white disabled:opacity-50">
                              {resend.isPending && resendingEmail === row.email ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Send className="size-3" />
                              )}
                              Resend
                            </button>
                          ) : null}
                        </div>
                      </td>

                      {/* Attended: the single action that unlocks the checklist reward.
                          Toggling on fires the reward email the first time only; toggling
                          off just corrects a mis-click and never recalls a sent email. */}
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            row.attendedAt
                              ? unmarkAttended.mutate({ email: row.email })
                              : markAttended.mutate({ email: row.email })
                          }
                          disabled={attendingEmail === row.email}
                          title={
                            row.attendedAt
                              ? `Attended — click to undo (does not recall the checklist email)`
                              : "Mark attended — sends the checklist"
                          }
                          className={cn(
                            "inline-flex items-center gap-1.5 whitespace-nowrap border px-2.5 py-1.5 font-sans text-[9px] font-bold uppercase tracking-[0.14em] transition-colors disabled:opacity-50",
                            row.attendedAt
                              ? "border-green/50 bg-green/10 text-green hover:border-green hover:bg-green hover:text-white"
                              : "border-navy/25 text-navy hover:border-navy hover:bg-navy hover:text-white",
                          )}>
                          {attendingEmail === row.email ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : row.attendedAt ? (
                            <UserCheck className="size-3" />
                          ) : null}
                          {row.attendedAt ? "Attended" : "Mark attended"}
                        </button>
                      </td>
                      <td className="px-5 py-4 font-serif text-[15px] text-ink/65">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
