import { ExternalLink } from "lucide-react";

import type { SovereignEyeEvidence, SovereignEyeFlow, SovereignEyeKpi, SovereignEyeSector } from "@/lib/sovereign-eye.functions";

function fmt(value: number | null, unit = "") {
  if (value == null) return "—";
  return `${value.toFixed(2)}${unit ? ` ${unit}` : ""}`;
}

export function EvidencePanel({
  kpis,
  sectors,
  flows,
  evidence,
}: {
  kpis: SovereignEyeKpi[];
  sectors: SovereignEyeSector[];
  flows: SovereignEyeFlow[];
  evidence: SovereignEyeEvidence;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div className="border border-line-200 bg-card">
        <div className="border-b border-line-200 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Evidence board</p>
          <h2 className="mt-1 font-serif text-2xl text-ink-950">Country signals</h2>
        </div>
        <div className="grid gap-0 lg:grid-cols-3">
          <div className="border-b border-line-200 p-5 lg:border-b-0 lg:border-r">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">Macro</h3>
            <ul className="mt-4 space-y-3">
              {kpis.slice(0, 6).map((kpi, index) => (
                <li key={`${kpi.code}-${kpi.period ?? "none"}-${index}`} className="border-b border-line-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm text-ink-600">{kpi.label}</p>
                  <p className="font-serif text-xl text-ink-950" data-numeric>{fmt(kpi.value, kpi.unit)}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">{kpi.period ?? "No period"} · {kpi.visibility}</p>
                </li>
              ))}
              {kpis.length === 0 && <li className="text-sm text-ink-500">No KPI rows are committed yet.</li>}
            </ul>
          </div>
          <div className="border-b border-line-200 p-5 lg:border-b-0 lg:border-r">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">Sectors</h3>
            <ul className="mt-4 space-y-3">
              {sectors.slice(0, 6).map((sector) => (
                <li key={sector.code}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm text-ink-700">{sector.label}</p>
                    <p className="font-mono text-[10px] text-ink-950" data-numeric>{sector.share.toFixed(2)}%</p>
                  </div>
                  <div className="mt-1 h-1 bg-line-100">
                    <div className="h-full bg-gold-500" style={{ width: `${Math.max(3, Math.min(100, sector.share))}%` }} />
                  </div>
                </li>
              ))}
              {sectors.length === 0 && <li className="text-sm text-ink-500">No sector composition is committed yet.</li>}
            </ul>
          </div>
          <div className="p-5">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">Capital</h3>
            <ul className="mt-4 space-y-3">
              {flows.slice(0, 6).map((flow, index) => (
                <li key={`${flow.nodeKey}-${flow.period}-${flow.side}-${index}`} className="border-b border-line-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm text-ink-700">{flow.label}</p>
                  <p className="font-serif text-xl text-ink-950" data-numeric>US${flow.valueUsdM.toFixed(2)}m</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">{flow.side} · {flow.confidence} · {flow.visibility}</p>
                </li>
              ))}
              {flows.length === 0 && <li className="text-sm text-ink-500">No capital-flow ledger is committed yet.</li>}
            </ul>
          </div>
        </div>
      </div>
      <div className="border border-line-200 bg-card">
        <div className="border-b border-line-200 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Corpus</p>
          <h2 className="mt-1 font-serif text-2xl text-ink-950">Sources and memory</h2>
        </div>
        <div className="max-h-[520px] overflow-y-auto p-5">
          <ul className="space-y-3">
            {evidence.sources.map((source, index) => (
              <li key={`${source.org}-${source.title}-${source.url ?? "none"}-${index}`} className="border border-line-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-base text-ink-950">{source.title}</p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">{source.kind} · {source.visibility} · quality {source.quality ?? "—"}</p>
                  </div>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer" className="btn-ghost h-8 w-8 p-0" aria-label={`Open ${source.title}`}>
                      <ExternalLink size={14} strokeWidth={1.5} />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
            {evidence.memory.map((item, index) => (
              <li key={`${item.kind}-${item.title}-${item.updatedAt ?? "none"}-${index}`} className="border border-line-200 p-3">
                <p className="font-serif text-base text-ink-950">{item.title}</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">{item.kind} · weight {item.weight.toFixed(2)} · {item.visibility}</p>
              </li>
            ))}
            {evidence.sources.length + evidence.memory.length === 0 && (
              <li className="border border-dashed border-line-200 p-4 text-sm text-ink-500">No source or memory rows are available for this country yet.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}