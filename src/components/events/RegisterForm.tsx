import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { registerForEvent, type RegisterOutcome } from "@/lib/events/events.functions";

const MESSAGES: Record<string, { title: string; body: string }> = {
  confirmed: { title: "You're in!", body: "Your place is confirmed. We'll be in touch with joining details before the event." },
  waitlist: { title: "You're on the waitlist", body: "This event is full. We'll contact you if a place opens up." },
  duplicate: { title: "Already registered", body: "This email address is already registered for this event." },
  closed: { title: "Registration has closed", body: "Registration for this event is no longer open." },
  not_found: { title: "Event not found", body: "This event is no longer available." },
  invalid: { title: "Please check your details", body: "Enter your full name and a valid email address." },
};

export function RegisterForm({ slug, open }: { slug: string; open: boolean }) {
  const register = useServerFn(registerForEvent);
  const qc = useQueryClient();
  const [result, setResult] = useState<RegisterOutcome | null>(null);
  const mut = useMutation({
    mutationFn: (data: Record<string, string>) => register({ data: { slug, ...data } as never }),
    onSuccess: (r) => {
      setResult(r);
      void qc.invalidateQueries({ queryKey: ["events", "detail", slug] });
    },
  });

  if (!open) {
    return (
      <div className="rounded-3xl border-4 border-ev-ink bg-ev-paper p-6">
        <h3 className="ev-display text-[36px]">Registration closed</h3>
        <p className="mt-2 text-[15px]">Registration for this event is no longer open.</p>
      </div>
    );
  }

  if (result) {
    const key = result.outcome === "ok" ? result.status : result.outcome;
    const m = MESSAGES[key] ?? MESSAGES.invalid;
    return (
      <div role="status" className="ev-rise rounded-3xl border-4 border-ev-ink bg-ev-mango p-6">
        <h3 className="ev-display text-[44px]">{m.title}</h3>
        <p className="mt-2 text-[15px] font-medium">{m.body}</p>
        {result.outcome !== "ok" && (
          <button type="button" className="ev-btn-outline mt-5" onClick={() => setResult(null)}>
            Back to the form
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      className="rounded-3xl border-4 border-ev-ink bg-ev-paper p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        mut.mutate(Object.fromEntries(Array.from(fd.entries()).map(([k, v]) => [k, String(v)])));
      }}
    >
      <h3 className="ev-display text-[40px]">Register</h3>
      <p className="mt-1 text-[14px]">Free to attend. No account needed.</p>
      <div className="mt-5 grid gap-4">
        <Field name="name" label="Full name" required autoComplete="name" />
        <Field name="email" label="Email" type="email" required autoComplete="email" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="organisation" label="Organisation" autoComplete="organization" />
          <Field name="role" label="Role" autoComplete="organization-title" />
        </div>
        <Field name="country" label="Country" autoComplete="country-name" />
        <label className="grid gap-1.5 text-[13px] font-bold uppercase tracking-wide">
          Dietary or access needs
          <textarea name="needs" rows={2} maxLength={1000} className="rounded-xl border-[3px] border-ev-ink bg-ev-paper px-3 py-2 text-[15px] font-normal normal-case tracking-normal focus:outline-none focus:ring-4 focus:ring-ev-mango" />
        </label>
      </div>
      {mut.error && <p role="alert" className="mt-4 text-[14px] font-bold text-ev-coral">{(mut.error as Error).message}</p>}
      <button type="submit" disabled={mut.isPending} className="ev-btn-primary mt-6 w-full justify-center">
        {mut.isPending ? "Saving…" : "Save my place"}
      </button>
    </form>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1.5 text-[13px] font-bold uppercase tracking-wide">
      {label}
      {props.required && <span className="sr-only"> (required)</span>}
      <input
        {...props}
        maxLength={props.type === "email" ? 320 : 200}
        className="rounded-xl border-[3px] border-ev-ink bg-ev-paper px-3 py-2.5 text-[15px] font-normal normal-case tracking-normal focus:outline-none focus:ring-4 focus:ring-ev-mango"
      />
    </label>
  );
}
