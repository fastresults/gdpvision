import type { VizOverview } from "@/lib/country-viz/viz.functions";
import { sectorColor } from "./sector-color";
import { SectorTrendBars } from "./SectorTrendBars";
import {
  buildSectorRows,
  momentumChipClass,
  riskDotClasses,
} from "./sector-rows";
import { momentumLabel } from "./momentum";

export function KpiSmallMultiples({
  countryCode,
  sectors,
  series,
  allKpis,
  selected,
  onSelect,
}: {
  countryCode: string;
  sectors: VizOverview["sectors"];
  series: VizOverview["sectorKpiSeries"];
  allKpis: VizOverview["allKpis"];
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  const rows = buildSectorRows(countryCode, sectors, series, allKpis);
  const visible = selected ? rows.filter((r) => r.code === selected) : rows;

  if (!visible.length) {
    return (
      <div className="rounded border border-line-200 p-6 text-center text-xs text-ink-500">
        No sectors committed yet. Commit sector composition (stage 3) to populate.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {visible.map((r, i) => {
        const color = sectorColor(r.hue_token, i);
        const isSelected = selected === r.code;
        return (
          <button
            key={r.code}
            onClick={() => onSelect(isSelected ? null : r.code)}
            className={`group relative overflow-hidden rounded border p-3 text-left transition ${
              isSelected ? "border-ink-950 shadow-sm" : "border-line-200 hover:border-ink-500"
            }`}
          >
            {/* Header row */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                <span className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                  {r.code}
                </span>
              </div>
              <span className="shrink-0 text-[10px] tabular-nums text-ink-500">
                {r.share_pct.toFixed(1)}%
              </span>
            </div>

            {/* Title */}
            <div className="mt-1 truncate font-medium text-ink-950" title={r.label}>
              {r.label}
            </div>

            {/* Bars */}
            <div className="mt-3 h-14">
              <SectorTrendBars
                buckets={r.buckets}
                color={color}
                ariaLabel={`${r.label} 24-month trend`}
              />
            </div>

            {/* Momentum + risk + confidence */}
            <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <span
                className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${momentumChipClass(
                  r.momentum,
                )}`}
              >
                {momentumLabel(r.momentum)}
              </span>
              <div className="flex items-center gap-1 justify-self-center">
                {riskDotClasses(r.risk).map((cls, idx) => (
                  <span key={idx} className={`h-1.5 w-1.5 rounded-full ${cls}`} />
                ))}
              </div>
              <span className="font-mono text-[10px] tabular-nums text-ink-500">
                {r.confidence}
              </span>
            </div>

            {/* Footer: KPI latest / target */}
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-ink-500">
              <span className="min-w-0 truncate" title={r.kpi_label ?? ""}>
                {r.kpi_label ?? (r.hasSeries ? "" : "modelled trend")}
              </span>
              <span className="shrink-0 tabular-nums">
                {r.latest != null ? r.latest.toFixed(2) : "—"} {r.unit ?? ""}
                {r.target != null && (
                  <span className="ml-1 text-ink-500/70">/ {r.target.toFixed(2)}</span>
                )}
              </span>
            </div>

            {!r.hasSeries && (
              <span className="pointer-events-none absolute right-2 top-2 rounded border border-line-200 bg-paper-0 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-ink-500">
                modelled
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
