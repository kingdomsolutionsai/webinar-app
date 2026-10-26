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
    "Title: Finding the Gap — What Is Keeping Your Business From Moving Forward?",
    "Host: Tabitha Rector, Founder of Kingdom Solutions AI by Revived Spirit.",
    "Audience: experienced Christian women entrepreneurs who want to steward their skills, gifts, and calling with clarity.",
    scheduled
      ? `Next live workshop: ${event.date} at ${isPlaceholder(event.time) ? "time to be announced" : event.time + " Eastern Time"}. ${isPlaceholder(event.duration) ? "" : "Duration: " + event.duration + "."} Registration is on this page.`
      : "The next live date will be announced on this page.",
    "Core promise: help attendees recognize a possible business gap and leave with one clear next action. The full teaching is shared during the live workshop.",
    "What participants do: reflect on where their effort is not producing results and identify a practical starting point. AI may support processes, with human authority throughout.",
    "Two distinct gifts: after email confirmation, Part One of Tabitha’s Entrepreneur Handbook; after live attendance, the First-Sale Readiness Checklist. Live Q&A is included.",
    "Registration: first name, last name, email address. Email confirmation is required. Private Zoom details are delivered only after confirmation. Previous webinars do not automatically register someone for this one.",
    "This is a faith-rooted business webinar, not a book promotion. Chapter One is a signup thank-you; the complete Handbook remains a separate paid resource. Do not teach the full method in chat.",
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
    title: "Recognize where clarity is missing",
    text: "Start with the Direction Gap: whom you serve, the problem you solve, and the offer you want to build.",
  },
  {
    number: "02",
    title: "Understand the four business gaps",
    text: "Notice the signals of Direction, Offer, Audience, and Structure gaps without trying to fix everything at once.",
  },
  {
    number: "03",
    title: "Leave with one faithful next step",
    text: "Choose one practical action for the next thirty days and see how thoughtful stewardship becomes a plan.",
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
                GET 2027 READY! · Free faith-rooted business webinar
              </p>
              <h1 className="mt-7 max-w-2xl font-display text-[40px] font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl xl:text-[57px]">
                Finding the <span className="text-gold">Gap</span>
              </h1>
              <p className="mt-5 max-w-xl font-display text-2xl font-medium leading-snug text-white sm:text-[31px]">
                What's Keeping Your Business From Moving Forward?
              </p>
              <GoldRule className="mt-7" />
              <p className="mt-7 max-w-xl font-serif text-[19px] leading-[1.65] text-white/85">
                You have valuable experience, God-given gifts, and a desire to build something
                meaningful. But perhaps you've worked harder, changed your message, or invested
                in more training without seeing the progress you hoped for. That does not diminish
                your worth. Join me to discover which business gap deserves your attention first
                and how to steward your next step with wisdom and confidence.
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
                  Led by Tabitha Rector, PCC · Kingdom Solutions AI™ by Revived Spirit
                </p>
              </div>
              <div className="mt-9 flex items-center gap-3 border-t border-gold/20 pt-6">
                <Check className="size-5 shrink-0 text-gold" />
                <p className="font-serif text-[15px] leading-relaxed text-white/75">
                  Your worth is not measured by your sales. Your calling deserves wise stewardship.
                </p>
              </div>
            </div>
            <div id="register" className="scroll-mt-6">
              <div className="mb-4 border border-gold/40 bg-[#171717] px-6 py-5">
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-gold">
                  {isWaitlist ? "Stay informed" : "Your invitation"}
                </p>
                <p className="mt-2 font-display text-xl font-semibold text-white">
                  {isWaitlist ? "Be first to hear about the next session." : "Your gifts and calling deserve a clear starting point."}
                </p>
                <p className="mt-2 font-serif text-[15px] leading-relaxed text-white/70">
                  {isWaitlist
                    ? "Leave your details to hear when the next live workshop is announced."
                    : "Register below. Confirm your email to receive Chapter One of my Handbook and your private Zoom details."}
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
                Faith, clarity, and one practical starting point.
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
                You are not failing because you haven't figured it all out.
              </h2>
              <p className="mt-4 font-serif text-lg leading-relaxed text-ink/70">
                Building a business is a responsibility and an honor. You deserve a space to bring
                your questions without judgment, recognize what may be missing, and move ahead
                with intentional next steps. We will begin with the Direction Gap, then connect
                it to the other gaps that may be affecting your progress.
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

        <section className="border-b border-gold/20 bg-white">
          <div className="container grid gap-6 py-12 md:grid-cols-[1fr_1.1fr] md:items-center">
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-dark">
                Meet your host
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold text-ink">
                Business experience, grounded in faith
              </h2>
            </div>
            <p className="font-serif text-[17px] leading-relaxed text-ink/75">
              I'm Tabitha Rector, a Professional Certified Coach with more than 30 years of experience
              in banking, lending, sales, marketing, and business advisory. I've coached teams,
              helped bank branches generate millions of dollars, and worked with business owners
              to recognize what needs attention. I believe our gifts should be stewarded with
              integrity, wisdom, and excellence.
            </p>
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
                After confirming your registration, receive Chapter One of my Entrepreneur Handbook.
                Then join me live for a guided gap-identification exercise and Q&A. Women who
                attend live also receive my First-Sale Readiness Checklist. If you want guided
                implementation, I will explain my 30-Day Business Fast Track™, starting soon.
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
              Tabitha Rector · Kingdom Solutions AI™ by Revived Spirit
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
