import { LionMark } from "@/components/brand";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

const HELPFUL = [
  { value: "very", label: "Very helpful" },
  { value: "somewhat", label: "Somewhat helpful" },
  { value: "unsure", label: "I'm still unsure what to do next" },
];

const VALUABLE = [
  { value: "eight_systems", label: "Understanding the eight business systems" },
  { value: "priority", label: "Identifying the first business priority" },
  { value: "right_order", label: "Learning how to build in the right order" },
  { value: "ai", label: "Understanding where AI can help and where people retain authority" },
  { value: "other", label: "Something else" },
];

const initial = {
  name: "",
  email: "",
  helpful: "",
  mostValuable: "",
  confusing: "",
  question: "",
  nextAction: "",
  website: "",
};

export default function Feedback() {
  const [answers, setAnswers] = useState(initial);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const update = (key: keyof typeof initial, value: string) =>
    setAnswers(previous => ({ ...previous, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending" || status === "done") return;
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/api/webinar-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(answers),
      });
      if (!response.ok) throw new Error("Unable to send feedback");
      setStatus("done");
    } catch {
      setStatus("error");
      setError("We could not send your feedback. Please try again in a moment.");
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F5ED] text-[#161616]">
      <header className="border-b border-[#C9A227]/40 bg-[#101010] text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-5">
          <LionMark size={55} className="shrink-0" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.21em] text-[#D9BC66]">
              Kingdom Solutions AI™
            </p>
            <p className="mt-1 font-serif text-lg">What Entrepreneurs Need to Know</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        {status === "done" ? (
          <section aria-live="polite" className="border border-[#C9A227]/50 bg-white px-6 py-14 text-center shadow-sm sm:px-12">
            <CheckCircle2 aria-hidden="true" className="mx-auto size-12 text-[#97731C]" />
            <h1 className="mt-6 font-display text-3xl font-bold">Thank you for your feedback!</h1>
            <p className="mx-auto mt-4 max-w-md font-serif text-lg leading-relaxed text-[#494949]">
              Your answers have been sent directly to Tabitha. Any question you included will be reviewed for a personal reply.
            </p>
            <a href="/" className="mt-8 inline-flex items-center gap-2 border border-[#C9A227] px-5 py-3 text-sm font-semibold hover:bg-[#F8F5ED]">
              Return to the webinar website <ArrowRight className="size-4" />
            </a>
          </section>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.23em] text-[#937016]">A personal note from Tabitha</p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">
              I'd love your feedback.
            </h1>
            <p className="mt-5 max-w-2xl font-serif text-lg leading-relaxed text-[#434343]">
              Thank you for joining me for What Entrepreneurs Need to Know.
              We ran out of time for questions, and I want to make sure your voice is heard.
              These five short questions will also help me strengthen the next two sessions.
            </p>
            <p className="mt-3 text-sm text-[#5A5A5A]">About 2 minutes · Your responses go directly to Tabitha.</p>

            <form onSubmit={submit} className="mt-8 space-y-8 border border-[#E2D7BD] bg-white p-6 shadow-sm sm:p-9">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="feedback-name" className="mb-2 block text-sm font-semibold">Your name</label>
                  <input id="feedback-name" autoComplete="name" required maxLength={120}
                    value={answers.name} onChange={e => update("name", e.target.value)}
                    className="w-full border border-[#BFB9AA] px-3 py-3 text-base outline-offset-2 focus:outline-[#AC8929]"
                    placeholder="First name is fine" />
                </div>
                <div>
                  <label htmlFor="feedback-email" className="mb-2 block text-sm font-semibold">Your email</label>
                  <input id="feedback-email" type="email" autoComplete="email" required maxLength={320}
                    value={answers.email} onChange={e => update("email", e.target.value)}
                    className="w-full border border-[#BFB9AA] px-3 py-3 text-base outline-offset-2 focus:outline-[#AC8929]"
                    placeholder="So I can reply to your question" />
                </div>
              </div>

              <fieldset>
                <legend className="mb-3 font-display text-lg font-bold">1. How helpful was the webinar in understanding what your business needs next?</legend>
                <div className="space-y-3">
                  {HELPFUL.map(option => (
                    <label key={option.value} className="flex cursor-pointer items-start gap-3 text-base">
                      <input type="radio" name="helpful" value={option.value} required checked={answers.helpful === option.value}
                        onChange={e => update("helpful", e.target.value)}
                        className="mt-1 size-4 accent-[#A68428]" />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-3 font-display text-lg font-bold">2. Which part of the presentation was most valuable to you?</legend>
                <div className="space-y-3">
                  {VALUABLE.map(option => (
                    <label key={option.value} className="flex cursor-pointer items-start gap-3 text-base">
                      <input type="radio" name="mostValuable" value={option.value} required checked={answers.mostValuable === option.value}
                        onChange={e => update("mostValuable", e.target.value)}
                        className="mt-1 size-4 accent-[#A68428]" />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="feedback-confusing" className="mb-3 block font-display text-lg font-bold">
                  3. Was anything confusing, overwhelming, or in need of more explanation?
                </label>
                <textarea id="feedback-confusing" rows={3} maxLength={1500}
                  value={answers.confusing} onChange={e => update("confusing", e.target.value)}
                  className="w-full resize-y border border-[#BFB9AA] px-3 py-3 text-base outline-offset-2 focus:outline-[#AC8929]"
                  placeholder="A sentence or two is perfect (optional)." />
              </div>

              <div>
                <label htmlFor="feedback-question" className="mb-3 block font-display text-lg font-bold">
                  4. What question would you have asked during Q&amp;A?
                </label>
                <textarea id="feedback-question" rows={3} maxLength={1500}
                  value={answers.question} onChange={e => update("question", e.target.value)}
                  className="w-full resize-y border border-[#BFB9AA] px-3 py-3 text-base outline-offset-2 focus:outline-[#AC8929]"
                  placeholder="I'll review your question personally (optional)." />
              </div>

              <div>
                <label htmlFor="feedback-action" className="mb-3 block font-display text-lg font-bold">
                  5. What's one thing you feel better prepared to do after the webinar?
                </label>
                <textarea id="feedback-action" rows={3} maxLength={1500}
                  value={answers.nextAction} onChange={e => update("nextAction", e.target.value)}
                  className="w-full resize-y border border-[#BFB9AA] px-3 py-3 text-base outline-offset-2 focus:outline-[#AC8929]"
                  placeholder="Your next step (optional)." />
              </div>

              <div className="absolute -left-[10000px]" aria-hidden="true">
                <label htmlFor="feedback-website">Website</label>
                <input id="feedback-website" name="website" tabIndex={-1} autoComplete="off"
                  value={answers.website} onChange={e => update("website", e.target.value)} />
              </div>

              <p className="text-xs leading-relaxed text-[#5E5E5E]">
                Your feedback is shared privately with Tabitha for webinar improvement and answering questions.
                Submitting this survey does not subscribe you to additional marketing emails.
              </p>
              {status === "error" && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
              <button type="submit" disabled={status === "sending"}
                className="flex w-full items-center justify-center gap-2 bg-[#121212] px-6 py-4 text-base font-semibold text-[#F1D78C] transition hover:bg-[#343026] disabled:cursor-wait disabled:opacity-70">
                {status === "sending" ? <><Loader2 className="size-5 animate-spin" /> Sending feedback...</> : <>Send My Feedback <ArrowRight className="size-5" /></>}
              </button>
            </form>
          </>
        )}
      </main>
      <footer className="border-t border-[#E2D7BD] py-6 text-center text-xs text-[#6B634E]">
        © 2026 Kingdom Solutions AI™ · Building in the right order
      </footer>
    </div>
  );
}
