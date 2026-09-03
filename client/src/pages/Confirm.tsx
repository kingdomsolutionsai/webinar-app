import { LionMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  AUDIT_INVITATION,
  EXERCISE_PROMPT,
  SAMPLE_CHAPTER,
  THREE_TRACKS,
} from "@shared/event";
import { AlertCircle, ArrowUpRight, BookOpen, Download, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "wouter";
/**
 * Reached from the link in the double opt-in confirmation email. No login:
 * the `e` (email) and `t` (signed token) query params are verified server-side
 * in `registration.confirm`, the same pattern already used by /unsubscribe.
 *
 * This is where Part One is actually handed over — the signup form only ever
 * promises "check your email" (see RegistrationForm.tsx), so everything below
 * was previously shown right after signup and now waits for this click.
 *
 * The First-Sale Readiness Checklist is deliberately absent from this page.
 * It is no longer a signup resource — it is a reward reserved for people who
 * actually attend the live session, delivered separately once Tabitha marks
 * attendance on the dashboard.
 */
export default function Confirm() {
  const params = new URLSearchParams(window.location.search);
  const email = params.get("e") ?? "";
  const token = params.get("t") ?? "";
  const confirm = trpc.registration.confirm.useMutation();
  // Guards against React re-running the effect twice (StrictMode in dev) and
  // firing the mutation, and the resource-delivery email behind it, twice.
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (!email || !token) return;
    confirm.mutate({ email, token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const missingParams = !email || !token;
  /* -------------------- Missing or malformed link -------------------- */
  if (missingParams) {
    return (
      <ErrorPanel
        heading="This link looks incomplete"
        body="Please use the confirm link exactly as it appeared in your email, or sign up again below."
      />
    );
  }
  /* -------------------- Loading -------------------- */
  if (confirm.isIdle || confirm.isPending) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-xl items-center justify-center px-4 py-16">
        <div className="flex items-center gap-3 font-sans text-[13px] uppercase tracking-[0.2em] text-ink/50">
          <Loader2 className="size-4 animate-spin" />
          Confirming your email
        </div>
      </div>
    );
  }
  /* -------------------- Failure (bad/expired link, unknown address) -------------------- */
  if (!confirm.data || !confirm.data.ok) {
    return (
      <ErrorPanel
        heading="This link didn't check out"
        body="It may have already been used with a different link, or copied incompletely. Please sign up again below and a fresh confirmation email will go out right away."
      />
    );
  }
  /* -------------------- Success -------------------- */
  const { firstName, track, downloads } = confirm.data;
  const chosen = THREE_TRACKS.find(item => item.id === track);
  const href = downloads?.chapter ?? SAMPLE_CHAPTER.url;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <div className="border border-gold bg-white p-8 sm:p-10">
        <div className="flex items-center gap-4">
          <LionMark size={48} />
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">
              Part One is ready
            </p>
            <h3 className="mt-1 font-display text-2xl font-black text-navy">
              Confirmed, {firstName}.
            </h3>
          </div>
        </div>
        <div className="mt-7 h-[3px] w-14 bg-gold" />
        <p className="mt-7 font-serif text-[17px] leading-relaxed text-ink/80">
          A copy is also on its way to your inbox, so you will not lose it. If it has not
          arrived in a few minutes, please check your spam folder.
        </p>
        {/* The single free resource. */}
        <div className="mt-7 space-y-3">
          <div className="border border-gold bg-gold-tint p-6">
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 size-4 shrink-0 text-gold-dark" />
              <div>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-dark">
                  Ready now
                </p>
                <p className="mt-2 font-display text-lg font-bold leading-tight text-navy">
                  {SAMPLE_CHAPTER.title}
                </p>
                <p className="mt-2 font-serif text-[16px] leading-relaxed text-ink/75">
                  {SAMPLE_CHAPTER.pages} pages, complete and unabridged — not an excerpt.
                  Six chapters and the Lincoln account, covering the eight systems every
                  business runs on.
                </p>
              </div>
            </div>
            <Button
              asChild
              className="mt-5 w-full bg-ink font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-gold hover:bg-ink/90">
              <a href={href} download={SAMPLE_CHAPTER.filename}>
                <Download className="mr-1.5 size-3.5" />
                Download Part One
              </a>
            </Button>
          </div>
          <p className="font-serif text-[15px] italic leading-relaxed text-ink/55">
            The First-Sale Readiness Checklist is my thank-you gift for people who actually
            show up to the live session — it will be waiting in your inbox afterward if you're
            there.
          </p>
        </div>
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
          because the free resource is the promise of this screen and must
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
    </div>
  );
}
function ErrorPanel({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16">
      <div className="border border-destructive/40 bg-destructive/5 p-8 sm:p-10">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <h3 className="font-display text-xl font-black text-navy">{heading}</h3>
            <p className="mt-3 font-serif text-[16px] leading-relaxed text-ink/75">{body}</p>
          </div>
        </div>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 border border-navy px-5 py-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-navy transition-colors duration-200 hover:bg-navy hover:text-white">
          Back to the sign-up page
        </Link>
      </div>
    </div>
  );
}
