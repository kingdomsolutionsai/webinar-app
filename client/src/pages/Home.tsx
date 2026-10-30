import { GoldRule, LionMark } from "@/components/brand";
import { ChatWidget } from "@/components/ChatWidget";
import { RegistrationForm } from "@/components/RegistrationForm";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { MODE_COPY, isPlaceholder, resolveMode } from "@shared/event";
import { ArrowRight, Check, MessageCircleQuestion } from "lucide-react";

type PublicEvent = { date: string; time: string; duration: string; price: string };

function buildChatContext(event: PublicEvent): string {
  const scheduled = !isPlaceholder(event.date);
  return [
    "KINGDOM SOLUTIONS AI WEBINAR",
    "Title: Finding the Gap — Build in the Right Order.",
    "Host: Tabitha Rector, Founder of Kingdom Solutions AI.",
    "Audience: experienced entrepreneurs and professionals building a business from their expertise.",
    scheduled
      ? `Next live workshop: ${event.date} at ${isPlaceholder(event.time) ? "time to be announced" : event.time + " Eastern Time"}. ${isPlaceholder(event.duration) ? "" : "Duration: " + event.duration + "."} Registration is on this page.`
      : "The next live date will be announced on this page.",
    "Core promise: help experienced women identify whether Direction, Offer, Audience, or Structure is holding their business back, then choose one practical next step. Build in the Right Order is the method.",
    "What participants do: reflect on the places their effort is not producing results, test their likely starting gap, and choose one practical action. AI supports processes while people retain authority.",
    "Reason to attend live: a guided starting-point exercise, live Q&A, and a First-Sale Readiness Checklist thank-you gift for people who attend.",
    "Registration gift: a free five-minute business-gap clarity exercise, delivered by email after confirmation.",
    "Registration: first name, last name, email address. Email confirmation is required. Private Zoom details are delivered only after confirmation. Previous webinars do not automatically register someone for this one.",
    "This is a business-building webinar, NOT a book promotion. The book is a separate resource; do not promise a free book or chapter when someone registers for the webinar.",
    "Avoid promising guaranteed sales, earnings, or business outcomes. The workshop is educational, not legal, tax, or financial advice.",
    "Answer warmly and briefly. Invite the visitor to use the form. For questions not addressed here, email tabitha@kingdomsolutionsai.com.",
  ].join("\n");
}

function EventFact({ label, value }: { label: string; value: string }) {
  if (isPlaceholder(value)) return null;
  return (
    <div className="border-l-2 border-gold pl-4">
      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold leading-snug text-white">
        {value}
      </p>
    </div>
  );
}

const TAKEAWAYS = [
  {
    number: "01",
    title: "Recognize a Direction gap",
    text: "See why experience and effort can still leave you uncertain about what to build, for whom, and why.",
  },
  {
    number: "02",
    title: "See the other three gaps",
    text: "Recognize signs of an Offer, Audience, or Structure gap and how they can compound one another.",
  },
  {
    number: "03",
    title: "Choose your next right step",
    text: "Identify your likely starting point and one practical action to take after the session.",
  },
];

