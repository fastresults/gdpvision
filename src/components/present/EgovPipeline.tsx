import { useEffect, useState } from "react";
import { PrettyJson } from "@/components/data/PrettyJson";
import { cn } from "@/lib/utils";

/**
 * Second Brain → sovereign boundary → country API → Chamber 09 → live eGov
 * site, lit one step at a time and looping. Click to pause / resume.
 */

const MICRO = "font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500";

const STEPS = [
  {
    k: "Second Brain",
    d: "Approved national figures, ministries, services and sources, each one cited.",
  },
  {
    k: "Sovereign boundary",
    d: "Only approved, public-grade findings pass. Private Vault rows never cross.",
  },
  {
    k: "Ongoing country API",
    d: "A versioned, keyed public feed that stays live as the record changes.",
  },
  {
    k: "Digital Government Studio · Chamber 09",
    d: "The site plan is drafted, signed off by named officials and branded.",
  },
  {
    k: "Live eGov site",
    d: "atg.gdpvision.com publishes. Refreshed from the record, the cycle repeats.",
  },
];

const SAMPLE = {
  endpoint: "/api/public/v1/countries/ATG/services",
  illustrative: true,
  items: [{ name: "Business registration", ministry: "Legal Affairs", source: "[1]" }],
  refreshed: "on every approved change",
};

export function EgovPipeline() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(STEPS.length - 1);
      return;
    }
    const t = window.setInterval(() => setStep((s) => (s + 1) % (STEPS.length + 1)), 2200);
    return () => window.clearInterval(t);
  }, [paused]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={paused}
      aria-label="Second Brain to eGov website pipeline. Click to pause or resume."
      onClick={() => setPaused((p) => !p)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPaused((p) => !p)}
      className="hover-intent relative cursor-pointer rounded-xl"
      data-held={paused || undefined}
    >
      <ol className="relative space-y-3">
        <span className="absolute left-[15px] top-4 bottom-4 w-px bg-line-200" aria-hidden />
        {STEPS.map((s, i) => {
          const lit = i <= step;
          const now = i === step;
          return (
            <li key={s.k} className="relative flex gap-4">
              <span
                className={cn(
                  "relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-colors duration-500",
                  lit ? "border-gold-500 bg-paper-0 text-ink-950" : "border-line-200 bg-paper-50 text-ink-300",
                  now && "ring-4 ring-gold-300/40",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div
                className={cn(
                  "min-w-0 flex-1 rounded-lg border px-4 py-3 transition-all duration-500",
                  lit ? "border-line-200 bg-paper-0 opacity-100" : "border-transparent opacity-45",
                  i === 1 && lit && "border-gold-500",
                )}
              >
                <div className="text-base text-ink-950">{s.k}</div>
                <p className="mt-1 text-sm leading-snug text-ink-700">{s.d}</p>
                {i === 2 && lit ? (
                  <div className="mt-3 rounded border border-line-100 bg-paper-50 p-2 text-xs" onClick={(e) => e.stopPropagation()}>
                    <div className={cn(MICRO, "mb-1")}>Sample response · illustrative</div>
                    <PrettyJson value={SAMPLE} showRaw={false} />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <ul className="mt-6 grid gap-2 sm:grid-cols-3">
        {["Always current, no re-typing", "Every figure traceable to its source", "Owned and approved by government"].map((t) => (
          <li key={t} className="border-t border-gold-500 pt-2 text-sm text-ink-900">
            {t}
          </li>
        ))}
      </ul>
      {paused ? <div className={cn(MICRO, "mt-3")}>Paused · click to resume</div> : null}
    </div>
  );
}
