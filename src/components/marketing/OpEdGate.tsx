import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { requestOpEd } from "@/lib/op-eds/request.functions";
import type { Attribution } from "@/lib/op-eds/useAttribution";
import { cn } from "@/lib/utils";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "done"; url: string | null; note?: string }
  | { kind: "error"; message: string };

interface OpEdGateProps {
  slug: string;
  title: string;
  accentVar: string;
  attribution: Attribution;
  onEvent: (e: "op_ed_submit" | "op_ed_pdf_open" | "op_ed_briefing_click", once?: boolean) => void;
}

export function OpEdGate({ slug, title, accentVar, attribution, onEvent }: OpEdGateProps) {
  const submit = useServerFn(requestOpEd);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ kind: "submitting" });
    try {
      const res = await submit({
        data: {
          slug,
          name: String(fd.get("name") ?? ""),
          role: String(fd.get("role") ?? ""),
          organisation: String(fd.get("organisation") ?? ""),
          email: String(fd.get("email") ?? ""),
          website: String(fd.get("website") ?? ""),
          userAgent: navigator.userAgent,
          ...attribution,
        },
      });
      if (res.ok) {
        onEvent("op_ed_submit");
        setState({
          kind: "done",
          url: res.url ?? null,
          note: "note" in res ? res.note : undefined,
        });
      } else {
        setState({ kind: "error", message: res.error ?? "Could not send the request." });
      }
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error && err.message ? err.message : "Could not send the request.",
      });
    }
  }

  if (state.kind === "done") {
    return (
      <div
        className="border-t border-b border-line-200 bg-paper-0 px-8 py-10"
        style={{ borderLeft: `2px solid var(${accentVar})` }}
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          Yours to read
        </div>
        <h3 className="mt-4 max-w-xl font-serif text-[27px] leading-tight text-ink-950">{title}</h3>
        {state.url ? (
          <a
            href={state.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onEvent("op_ed_pdf_open")}
            className="btn-primary px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] mt-6 inline-flex"
          >
            Open the PDF
          </a>
        ) : (
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-700">
            {state.note ?? "The PDF is being finalised. We will send it to you directly."}
          </p>
        )}
        <div className="mt-10 border-t border-line-200 pt-6">
          <p className="max-w-xl text-[15px] leading-relaxed text-ink-700">
            If the argument holds for your government, the next step is a confidential briefing with
            a named principal — not a demonstration and not a sales call.
          </p>
          <a
            href="/#briefing"
            onClick={() => onEvent("op_ed_briefing_click")}
            className="btn-secondary px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] mt-5 inline-flex"
          >
            Request a Cabinet briefing
          </a>
        </div>
      </div>
    );
  }

  const submitting = state.kind === "submitting";

  return (
    <form
      id="read-the-full-argument"
      onSubmit={onSubmit}
      className="border-t border-b border-line-200 bg-paper-0 px-8 py-10"
      style={{ borderLeft: `2px solid var(${accentVar})` }}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
        Read the full argument
      </div>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-700">
        Four fields. The PDF opens immediately. We do not sell, share or rent this list, and there
        is no sequence of follow-up mail.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <GateField name="name" label="Your name" autoComplete="name" />
        <GateField name="role" label="Role or title" placeholder="e.g. Cabinet Secretary" />
        <GateField
          name="organisation"
          label="Government or organisation"
          autoComplete="organization"
        />
        <GateField name="email" label="Email" type="email" autoComplete="email" />
      </div>

      {/* Honeypot */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" name="website" />
        </label>
      </div>

      <div aria-live="polite">
        {state.kind === "error" ? (
          <p className="mt-6 font-mono text-[12px] uppercase tracking-[0.14em] text-signal-negative">
            {state.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] mt-8 inline-flex"
      >
        {submitting ? "One moment…" : "Read the full argument"}
      </button>
    </form>
  );
}

function GateField(props: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
        {props.label}
      </span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        required
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        className={cn(
          "block w-full border-0 border-b border-line-200 bg-transparent",
          "px-0 py-2 text-[15px] text-ink-950 placeholder:text-ink-300",
          "focus:border-ink-700 focus:outline-none",
        )}
      />
    </label>
  );
}
