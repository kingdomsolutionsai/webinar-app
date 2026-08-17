import { LionMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Public opt-out landing page. Reached only from an email footer link, which
 * carries the address and a signature. No login, because a person unsubscribing
 * should never be asked to authenticate first.
 */
export default function Unsubscribe() {
  const params = new URLSearchParams(window.location.search);
  const email = params.get("e") ?? "";
  const token = params.get("t") ?? "";

  const run = trpc.registration.unsubscribe.useMutation();
  // Guard against React's double-invoke in development running this twice.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (!email || !token) return;
    fired.current = true;
    run.mutate({ email, token });
  }, [email, token, run]);

  const missing = !email || !token;
  const failed = missing || (run.data && !run.data.ok) || run.isError;
  const done = run.data?.ok === true;

  return (
    <div className="flex min-h-screen flex-col bg-ink">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
        <div className="border border-gold/30 bg-paper px-8 py-11 text-center sm:px-12">
          <LionMark size={58} className="mx-auto" />

          {run.isPending && !failed ? (
            <>
              <Loader2 className="mx-auto mt-7 size-5 animate-spin text-navy/50" />
              <p className="mt-5 font-serif text-[15px] text-ink/65">One moment.</p>
            </>
          ) : null}

          {done ? (
            <>
              <div className="mx-auto mt-7 flex size-11 items-center justify-center border border-green/40 bg-green/10">
                <Check className="size-5 text-green" strokeWidth={2.5} />
              </div>
              <h1 className="mt-6 font-display text-[27px] font-black leading-[1.15] text-navy">
                {run.data?.firstName
                  ? `You are unsubscribed, ${run.data.firstName}.`
                  : "You are unsubscribed."}
              </h1>
              <div className="mx-auto mt-5 h-[3px] w-16 bg-gold" />
              <p className="mt-6 font-serif text-[17px] leading-relaxed text-ink/75">
                No further emails will be sent to this address. Anything you have already
                downloaded remains yours to keep.
              </p>
              <p className="mt-4 font-serif text-[15px] leading-relaxed text-ink/55">
                If this was a mistake, you are welcome back any time — simply sign up again.
              </p>
            </>
          ) : null}

          {failed && !run.isPending ? (
            <>
              <div className="mx-auto mt-7 flex size-11 items-center justify-center border border-gold/50 bg-gold/10">
                <TriangleAlert className="size-5 text-gold-dark" strokeWidth={2.2} />
              </div>
              <h1 className="mt-6 font-display text-[25px] font-black leading-[1.18] text-navy">
                We could not confirm that link.
              </h1>
              <div className="mx-auto mt-5 h-[3px] w-16 bg-gold" />
              <p className="mt-6 font-serif text-[17px] leading-relaxed text-ink/75">
                The link may have been shortened or broken by your email program. Please write
                to{" "}
                <a
                  href="mailto:tabitha@kingdomsolutionsai.com?subject=Unsubscribe"
                  className="text-navy underline decoration-gold decoration-2 underline-offset-4">
                  tabitha@kingdomsolutionsai.com
                </a>{" "}
                and you will be removed by hand, promptly.
              </p>
            </>
          ) : null}

          <Button
            asChild
            variant="outline"
            className="mt-9 rounded-none border-navy/25 bg-transparent font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-navy hover:bg-navy hover:text-white">
            <a href="/">Return to the page</a>
          </Button>
        </div>

        <p className="mt-7 text-center font-sans text-[10px] uppercase tracking-[0.28em] text-white/35">
          Kingdom Solutions AI&trade;
        </p>
      </div>
    </div>
  );
}
