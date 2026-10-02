import {
  BOOK_COVER,
  GoldRule,
  LionDivider,
  LionMark,
  Overline,
  SectionHeading,
} from "@/components/brand";
import { ChatWidget } from "@/components/ChatWidget";
import { RegistrationForm } from "@/components/RegistrationForm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  CORE_PROMISE_SHORT,
  isPlaceholder,
  MODE_COPY,
  resolveMode,
  SAMPLE_CHAPTER,
  READINESS_CHECKLIST,
  THREE_TRACKS,
  type TrackId,
} from "@shared/event";
import { ArrowRight, BookOpen, Check } from "lucide-react";
import { useState } from "react";
/* ------------------------------------------------------------------ *
 * Content. Every figure and quotation below is drawn from the book and
 * is traceable to BLS, Census, SBA, or a presidential/corporate archive.
 * ------------------------------------------------------------------ */
const EIGHT_PARTS = [
  {
    n: "I",
    title: "The Big Picture",
    body: "The eight systems every business runs on — and why a solo consultant runs all eight, same as a company of four hundred.",
  },
  {
    n: "II",
    title: "The Correct Start Order",
    body: "Six steps that produce evidence before expense, so you validate the problem before you fund the solution.",
  },
  {
    n: "III",
    title: "Legal, Tax, Licensing",
    body: "A ten-step formation sequence in the order the agencies themselves are structured, plus the two rework loops to avoid.",
  },
  {
    n: "IV",
    title: "Build the Revenue Engine",
    body: "Offer, pricing math, pipeline, and delivery — arranged so that delivery creates the next sale.",
  },
  {
    n: "V",
    title: "Run the Business",
    body: "Daily, weekly, monthly, quarterly and annual rhythms built for a founder with limited hours, not unlimited ones.",
  },
  {
    n: "VI",
    title: "AI, With Human Authority Intact",
    body: "A five-rung ladder, what to add at each rung, what not to add yet, and what should never be delegated.",
  },
  {
    n: "VII",
    title: "The 90-Day Roadmap",
    body: "Three sprints where each one ends in a decision rather than a deliverable. Not a revenue promise — a sequence.",
  },
  {
    n: "VIII",
    title: "Where Opportunity Is Growing",
    body: "The 50 fastest-growing industries in the United States, with the percentage-versus-absolute distinction that changes how you read them.",
  },
];
const TAKEAWAYS = [
  {
    n: "01",
    title: "Clarity before complexity",
    body: "Get clear on who you serve and what problem you solve before the website, the funnel, or the automation.",
    accent: "navy" as const,
  },
  {
    n: "02",
    title: "Capacity before scale",
    body: "Build the rhythms that sustain the work before the machine that demands more of it.",
    accent: "gold" as const,
  },
  {
    n: "03",
    title: "Human authority throughout",
    body: "Let AI create room for what matters. Never delegate judgment, hard conversations, or an apology.",
    accent: "green" as const,
  },
];
const FOUNDERS = [
  {
    name: "Abraham Lincoln",
    role: "16th President of the United States",
    quote: "I am not bound to win, but I am bound to be true.",
    lesson:
      "A failed store left him with debts he called his “national debt.” He spent roughly seventeen years repaying them rather than walking away. Integrity is an asset that outlasts a balance sheet.",
    source: "Attributed; debt account documented by the Abraham Lincoln Presidential Library",
  },
  {
    name: "Sarah Breedlove — Madam C. J. Walker",
    role: "Founder, Madam C. J. Walker Manufacturing Company",
    quote:
      "I got my start by giving myself a start.",
    lesson:
      "She began with one dollar and five cents and sold door to door, going where her customers already were rather than waiting to be discovered.",
    source: "National Museum of American History",
  },
  {
    name: "Sam Walton",
    role: "Founder, Walmart",
    quote:
      "I had no idea the lease had such a clause… It was a real blow.",
    lesson:
      "He lost his best-performing store to a clause in a lease he had not read closely. Every lease he signed afterward ran ninety-nine years.",
    source: "Sam Walton, Made in America",
  },
  {
    name: "S. Truett Cathy",
    role: "Founder, Chick-fil-A",
    quote: "Nearly every moment of every day we have the opportunity to give something to someone else.",
    lesson:
      "Twenty-one years with a single small restaurant before expanding, an uninsured fire along the way, and closed on Sundays from the first week onward.",
    source: "Chick-fil-A corporate history",
  },
  {
    name: "Sara Blakely",
    role: "Founder, Spanx",
    quote:
      "I did not have a business background… I just had an idea and a lot of persistence.",
    lesson:
      "Five thousand dollars in savings, her own patent application written to save legal fees, and a product built before there was a brand to put on it.",
    source: "Public interviews and Spanx company history",
  },
];
/* ------------------------------------------------------------------ *
 * Chatbot briefing. Built from the same live settings and content the page
 * shows, so the chatbot always knows the current date, time and agenda.
 * When Tabitha changes the date on the dashboard, the chatbot updates too.
 * ------------------------------------------------------------------ */
