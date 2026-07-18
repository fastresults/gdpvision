import { Sparkles, RefreshCw } from "lucide-react";

import type { ThreatBrief } from "@/lib/fdi-resilience.functions";
import { CitationChipButton, ReadMore } from "./ReadMore";

export function ThreatBriefCard({
  brief,
  onRegenerate,
  regenerating,
}: {
  brief: ThreatBrief;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const hasBrief = !!brief.bullets?.length;

  if (!hasBrief) {
    return (
      <div className="border border-dashed border-line-200 bg-paper-100/40 p-6">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          <Sparkles size={12} /> Threat briefing
        </p>
        <h3 className="mt-3 font-serif text-lg text-ink-950">
          No briefing generated yet
        </h3>
        <p className="mt-1 max-w-xl text-sm text-ink-500">
          A briefing is a 3-bullet McKinsey-style framing of how this shock
          transmits, which sectors take the first hit, and where spillovers
          appear — grounded in the country's live GDP composition.
        </p>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="mt-4 inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-0 hover:opacity-90 disabled:opacity-40"
          >
            <Sparkles size={13} />
            {regenerating ? "Generating…" : "Generate briefing"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="border border-line-200 bg-paper-100/40 p-5">
      <div className="flex items-center gap-2">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          <Sparkles size={12} /> Threat briefing
        </p>
        {brief.ai_model && (
          <span className="font-mono text-[10px] text-ink-500/70">{brief.ai_model}</span>
        )}
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 hover:text-ink-950 disabled:opacity-40"
          >
            <RefreshCw size={11} className={regenerating ? "animate-spin" : undefined} />
            {regenerating ? "Regenerating…" : "Regenerate"}
          </button>
        )}
      </div>
      <ul className="mt-4 space-y-4">
        {brief.bullets.map((b, i) => (
          <li key={i} className="grid grid-cols-[120px_1fr] gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              {b.label}
            </span>
            <ReadMore
              title={b.label}
              text={b.body}
              clamp={4}
              className="text-sm text-ink-950"
            />
          </li>
        ))}
      </ul>
      {brief.citations?.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {brief.citations.map((c) => (
            <CitationChipButton
              key={c.n}
              n={c.n}
              org={c.org}
              title={c.title}
              url={c.url}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
