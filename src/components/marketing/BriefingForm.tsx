import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitBriefingRequest } from "@/lib/briefing.functions";
import { CARICOM_OECS_REGISTRY } from "@/lib/caricom-registry";
import { cn } from "@/lib/utils";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function BriefingForm() {
  const submit = useServerFn(submitBriefingRequest);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      role: String(fd.get("role") ?? ""),
      government: String(fd.get("government") ?? ""),
      nation: String(fd.get("nation") ?? ""),
      email: String(fd.get("email") ?? ""),
      message: String(fd.get("message") ?? ""),
      website: String(fd.get("website") ?? ""),
    };
    setState({ kind: "submitting" });
    try {
      const res = await submit({ data: payload });
      if (res.ok) {
        setState({ kind: "ok" });
      } else {
        setState({ kind: "error", message: res.error ?? "Could not send the request." });
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Could not send the request.";
      setState({ kind: "error", message });
    }
  }

  if (state.kind === "ok") {
    return (
      <div className="bg-paper-0 border-t border-b border-line-200 py-10 px-8">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          Received
        </div>
        <p className="mt-4 font-serif text-[27px] leading-tight text-ink-950 max-w-xl">
          Received. OPEN Interactive will respond within one working day.
        </p>
        <p className="mt-4 text-[15px] text-ink-700 max-w-xl">
          Every request is reviewed by a named principal. Nothing about your
          enquiry is shared outside OPEN Interactive.
        </p>
      </div>
    );
  }

  const submitting = state.kind === "submitting";

  return (
    <form onSubmit={onSubmit} className="bg-paper-0 border-t border-b border-line-200 py-8 px-8">
      <div className="grid gap-6 md:grid-cols-2">
        <Field name="name" label="Your name" required autoComplete="name" />
        <Field name="role" label="Role or title" required placeholder="e.g. Cabinet Secretary" />
        <Field
          name="government"
          label="Government or ministry"
          required
          placeholder="e.g. Office of the Prime Minister"
        />
        <NationField />
        <Field name="email" label="Official email" required type="email" autoComplete="email" />
        <div className="md:col-span-2">
          <TextArea name="message" label="Context (optional)" placeholder="One or two sentences on what you would like the briefing to cover." />
        </div>
      </div>

      {/* Honeypot */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" name="website" />
        </label>
      </div>

      {state.kind === "error" ? (
        <p
          role="alert"
          className="mt-6 font-mono text-[12px] uppercase tracking-[0.14em] text-signal-negative"
        >
          {state.message}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "inline-flex items-center justify-center px-6 py-3",
            "bg-ink-950 text-paper-0 font-mono text-[12px] uppercase tracking-[0.18em]",
            "border border-ink-950 transition-colors duration-200",
            "hover:bg-gold-500 hover:border-gold-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
        >
          {submitting ? "Sending…" : "Request a briefing"}
        </button>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
          Confidential — government use
        </p>
      </div>
    </form>
  );
}

function labelClass() {
  return "block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500 mb-2";
}

function inputClass() {
  return cn(
    "block w-full bg-transparent border-0 border-b border-line-200",
    "px-0 py-2 text-[15px] text-ink-950 placeholder:text-ink-300",
    "focus:border-ink-700 focus:outline-none",
  );
}

function Field(props: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className={labelClass()}>{props.label}{props.required ? " *" : ""}</span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        required={props.required}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        className={inputClass()}
      />
    </label>
  );
}

function TextArea(props: { name: string; label: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className={labelClass()}>{props.label}</span>
      <textarea
        name={props.name}
        rows={3}
        placeholder={props.placeholder}
        className={cn(inputClass(), "resize-none")}
      />
    </label>
  );
}

function NationField() {
  return (
    <label className="block">
      <span className={labelClass()}>Nation *</span>
      <select name="nation" required defaultValue="" className={inputClass()}>
        <option value="" disabled>
          Select from the CARICOM / OECS registry
        </option>
        <optgroup label="CARICOM full members">
          {CARICOM_OECS_REGISTRY.filter((n) => n.tier === "caricom-full").map((n) => (
            <option key={n.code} value={n.code}>{n.name}</option>
          ))}
        </optgroup>
        <optgroup label="CARICOM associate members">
          {CARICOM_OECS_REGISTRY.filter((n) => n.tier === "caricom-associate").map((n) => (
            <option key={n.code} value={n.code}>{n.name}</option>
          ))}
        </optgroup>
        <optgroup label="OECS associate members">
          {CARICOM_OECS_REGISTRY.filter((n) => n.tier === "oecs-associate").map((n) => (
            <option key={n.code} value={n.code}>{n.name}</option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