function buildChatContext(event: {
  date: string;
  time: string;
  duration: string;
  price: string;
}): string {
  const scheduled = !isPlaceholder(event.date);
  const priceLine = isPlaceholder(event.price) ? "Free" : event.price;
  const schedule = scheduled
    ? [
        `Date: ${event.date}`,
        `Time: ${isPlaceholder(event.time) ? "not yet announced" : `${event.time} Eastern Time (ET)`}`,
        `Duration: ${isPlaceholder(event.duration) ? "not yet announced" : event.duration}`,
        `Cost: ${priceLine}`,
        `Format: live on Zoom. Registrants receive the Zoom link by email as soon as they confirm their email address, then again one week before, the day before, and one hour before the session starts. The link is never posted publicly.`,
      ].join("\n")
    : "The next date has not been announced yet. Visitors can join the list on this page to get Part One of the book free and be the first to know the date.";

  return [
    "WEBINAR FACTS (from the live registration page the visitor is on right now; treat these as current and accurate, and answer date, time and agenda questions directly from them):",
    "",
    "Title: What Entrepreneurs Need to Know",
    "Host: Tabitha Rector, Founder of Kingdom Solutions AI",
    "Website: whatentrepreneursneedtoknow.com",
    schedule,
    "",
    "What it is: a live session that walks the correct sequence for building a business: the eight systems every business runs on, the correct start order, and where to begin with AI while human authority stays intact. Founders rarely fail for lack of talent or a worthy idea; they fail because they did the right things in the wrong order.",
    "",
    "The eight parts covered, in decision order:",
    ...EIGHT_PARTS.map(p => `${p.n}. ${p.title}: ${p.body}`),
    "",
    "Three takeaways:",
    ...TAKEAWAYS.map(t => `- ${t.title}: ${t.body}`),
    "",
    "Who it is for (three starting points):",
    ...THREE_TRACKS.map(t => `- ${t.label}: ${t.summary} ${t.startHere}`),
    "",
    `Free resources: everyone who signs up gets Part One of the book (${SAMPLE_CHAPTER.pages}-page PDF, complete, not an excerpt). Everyone who attends live receives the ${READINESS_CHECKLIST.title} (${READINESS_CHECKLIST.pages}-page fillable PDF) afterward as a thank-you. The checklist is only for live attendees.`,
    "Bring something to write with: there is one short exercise (about four minutes).",
    "Disclaimer: the session is educational and is not legal, tax, or financial advice. It does not promise revenue in ninety days; it teaches the order.",
    "",
    "How to answer: be warm, brief and specific. When asked about the date or time, state them plainly and then invite the visitor to reserve a seat with the form on this page. Do not invent details that are not listed here; if something is not covered, suggest emailing tabitha@kingdomsolutionsai.com. Do not use em dashes.",
  ].join("\n");
}
/* ------------------------------------------------------------------ */
function EventDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const pending = isPlaceholder(value);
  return (
    <div className="border-t border-gold/35 pt-3">
      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-gold/85">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-display text-lg font-bold",
          pending ? "text-white/45" : "text-white",
        )}>
        {value}
      </p>
    </div>
  );
}
export default function Home() {
  const { data: settings } = trpc.settings.get.useQuery();
  const [selectedTrack, setSelectedTrack] = useState<TrackId | null>(null);
  const event = {
    date: settings?.date ?? "[DATE]",
    time: settings?.time ?? "[TIME]",
    duration: settings?.duration ?? "[DURATION]",
    price: settings?.price ?? "[PRICE]",
  };
  // Mode is derived from the date, never set by hand, so the page copy and the
  // displayed date can never contradict each other.
  const mode = resolveMode(event.date);
  const copy = MODE_COPY[mode];
  const isWaitlist = mode === "waitlist";
  const scrollToRegister = () => {
    document.getElementById("register")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="min-h-screen bg-background">
      {/* ---------------- Header ---------------- */}
      <header className="border-b border-gold/25 bg-ink">
        <div className="container flex items-center justify-between py-5">
          <div className="flex items-center gap-4">
            <LionMark size={46} />
            <div className="hidden sm:block">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
                Kingdom Solutions AI&trade;
              </p>
              <p className="mt-0.5 font-serif text-[13px] italic text-white/60">
                Leadership, clarity, and sustainable systems
              </p>
            </div>
          </div>
          <Button
            onClick={scrollToRegister}
            className="border border-gold bg-transparent font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-gold transition-colors hover:bg-gold hover:text-ink">
            {copy.navCta}
          </Button>
        </div>
      </header>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden bg-ink">
        <div className="container grid items-center gap-14 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div>
            <Overline>A Live Session with Tabitha Rector</Overline>
            <h1 className="mt-5 font-display text-4xl font-black leading-[1.06] tracking-[-0.02em] text-white sm:text-5xl lg:text-[3.35rem]">
              What Entrepreneurs
              <br />
              <span className="text-gold">Need to Know</span>
            </h1>
            <GoldRule className="mt-7" />
            <p className="mt-7 max-w-xl font-serif text-lg leading-relaxed text-white/80">
              Founders rarely fail for lack of talent, passion, or a worthy idea. They fail because
              they did the right things in the wrong order. This session walks the sequence — the
              eight systems every business runs on, the correct start order, and where to begin with
              AI while human authority stays intact.
            </p>
            {isWaitlist ? (
              <div className="mt-9 max-w-xl border-l-2 border-gold pl-6">
                <p className="flex items-center gap-2 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                  <BookOpen className="size-3.5" />
                  Start today &mdash; free
                </p>
                <p className="mt-3 font-serif text-[17px] leading-relaxed text-white/80">
                  The live session is being scheduled. In the meantime, Part One of the book is
                  yours at no cost &mdash; {SAMPLE_CHAPTER.pages} pages, complete and unabridged.
                  Join the list and you will be first to know the date.
                </p>
              </div>
            ) : (
              <div className="mt-9 grid max-w-xl grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
                <EventDetail label="Date" value={event.date} />
                <EventDetail label="Time" value={event.time} />
                <EventDetail label="Duration" value={event.duration} />
              </div>
            )}
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <Button
                onClick={scrollToRegister}
                size="lg"
                className="bg-gold px-8 font-sans text-[12px] font-bold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-light">
                {copy.heroCta}
                <ArrowRight className="ml-1 size-4" />
              </Button>
              <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-white/45">
                Tabitha Rector, Founder Kingdom Solutions AI&trade;
              </p>
            </div>
          </div>
          {/* Book cover */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              <div className="absolute -inset-3 border border-gold/30" aria-hidden="true" />
              <img
                src={BOOK_COVER}
                alt="What Every New Entrepreneur Needs to Know — book cover"
                className="relative h-[440px] w-[293px] object-contain shadow-[0_28px_70px_-24px_rgba(201,162,39,0.45)] sm:h-[520px] sm:w-[347px]"
              />
            </div>
          </div>
        </div>
      </section>
      {/* ---------------- The argument ---------------- */}
      <section className="border-y border-gold/30 bg-gold-tint">
        <div className="container py-14">
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex items-baseline gap-8">
              <div>
                <p className="font-display text-5xl font-black text-navy sm:text-6xl">79.4%</p>
                <p className="mt-2 max-w-[9rem] font-sans text-[11px] font-semibold uppercase leading-relaxed tracking-[0.16em] text-navy/65">
                  survive year one
                </p>
              </div>
              <div className="h-16 w-px bg-gold" aria-hidden="true" />
              <div>
                <p className="font-display text-5xl font-black text-gold-dark sm:text-6xl">34.7%</p>
                <p className="mt-2 max-w-[9rem] font-sans text-[11px] font-semibold uppercase leading-relaxed tracking-[0.16em] text-navy/65">
                  reach year ten
                </p>
              </div>
            </div>
            <div>
              <p className="font-serif text-xl leading-relaxed text-ink">
                The popular claim that most businesses fail in the first year is false. What the data
                actually shows is a slow erosion over ten years &mdash; thin margins, cash pressure,
                an absent foundation, and a founder carrying the whole thing alone.
              </p>
              <p className="mt-4 font-serif text-xl font-semibold leading-relaxed text-navy">
                That gap is not a talent gap. It is a foundation gap. And foundations are built by
                sequence, not by intention.
              </p>
              <p className="mt-4 font-sans text-[11px] uppercase tracking-[0.16em] text-ink/45">
                Source: U.S. Bureau of Labor Statistics, Business Employment Dynamics
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* ---------------- The core promise ----------------
          Placed straight after the survival curve: the data states the problem,
          this states why it matters to the person reading it. Every one of the
          three tracks should recognise themselves here. */}
      <section className="bg-ink">
        <div className="container py-16">
          <div className="mx-auto max-w-4xl text-center">
            <LionMark size={44} className="mx-auto" />
            <p className="mt-8 font-serif text-2xl leading-[1.5] text-white sm:text-[28px]">
              You are not afraid of hard work &mdash; you are afraid of{" "}
              <span className="font-semibold text-gold">getting it wrong</span>, and this session
              exists so that the time and money you are about to invest are spent in the right
              order, the first time.
            </p>
            <div className="mx-auto mt-9 h-px w-20 bg-gold/60" />
            <p className="mt-7 font-display text-lg font-bold uppercase tracking-[0.08em] text-gold">
              {CORE_PROMISE_SHORT}
            </p>
          </div>
        </div>
      </section>
      {/* ---------------- Eight parts ---------------- */}
      <section className="container py-20">
        <SectionHeading
          overline="What the Session Covers"
          title="Eight parts, arranged in decision order"
          intro="The book is not a collection of ideas. It is a sequence — and the sequence is the point. We walk all eight parts, with the practical instrument from each one."
        />
        <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
          {EIGHT_PARTS.map(part => (
            <div key={part.n} className="border-t-2 border-navy pt-5">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-2xl font-black text-gold">{part.n}</span>
                <h3 className="font-display text-lg font-bold leading-tight text-navy">
                  {part.title}
                </h3>
              </div>
              <p className="mt-3 font-serif text-[15px] leading-relaxed text-ink/75">{part.body}</p>
            </div>
          ))}
        </div>
        {/* 50 industries feature */}
        <div className="mt-16 grid items-center gap-10 border border-navy bg-navy px-8 py-10 lg:grid-cols-[1fr_1.3fr] lg:px-12">
          <div>
            <p className="font-display text-6xl font-black leading-none text-gold sm:text-7xl">50</p>
            <p className="mt-3 font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
              fastest-growing U.S. industries
            </p>
          </div>
          <div>
            <h3 className="font-display text-2xl font-bold text-white">
              Where opportunity is actually growing
            </h3>
            <p className="mt-4 font-serif text-[17px] leading-relaxed text-white/80">
              Two full data tables built from the Bureau of Labor Statistics 2024&ndash;2034
              Employment Projections. Solar installation leads on percentage growth at 180.2%, while
              the largest absolute gain belongs to services for the elderly and people with
              disabilities &mdash; more than half a million new positions.
            </p>
            <p className="mt-4 font-serif text-[17px] font-semibold leading-relaxed text-gold-light">
              We cover the distinction between percentage growth and absolute growth, because
              confusing the two sends founders toward the wrong opportunity.
            </p>
          </div>
        </div>
      </section>
      {/* ---------------- Three takeaways ---------------- */}
      <section className="border-y border-border bg-secondary/40">
        <div className="container py-20">
          <SectionHeading
            overline="What You Will Leave With"
            title="Three takeaways, and the first move for each"
            align="center"
          />
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {TAKEAWAYS.map(item => (
              <div key={item.n} className="border border-border bg-white p-8">
                <p
                  className={cn(
                    "font-display text-4xl font-black",
                    item.accent === "navy" && "text-navy",
                    item.accent === "gold" && "text-gold",
                    item.accent === "green" && "text-green",
                  )}>
                  {item.n}
                </p>
                <h3 className="mt-4 font-display text-xl font-bold leading-tight text-navy">
                  {item.title}
                </h3>
                <div
                  className={cn(
                    "mt-4 h-[3px] w-12",
                    item.accent === "navy" && "bg-navy",
                    item.accent === "gold" && "bg-gold",
                    item.accent === "green" && "bg-green",
                  )}
                />
                <p className="mt-5 font-serif text-[16px] leading-relaxed text-ink/80">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* ---------------- Three readers ---------------- */}
      <section className="container py-20">
        <SectionHeading
          overline="Find Your Starting Point"
          title="Three founders will join this session, and they need different things"
          intro="Choose the one that describes you. Founders arrive in different places, and the worst outcome is spending your time in the wrong chapter."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {THREE_TRACKS.map(track => {
            const active = selectedTrack === track.id;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => setSelectedTrack(active ? null : track.id)}
                aria-pressed={active}
                className={cn(
                  "group flex flex-col border p-7 text-left transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2",
                  active
                    ? "border-transparent bg-navy shadow-[0_18px_44px_-20px_rgba(20,33,61,0.55)]"
                    : "border-border bg-white hover:border-gold",
                )}>
                <div className="flex items-start justify-between gap-4">
                  <h3
                    className={cn(
                      "font-display text-xl font-bold leading-tight",
                      active ? "text-white" : "text-navy",
                    )}>
                    {track.label}
                  </h3>
                  <span
                    className={cn(
                      "mt-1 flex size-5 shrink-0 items-center justify-center border transition-colors",
                      active ? "border-gold bg-gold" : "border-input group-hover:border-gold",
                    )}>
                    {active ? <Check className="size-3.5 text-ink" strokeWidth={3} /> : null}
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-4 h-[3px] w-10",
                    track.accent === "navy" && (active ? "bg-gold" : "bg-navy"),
                    track.accent === "gold" && "bg-gold",
                    track.accent === "green" && (active ? "bg-green" : "bg-green"),
                  )}
                />
                <p
                  className={cn(
                    "mt-5 font-serif text-[16px] leading-relaxed",
                    active ? "text-white/80" : "text-ink/75",
                  )}>
                  {track.summary}
                </p>
                <p
                  className={cn(
                    "mt-5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em]",
                    active ? "text-gold" : "text-ink/40",
                  )}>
                  Start here
                </p>
                <p
                  className={cn(
                    "mt-1.5 font-serif text-[15px] leading-relaxed",
                    active ? "text-gold-light" : "text-navy",
                  )}>
                  {track.startHere}
                </p>
              </button>
            );
          })}
        </div>
        <p className="mt-8 font-serif text-[16px] italic leading-relaxed text-ink/60">
          If the third one is you, hear this plainly: starting there is not falling behind. For your
          situation, it is the correct order.
        </p>
      </section>
      {/* ---------------- Registration ---------------- */}
      <section id="register" className="scroll-mt-8 border-y border-gold/25 bg-ink">
        <div className="container grid gap-14 py-20 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <Overline>{copy.sectionOverline}</Overline>
            <h2 className="mt-4 font-display text-3xl font-black leading-[1.12] text-white sm:text-4xl">
              {copy.sectionHeading}
            </h2>
            <GoldRule className="mt-5" />
            {isWaitlist ? (
              <>
                <p className="mt-8 max-w-lg font-serif text-[17px] leading-relaxed text-white/75">
                  I would rather give you something useful today than ask you to wait for a date I
                  have not set. Part One settles what a business actually is and which of its
                  eight systems is limiting you &mdash; complete and unabridged, not a teaser
                  chapter. The First-Sale Readiness Checklist comes later, as my thank-you to
                  everyone who actually shows up to the live session.
                </p>
                <div className="mt-8 grid max-w-lg gap-4 sm:grid-cols-2">
                  {[
                    { k: `${SAMPLE_CHAPTER.pages}-page chapter`, v: "Complete, not an excerpt" },
                    { k: "No cost", v: "And no purchase required" },
                    { k: "Checklist later", v: "For everyone who attends live" },
                    { k: "First to know", v: "When the date is set" },
                  ].map(item => (
                    <div key={item.k} className="border-l border-gold/40 pl-4">
                      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
                        {item.k}
                      </p>
                      <p className="mt-1 font-serif text-[15px] text-white/65">{item.v}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mt-8 grid max-w-lg grid-cols-2 gap-x-8 gap-y-5">
                  <EventDetail label="Date" value={event.date} />
                  <EventDetail label="Time" value={event.time} />
                  <EventDetail label="Duration" value={event.duration} />

                </div>
                <p className="mt-9 max-w-lg font-serif text-[17px] leading-relaxed text-white/75">
                  Bring something to write with. There is one exercise, it takes about four minutes,
                  and it is the part most people tell me they remember.
                </p>
                <p className="mt-4 max-w-lg font-serif text-[16px] leading-relaxed text-white/60">
                  Everyone who attends live also receives the {READINESS_CHECKLIST.title} afterward
                  &mdash; my thank-you for actually showing up.
                </p>
              </>
            )}
            <div className="mt-9 border-l-2 border-gold pl-6">
              <p className="font-serif text-[16px] italic leading-relaxed text-white/70">
                This session is educational and is not legal, tax, or financial advice. It does not
                promise revenue in ninety days &mdash; it teaches the order.
              </p>
            </div>
          </div>
          <RegistrationForm track={selectedTrack} mode={mode} />
        </div>
      </section>
      {/* ---------------- Founder's Table ---------------- */}
      <section className="container py-20">
        <SectionHeading
          overline="The Founder's Table"
          title="Documented accounts, not motivational folklore"
          intro="The book carries twelve accounts of presidents and founders who went out on their own. Every quotation is traced to a presidential library, a corporate archive, or the subject's own book. Where a widely circulated quote could not be verified, it was excluded rather than repeated."
        />
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {FOUNDERS.map((founder, index) => (
            <div
              key={founder.name}
              className={cn(
                "flex flex-col border p-8",
                index === 0 ? "border-transparent bg-navy lg:col-span-2" : "border-border bg-white",
              )}>
              <blockquote
                className={cn(
                  "font-serif text-xl italic leading-relaxed",
                  index === 0 ? "text-gold-light" : "text-navy",
                )}>
                &ldquo;{founder.quote}&rdquo;
              </blockquote>
              <div
                className={cn("mt-6 h-[3px] w-12", index === 0 ? "bg-gold" : "bg-gold")}
                aria-hidden="true"
              />
              <p
                className={cn(
                  "mt-5 font-sans text-[12px] font-bold uppercase tracking-[0.18em]",
                  index === 0 ? "text-white" : "text-navy",
                )}>
                {founder.name}
              </p>
              <p
                className={cn(
                  "mt-1 font-sans text-[11px] uppercase tracking-[0.14em]",
                  index === 0 ? "text-white/50" : "text-ink/45",
                )}>
                {founder.role}
              </p>
              <p
                className={cn(
                  "mt-5 font-serif text-[16px] leading-relaxed",
                  index === 0 ? "text-white/80" : "text-ink/75",
                )}>
                {founder.lesson}
              </p>
              <p
                className={cn(
                  "mt-5 font-sans text-[10px] uppercase tracking-[0.16em]",
                  index === 0 ? "text-white/35" : "text-ink/35",
                )}>
                {founder.source}
              </p>
            </div>
          ))}
        </div>
      </section>
      {/* ---------------- Founder / close ---------------- */}
      <section className="border-t border-gold/25 bg-ink">
        <div className="container py-20 text-center">
          <LionDivider className="mx-auto max-w-md" />
          <p className="mx-auto mt-12 max-w-2xl font-serif text-2xl italic leading-relaxed text-white">
            You have a gift, and it was given to you for a reason. The work now is to build the
            structure that lets you{" "}
            <span className="font-semibold text-gold">steward it well</span> &mdash; without
            spending yourself to do it, and without compromising what you will not compromise.
          </p>
          <div className="mx-auto mt-12 h-px w-24 bg-gold/50" />
          <p className="mt-8 font-display text-xl font-bold text-white">Tabitha Rector</p>
          <div className="mx-auto mt-3 h-px w-12 bg-gold" />
          <p className="mt-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
            Founder Kingdom Solutions AI&trade;
          </p>
          <p className="mt-1.5 font-sans text-[10px] uppercase tracking-[0.18em] text-white/45">
            Leadership Coach &middot; Certified AI Strategy Consultant
          </p>
          <div className="mt-10">
            <Button
              onClick={scrollToRegister}
              size="lg"
              className="bg-gold px-8 font-sans text-[12px] font-bold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-light">
              {copy.heroCta}
              <ArrowRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      </section>
      <footer className="border-t border-gold/20 bg-ink">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
          <div className="flex items-center gap-3">
            <LionMark size={30} />
            <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/45">
              Kingdom Solutions AI&trade;
            </p>
          </div>
          <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-white/35">
            Educational content &middot; Not legal, tax, or financial advice
          </p>
        </div>
      </footer>
      <ChatWidget context={buildChatContext(event)} />
    </div>
  );
}
