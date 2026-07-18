import type { ThreatBrief } from "@/lib/fdi-resilience.functions";
import { Sparkles } from "lucide-react";

export function ThreatBriefCard({ brief }: { brief: ThreatBrief }) {
  if (!brief.bullets?.length) {
    return (
      <div className="border border-dashed border-line-200 p-6 text-sm text-ink-500">
        No AI framing yet.
      </div>
    );
  }
  return (
    <div className="border border-line-200 bg-paper-100/40 p-5">
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        <Sparkles size={12} /> AI framing
        {brief.ai_model && <span className="ml-auto text-ink-500/70">{brief.ai_model}</span>}
      </p>
      <ul className="mt-4 space-y-4">
        {brief.bullets.map((b, i) => (
          <li key={i} className="grid grid-cols-[120px_1fr] gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              {b.label}
            </span>
            <p className="text-sm text-ink-950">{b.body}</p>
          </li>
        ))}
      </ul>
      {brief.citations?.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {brief.citations.map((c) => (
            <span
              key={c.n}
              className="inline-flex items-center gap-1 border border-line-200 bg-paper-0 px-2 py-0.5 font-mono text-[10px] text-ink-700"
              title={c.title ?? undefined}
            >
              [{c.n}] {c.org ?? "src"}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
