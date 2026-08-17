import { LionMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AUDIT_INVITATION,
  EXERCISE_PROMPT,
  EMAIL_ON_ITS_WAY,
  MODE_COPY,
  READINESS_CHECKLIST,
  RESOURCES,
  SAMPLE_CHAPTER,
  THREE_TRACKS,
  type PageMode,
  type ResourceChoice,
  type ResourceId,
  type TrackId,
} from "@shared/event";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Check,
  ClipboardCheck,
  Download,
  Loader2,
  Mail,
} from "lucide-react";
import { useState } from "react";

type Errors = Partial<Record<"firstName" | "lastName" | "email", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(values: { firstName: string; lastName: string; email: string }): Errors {
  const errors: Errors = {};
  if (!values.firstName.trim()) errors.firstName = "Please enter your first name";
  if (!values.lastName.trim()) errors.lastName = "Please enter your last name";
  const email = values.email.trim();
  if (!email) errors.email = "Please enter your email address";
  else if (!EMAIL_RE.test(email)) errors.email = "Please enter a valid email address";
  return errors;
}

/**
 * Both downloads, with the one the visitor asked for shown first. Everyone gets
 * both — the choice only decides emphasis and tells Tabitha what they wanted.
 */
function ResourceDownloads({
  mode,
  chose,
  links,
}: {
  mode: PageMode;
  chose: ResourceId;
  /**
   * Counted links returned by the signup call. Falling back to the raw file URL
   * means a tracking problem costs a statistic, never a download.
   */
  links?: { chapter: string; checklist: string };
}) {
  const primary = chose === "checklist" ? READINESS_CHECKLIST : SAMPLE_CHAPTER;
  const secondary = chose === "checklist" ? SAMPLE_CHAPTER : READINESS_CHECKLIST;
  const primaryIsChecklist = chose === "checklist";
  const primaryHref = primaryIsChecklist
    ? links?.checklist ?? primary.url
    : links?.chapter ?? primary.url;
  const secondaryHref = primaryIsChecklist
    ? links?.chapter ?? secondary.url
    : links?.checklist ?? secondary.url;

  return (
    <div className="mt-7 space-y-3">
      {/* What they asked for, given prominence. */}
      <div className="border border-gold bg-gold-tint p-6">
        <div className="flex items-start gap-3">
          {primaryIsChecklist ? (
            <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-gold-dark" />
          ) : (
            <BookOpen className="mt-0.5 size-4 shrink-0 text-gold-dark" />
          )}
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-dark">
              {mode === "waitlist" ? "Ready now" : "While you wait"}
            </p>
            <p className="mt-2 font-display text-lg font-bold leading-tight text-navy">
              {primary.title}
            </p>
            <p className="mt-2 font-serif text-[16px] leading-relaxed text-ink/75">
              {primaryIsChecklist
                ? `${READINESS_CHECKLIST.pages} pages with ${READINESS_CHECKLIST.fields} fillable fields. Type your answers straight into it and save the file — nothing to print.`
                : `${SAMPLE_CHAPTER.pages} pages, reproduced in full from the book. Six chapters and one documented founder account. Nothing has been shortened or held back.`}
            </p>
          </div>
        </div>
        <Button
          asChild
          className="mt-5 w-full bg-ink font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-gold hover:bg-ink/90">
          <a href={primaryHref} download={primary.filename}>
            <Download className="mr-1.5 size-3.5" />
            Download {primaryIsChecklist ? "the checklist" : "Part One"}
          </a>
        </Button>
      </div>

      {/* The other one, offered plainly rather than upsold. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-secondary/40 px-5 py-4">
        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">
            Also yours, at no cost
          </p>
          <p className="mt-1 font-display text-[15px] font-bold text-navy">{secondary.title}</p>
        </div>
        <Button
          asChild
          variant="outline"
          className="border-navy/30 bg-white font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-navy hover:border-gold">
          <a href={secondaryHref} download={secondary.filename}>
            <Download className="mr-1.5 size-3" />
            Download
          </a>
        </Button>
      </div>
    </div>
  );
}

export function RegistrationForm({
  track,
  mode,
}: {
  track: TrackId | null;
  mode: PageMode;
}) {
  const copy = MODE_COPY[mode];
  const [values, setValues] = useState({ firstName: "", lastName: "", email: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [confirmedName, setConfirmedName] = useState<string | null>(null);
  const [resource, setResource] = useState<ResourceId>("chapter");
  const [downloadLinks, setDownloadLinks] = useState<
    { chapter: string; checklist: string } | undefined
  >(undefined);

  const register = trpc.registration.create.useMutation({
    onSuccess: data => {
      setConfirmedName(data.firstName);
      setDownloadLinks(data.downloads);
    },
  });

  const setField = (field: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...values, [field]: event.target.value };
    setValues(next);
    // Re-validate a field only after it has been touched, so errors do not
    // appear while someone is still typing their first character.
    if (touched[field]) setErrors(validate(next));
  };

  const blurField = (field: keyof typeof values) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setErrors(validate(values));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    setTouched({ firstName: true, lastName: true, email: true });
    if (Object.keys(found).length > 0) return;

    register.mutate({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      track: track ?? undefined,
      resource: resource as ResourceChoice,
    });
  };

  /* -------------------- Confirmation -------------------- */
  if (confirmedName) {
    const chosen = THREE_TRACKS.find(item => item.id === track);
    return (
      <div className="border border-gold bg-white p-8 sm:p-10">
        <div className="flex items-center gap-4">
          <LionMark size={48} />
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">
              {copy.confirmOverline}
            </p>
            <h3 className="mt-1 font-display text-2xl font-black text-navy">
              Thank you, {confirmedName}.
            </h3>
          </div>
        </div>

        <div className="mt-7 h-[3px] w-14 bg-gold" />

        <p className="mt-7 font-serif text-[17px] leading-relaxed text-ink/80">
          {mode === "waitlist"
            ? "You are on the list. When the session is scheduled you will be the first to know — and your chapter is ready to read right now."
            : "You are registered. Watch for details at the email address you provided."}
        </p>

        <p className="mt-3 flex items-start gap-2 font-serif text-[15px] leading-relaxed text-ink/60">
          <Mail className="mt-1 size-3.5 shrink-0 text-gold" />
          {EMAIL_ON_ITS_WAY}
        </p>

        <ResourceDownloads mode={mode} chose={resource} links={downloadLinks} />

        {/* The one-sentence exercise from the close of the session. */}
        <div className="mt-7 border border-navy/25 bg-secondary/50 p-6">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-navy">
            {EXERCISE_PROMPT.heading}
          </p>
          <p className="mt-3 font-serif text-[17px] leading-relaxed text-ink/85">
            {EXERCISE_PROMPT.instruction}
          </p>

          <div className="mt-5 space-y-4 border-t border-navy/15 pt-5">
            <div>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-green">
                {EXERCISE_PROMPT.checkLabel}
              </p>
              <p className="mt-1.5 font-serif text-[16px] leading-relaxed text-ink/75">
                {EXERCISE_PROMPT.check}
              </p>
            </div>
            <div>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-dark">
                {EXERCISE_PROMPT.reframeLabel}
              </p>
              <p className="mt-1.5 font-serif text-[16px] leading-relaxed text-ink/75">
                {EXERCISE_PROMPT.reframe}
              </p>
            </div>
          </div>
        </div>

        {chosen ? (
          <div className="mt-7 border-l-2 border-navy pl-5">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/45">
              Your starting point
            </p>
            <p className="mt-1.5 font-display text-lg font-bold text-navy">{chosen.label}</p>
            <p className="mt-2 font-serif text-[16px] leading-relaxed text-ink/75">
              {chosen.startHere}
            </p>
          </div>
        ) : null}

        {/*
          The Capacity Leak Audit™ invitation. Deliberately quieter than
          everything above it — a hairline rule rather than a filled panel —
          because the two free resources are the promise of this screen and must
          remain its point. The heading is a question, so a reader who does not
          have this problem reads one line and moves on without friction.
        */}
        <div className="mt-8 border-t border-border pt-6">
          <p className="font-display text-[17px] font-bold text-navy">
            {AUDIT_INVITATION.heading}
          </p>
          <p className="mt-2 font-serif text-[16px] leading-relaxed text-ink/70">
            {AUDIT_INVITATION.body}
          </p>
          <a
            href={AUDIT_INVITATION.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 border border-navy px-5 py-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-navy transition-colors duration-200 hover:bg-navy hover:text-white">
            {AUDIT_INVITATION.cta}
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>

        <p className="mt-8 font-serif text-[15px] italic text-ink/55">
          Lead well. &mdash; Tabitha Rector, Founder Kingdom Solutions AI&trade;
        </p>
      </div>
    );
  }

  /* -------------------- Form -------------------- */
  const fields = [
    { id: "firstName" as const, label: "First name", autoComplete: "given-name", type: "text" },
    { id: "lastName" as const, label: "Last name", autoComplete: "family-name", type: "text" },
    { id: "email" as const, label: "Email address", autoComplete: "email", type: "email" },
  ];

  return (
    <div className="border border-gold/50 bg-white p-8 sm:p-10">
      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-dark">
        {mode === "waitlist" ? "Two Free Resources" : "Registration"}
      </p>
      <h3 className="mt-2 font-display text-2xl font-black text-navy">{copy.formHeading}</h3>
      <div className="mt-5 h-[3px] w-14 bg-gold" />

      {mode === "waitlist" ? (
        <p className="mt-6 font-serif text-[16px] leading-relaxed text-ink/70">
          Both arrive immediately, at no cost. Tell me which one you want first &mdash; you will
          receive the other as well. You will also be first to know when the live session is
          scheduled.
        </p>
      ) : null}

      {/* Which resource matters more to them. Everyone receives both; this tells
          Tabitha what each person actually came for. */}
      <fieldset className="mt-7">
        <legend className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
          Which would you like first?
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {RESOURCES.map(item => {
            const active = resource === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setResource(item.id)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col border p-4 text-left transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2",
                  active
                    ? "border-gold bg-gold-tint"
                    : "border-border bg-white hover:border-gold/60",
                )}>
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={cn(
                      "font-display text-[15px] font-bold leading-tight",
                      active ? "text-navy" : "text-ink/80",
                    )}>
                    {item.label}
                  </p>
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center border",
                      active ? "border-gold bg-gold" : "border-input",
                    )}>
                    {active ? <Check className="size-2.5 text-ink" strokeWidth={3.5} /> : null}
                  </span>
                </div>
                <p className="mt-1.5 font-sans text-[9.5px] uppercase tracking-[0.14em] text-ink/40">
                  {item.meta}
                </p>
                <p className="mt-2 font-serif text-[14px] leading-snug text-ink/65">
                  {item.forWho}
                </p>
              </button>
            );
          })}
        </div>
      </fieldset>

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
        {fields.map(field => {
          const error = errors[field.id];
          const showError = Boolean(error && touched[field.id]);
          return (
            <div key={field.id}>
              <Label
                htmlFor={field.id}
                className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
                {field.label}
              </Label>
              <Input
                id={field.id}
                type={field.type}
                autoComplete={field.autoComplete}
                value={values[field.id]}
                onChange={setField(field.id)}
                onBlur={blurField(field.id)}
                aria-invalid={showError}
                aria-describedby={showError ? `${field.id}-error` : undefined}
                className={cn(
                  "mt-2 h-12 rounded-none border-input bg-white font-serif text-[16px] text-ink",
                  "focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/35",
                  showError && "border-destructive focus-visible:border-destructive",
                )}
              />
              {showError ? (
                <p
                  id={`${field.id}-error`}
                  role="alert"
                  className="mt-2 flex items-center gap-1.5 font-sans text-[12px] text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}

        {track ? (
          <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-ink/45">
            Starting point selected:{" "}
            <span className="font-semibold text-navy">
              {THREE_TRACKS.find(item => item.id === track)?.label}
            </span>
          </p>
        ) : null}

        {register.isError ? (
          <p
            role="alert"
            className="flex items-start gap-2 border border-destructive/40 bg-destructive/5 p-3 font-sans text-[13px] text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            Something went wrong saving your details. Please try again, or email
            tabitha@kingdomsolutionsai.com and I will add you personally.
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={register.isPending}
          className="w-full bg-navy font-sans text-[12px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-navy-deep disabled:opacity-70">
          {register.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {copy.formSubmitting}
            </>
          ) : (
            copy.formSubmit
          )}
        </Button>

        <p className="font-sans text-[11px] leading-relaxed text-ink/45">
          {mode === "waitlist"
            ? "Your details are used only to send the chapter and announce the session. No sharing, no selling."
            : "Your details are used only for this session. No sharing, no selling."}
        </p>
      </form>
    </div>
  );
}
