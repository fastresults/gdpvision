import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X } from "lucide-react";

import { recordCalculatorLead } from "@/lib/calculator/request.functions";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string };

/**
 * The sliders are open to everyone. Only the carried document asks who you are.
 */
export function LeadDialog({
  open,
  onClose,
  country,
  configuration,
  onGranted,
}: {
  open: boolean;
  onClose: () => void;
  country: string;
  configuration: Record<string, unknown>;
  onGranted: () => void;
}) {
  const submit = useServerFn(recordCalculatorLead);
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    if (!open) return;
    setState({ kind: "idle" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ kind: "sending" });
    try {
      const res = await submit({
        data: {
          name: String(fd.get("name") ?? ""),
          role: String(fd.get("role") ?? ""),
          organisation: String(fd.get("organisation") ?? ""),
          email: String(fd.get("email") ?? ""),
          website: String(fd.get("website") ?? ""),
          country,
          configuration,
          userAgent: navigator.userAgent,
          referrer: document.referrer || undefined,
        },
      });
      if (!res.ok) {
        setState({ kind: "error", message: res.error ?? "Could not record the request." });
        return;
      }
      onGranted();
      onClose();
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error && err.message ? err.message : "Could not record the request.",
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 p-0 sm:items-center sm:p-6 print:hidden">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto border border-line-200 bg-paper-0">
        <div className="flex items-start justify-between border-b border-line-200 px-6 py-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              One-page justification
            </div>
            <h2 className="mt-3 font-serif text-[24px] leading-tight tracking-tight text-ink-950">
              Who should we address it to?
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 px-6 py-6">
          {[
            { name: "name", label: "Name", type: "text", autoComplete: "name" },
            { name: "role", label: "Role", type: "text", autoComplete: "organization-title" },
            { name: "organisation", label: "Ministry or organisation", type: "text", autoComplete: "organization" },
            { name: "email", label: "Official email", type: "email", autoComplete: "email" },
          ].map((f) => (
            <label key={f.name} className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                {f.label}
              </span>
              <input
                required
                name={f.name}
                type={f.type}
                autoComplete={f.autoComplete}
                className="mt-2 w-full border border-line-200 bg-paper-0 px-4 py-3 text-[15px] text-ink-950 placeholder:text-ink-300 focus:border-ink-950 focus:outline-none"
              />
            </label>
          ))}

          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="hidden"
          />

          {state.kind === "error" ? (
            <p className="text-[13.5px] leading-relaxed text-signal-negative">{state.message}</p>
          ) : null}

          <button
            type="submit"
            disabled={state.kind === "sending"}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] disabled:opacity-50"
          >
            {state.kind === "sending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Produce the document
          </button>

          <p className="text-[12px] leading-relaxed text-ink-500">
            The document opens in your browser's print dialogue; choose "Save as PDF". We hold your
            details to respond to a briefing enquiry and for nothing else.
          </p>
        </form>
      </div>
    </div>
  );
}
