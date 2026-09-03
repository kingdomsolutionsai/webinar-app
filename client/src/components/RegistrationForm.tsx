import { LionMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  MODE_COPY,
  THREE_TRACKS,
  type PageMode,
  type ResourceChoice,
  type ResourceId,
  type TrackId,
} from "@shared/event";
import { AlertCircle, Loader2, Mail } from "lucide-react";
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
  // Set once the signup call succeeds. Part One itself has not been sent
  // yet at this point — only the confirmation email has — so this screen asks
  // for a click on that link rather than offering a download.
  const [confirmedName, setConfirmedName] = useState<string | null>(null);
  // Only one free resource is offered at signup now, so this is fixed rather
  // than a visitor choice. The Readiness Checklist is a separate reward,
  // handed out only to people who attend the live session.
  const resource: ResourceId = "chapter";
  const register = trpc.registration.create.useMutation({
    onSuccess: data => {
      setConfirmedName(data.firstName);
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
    return (
      <div className="border border-gold bg-white p-8 sm:p-10">
        <div className="flex items-center gap-4">
          <LionMark size={48} />
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">
              Check your email
            </p>
            <h3 className="mt-1 font-display text-2xl font-black text-navy">
              Almost there, {confirmedName}.
            </h3>
          </div>
        </div>
        <div className="mt-7 h-[3px] w-14 bg-gold" />
        <p className="mt-7 font-serif text-[17px] leading-relaxed text-ink/80">
          I just sent a confirmation link to the address you entered. Click it and Part One
          of the book is sent straight to your inbox.
          {mode === "waitlist"
            ? " You will also be first to know when the live session is scheduled."
            : " That is also what locks in your seat for the session."}
        </p>
        <p className="mt-3 flex items-start gap-2 font-serif text-[15px] leading-relaxed text-ink/60">
          <Mail className="mt-1 size-3.5 shrink-0 text-gold" />
          If it has not arrived in a few minutes, please check your spam folder.
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
        {mode === "waitlist" ? "Free Resource" : "Registration"}
      </p>
      <h3 className="mt-2 font-display text-2xl font-black text-navy">{copy.formHeading}</h3>
      <div className="mt-5 h-[3px] w-14 bg-gold" />
      {mode === "waitlist" ? (
        <p className="mt-6 font-serif text-[16px] leading-relaxed text-ink/70">
          One quick email confirmation and it's yours, at no cost. You will also be first to
          know when the live session is scheduled.
        </p>
      ) : null}
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
            ? "Your details are used only to send Part One and announce the session. No sharing, no selling."
            : "Your details are used only for this session. No sharing, no selling."}
        </p>
      </form>
    </div>
  );
}
