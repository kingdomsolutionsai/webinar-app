import { cn } from "@/lib/utils";
import { BOOK_COVER_URL, LION_MARK_URL } from "@shared/event";

// The single source of truth lives in shared/event.ts, because the server needs
// the same paths to build absolute image URLs for email.
export const LION_MARK = LION_MARK_URL;
export const BOOK_COVER = BOOK_COVER_URL;

/**
 * The crowned lion mark. Always round and never enclosed in a square frame or
 * border — the mark's own gold ring is the frame.
 */
export function LionMark({
  size = 64,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={LION_MARK}
      alt="Kingdom Solutions AI"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("rounded-full object-contain", className)}
    />
  );
}

/** Small uppercase gold overline used above section headings. */
export function Overline({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-gold",
        className,
      )}>
      {children}
    </p>
  );
}

/** Short gold rule that sits beneath a heading. */
export function GoldRule({ className }: { className?: string }) {
  return <div className={cn("h-[3px] w-28 bg-gold", className)} />;
}

/** Full-width hairline divider with a centered lion mark. */
export function LionDivider({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-6", className)}>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/45" />
      <LionMark size={40} className="shrink-0 opacity-90" />
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/45" />
    </div>
  );
}

export function SectionHeading({
  overline,
  title,
  intro,
  invert = false,
  align = "left",
}: {
  overline: string;
  title: string;
  intro?: string;
  invert?: boolean;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
      )}>
      <Overline>{overline}</Overline>
      <h2
        className={cn(
          "mt-3 font-display text-3xl font-black leading-[1.12] tracking-[-0.015em] sm:text-4xl",
          invert ? "text-white" : "text-navy",
        )}>
        {title}
      </h2>
      <GoldRule className={cn("mt-5", align === "center" && "mx-auto")} />
      {intro ? (
        <p
          className={cn(
            "mt-6 font-serif text-lg leading-relaxed",
            invert ? "text-white/80" : "text-ink/80",
          )}>
          {intro}
        </p>
      ) : null}
    </div>
  );
}