export default function Home() {
  const { data: settings, isLoading, isError } = trpc.settings.get.useQuery();
  const event: PublicEvent = {
    date: settings?.date ?? "[DATE]",
    time: settings?.time ?? "[TIME]",
    duration: settings?.duration ?? "[DURATION]",
    price: settings?.price ?? "[PRICE]",
  };
  const mode = resolveMode(event.date);
  const copy = MODE_COPY[mode];
  const isWaitlist = mode === "waitlist";
  const scrollToRegister = () => {
    document.getElementById("register")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="min-h-screen bg-[#fbfaf7] text-ink">
      <header className="border-b border-gold/35 bg-ink">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-3">
            <LionMark size={44} />
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
                Kingdom Solutions AI™
              </p>
              <p className="mt-1 font-serif text-[13px] text-white/70">
                Clarity before complexity. Capacity before scale.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={scrollToRegister}
            className="border border-gold bg-transparent px-5 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-gold hover:bg-gold hover:text-ink">
            {isWaitlist ? "Join the list" : "Reserve your seat"}
          </Button>
        </div>
      </header>

      <main>
        <section className="bg-ink text-white">
          <div className="container grid gap-12 py-12 lg:grid-cols-[1.06fr_0.94fr] lg:items-center lg:gap-16 lg:py-20">
            <div>
              <p className="inline-flex items-center gap-2 border border-gold/45 bg-gold/10 px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
                GET 2027 READY! · Live business-building webinar
              </p>
              <h1 className="mt-7 max-w-2xl font-display text-[40px] font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl xl:text-[57px]">
                Finding <span className="text-gold">the Gap</span>
              </h1>
              <p className="mt-5 max-w-xl font-display text-2xl font-medium leading-snug text-white sm:text-[31px]">
                Identify what needs attention first. Build in the right order.
              </p>
              <GoldRule className="mt-7" />
              <p className="mt-7 max-w-xl font-serif text-[19px] leading-[1.65] text-white/85">
                You have experience and gifts worth sharing. But you may be working hard,
                trying new strategies, and wondering why your business still isn't coming together.
                Your next step may not be more effort. Together we'll explore four common
                business gaps: Direction, Offer, Audience, and Structure, so you can recognize
                what deserves attention first.
              </p>
              {!isWaitlist && !isLoading ? (
                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  <EventFact label="Live on Zoom" value={event.date} />
                  <EventFact label="Eastern Time" value={event.time} />
                  <EventFact label="Length" value={event.duration} />
                  <EventFact label="Your investment" value="Free" />
                </div>
              ) : null}
              <div className="mt-9 flex flex-wrap items-center gap-5">
                <Button
                  type="button"
                  onClick={scrollToRegister}
                  size="lg"
                  className="bg-gold px-8 font-sans text-[12px] font-bold uppercase tracking-[0.14em] text-ink hover:bg-gold-light">
                  {isWaitlist ? "Get updates" : "Reserve my free seat"}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
                <p className="max-w-[220px] font-serif text-[14px] leading-relaxed text-white/65">
                  Led by Tabitha Rector, Founder, Kingdom Solutions AI™
                </p>
              </div>
              <div className="mt-9 flex items-center gap-3 border-t border-gold/20 pt-6">
                <Check className="size-5 shrink-0 text-gold" />
                <p className="font-serif text-[15px] leading-relaxed text-white/75">
                  AI can support the process. You retain authority over decisions.
                </p>
              </div>
            </div>
            <div id="register" className="scroll-mt-6">
              <div className="mb-4 border border-gold/40 bg-[#171717] px-6 py-5">
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-gold">
                  {isWaitlist ? "Stay informed" : "Your invitation"}
                </p>
                <p className="mt-2 font-display text-xl font-semibold text-white">
                  {isWaitlist ? "Be first to hear about the next session." : "Your next right step starts here."}
                </p>
                <p className="mt-2 font-serif text-[15px] leading-relaxed text-white/70">
                  {isWaitlist
                    ? "Leave your details to hear when the next live workshop is announced."
                    : "Register below. Confirm your email to receive your private Zoom details and free five-minute clarity exercise."}
                </p>
              </div>
              {isLoading ? (
                <div className="border border-gold/30 bg-white p-8 font-serif text-ink/65" role="status">
                  Loading registration details…
                </div>
              ) : isError ? (
                <div className="border border-gold/30 bg-white p-8 font-serif text-ink" role="alert">
                  Registration details are temporarily unavailable. Please refresh this page or
                  email tabitha@kingdomsolutionsai.com for help.
                </div>
              ) : (
                <RegistrationForm track={null} mode={mode} />
              )}
              {!isWaitlist && !isLoading && !isError ? (
                <p className="mt-4 font-serif text-[13px] leading-relaxed text-white/65">
                  Already attended a previous session? You are welcome back, but please register
                  for this date so we send you the correct reminders.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="border-b border-gold/15 bg-[#fbfaf7]">
          <div className="container py-14 sm:py-16">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.19em] text-gold-dark">
                One problem. One starting point. One practical action.
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
                Stop adding more. Find what needs to come first.
              </h2>
              <p className="mt-4 font-serif text-lg leading-relaxed text-ink/70">
                If you are getting started or reassessing a business that is not landing the way
                you hoped, this session will help you recognize what is unclear and what comes
                first. Bring your experience, your questions, and a notebook.
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {TAKEAWAYS.map(item => (
                <div key={item.number} className="border border-gold/25 bg-white p-7">
                  <p className="font-display text-[33px] font-bold text-gold-dark">{item.number}</p>
                  <h3 className="mt-3 font-display text-xl font-semibold text-ink">{item.title}</h3>
                  <p className="mt-3 font-serif text-[16px] leading-relaxed text-ink/70">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-gold/25 bg-[#f4efe5]">
          <div className="container flex flex-col gap-7 py-12 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <MessageCircleQuestion className="size-7 text-gold-dark" />
                <h2 className="font-display text-2xl font-bold text-ink">Why attend live?</h2>
              </div>
              <p className="mt-3 font-serif text-[17px] leading-relaxed text-ink/75">
                Work through a live gap-identification exercise with me and bring your questions
                for the Q&A. Those who attend live also receive my First-Sale Readiness Checklist
                as a thank-you. If you need implementation support afterward, I will explain the
                30-Day Business Fast Track™, starting soon.
              </p>
            </div>
            <Button
              type="button"
              onClick={scrollToRegister}
              size="lg"
              className="shrink-0 bg-ink px-7 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-gold hover:bg-ink/90">
              {isWaitlist ? "Join the list" : "Save my seat"}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </section>

        <section className="bg-ink py-12 text-center">
          <div className="container max-w-3xl">
            <p className="font-display text-2xl italic leading-relaxed text-white">
              “Clarity before complexity. Capacity before scale. Human authority throughout.”
            </p>
            <p className="mt-5 font-sans text-[11px] uppercase tracking-[0.15em] text-gold">
              Tabitha Rector · Kingdom Solutions AI™
            </p>
            <p className="mt-7 font-serif text-[13px] leading-relaxed text-white/45">
              Educational content. Not legal, tax, or financial advice. No guaranteed business results.
            </p>
          </div>
        </section>
      </main>
      <ChatWidget context={buildChatContext(event)} />
    </div>
  );
}
