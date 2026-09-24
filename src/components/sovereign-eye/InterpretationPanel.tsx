import { Pin, X } from "lucide-react";

import { Explain } from "@/components/explain/Explain";

import type { MapFeature } from "./RegionMap";

export function InterpretationPanel({ feature, pinned, onClose, onEvidence }: {
  feature: MapFeature | null;
  pinned: boolean;
  onClose?: () => void;
  onEvidence?: () => void;
}) {
  return (
    <section className="absolute bottom-5 left-5 z-10 w-[min(27rem,calc(100%-2.5rem))] border border-ink-950 bg-paper-0/95 p-4 shadow-sm backdrop-blur" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
            {pinned ? <Pin size={11} aria-hidden /> : null}
            {pinned ? "Pinned · what this means" : "What this means"}
          </p>
          <h3 className="mt-1 font-serif text-xl text-ink-950">{feature?.title ?? "Read the map"}</h3>
        </div>
        {pinned ? (
          <button type="button" className="btn-ghost h-8 w-8 p-0" onClick={onClose} aria-label="Close pinned interpretation">
            <X size={14} aria-hidden />
          </button>
        ) : null}
      </div>

      {feature ? (
        <div className="mt-3 grid gap-3 text-xs leading-relaxed">
          <InterpretationRow label="Signal" value={feature.signal} />
          <InterpretationRow label="Current reading" value={`${feature.value}${feature.meta ? ` · ${feature.meta}` : ""}`} />
          <InterpretationRow label="Trend" value={feature.trend} explain />
          <InterpretationRow label="Economic meaning" value={feature.impact} />
          <InterpretationRow label="Forecast" value={feature.forecast} explain />
          {feature.provenance ? <InterpretationRow label="Confidence & source" value={feature.provenance} /> : null}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-ink-600">Hover or focus a map mark or legend item. Click or tap to keep its explanation here.</p>
      )}

      {feature && onEvidence && feature.kind !== "place" && feature.kind !== "legend" ? (
        <button type="button" className="btn-secondary mt-4 min-h-8 px-3 text-[10px]" onClick={onEvidence}>View supporting evidence</button>
      ) : null}
    </section>
  );
}

function InterpretationRow({ label, value, explain = false }: { label: string; value: string; explain?: boolean }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 border-t border-line-100 pt-2 first:border-t-0 first:pt-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
      {explain ? (
        <Explain id="sovereign-eye.interpretation" ctx={{ label, value }} mark={false} className="text-ink-700">{value}</Explain>
      ) : <p className="text-ink-700">{value}</p>}
    </div>
  );
}