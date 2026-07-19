// Dense Sector Profiling Matrix — Sovereign Pulse–style table.

import type { VizOverview } from "@/lib/country-viz/viz.functions";
import { sectorColor } from "./sector-color";
import { SectorTrendBars } from "./SectorTrendBars";
import {
  buildSectorRows,
  momentumChipClass,
  riskDotClasses,
} from "./sector-rows";
import { momentumLabel } from "./momentum";

export function SectorProfilingMatrix({
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
  const rows = buildSectorRows(countryCode, sectors, series, allKpis).sort(
    (a, b) => b.share_pct - a.share_pct,
  );

  if (!rows.length) return null;

  return (
    <div className="rounded border border-line-200">
      {/* Header */}
      <div className="hidden grid-cols-[minmax(0,2fr)_80px_minmax(140px,1.5fr)_120px_80px_80px] items-center gap-3 border-b border-line-200 bg-paper-50/50 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-ink-500 md:grid">
        <div>Sector</div>
        <div className="text-right">GDP Share</div>
        <div>24-mo trend</div>
        <div>Momentum</div>
        <div className="text-center">Risk</div>
        <div className="text-right">Data Conf.</div>
      </div>

      <ul className="divide-y divide-line-200">
        {rows.map((r, i) => {
          const color = sectorColor(r.hue_token, i);
          const isSelected = selected === r.code;
          return (
            <li key={r.code}>
              <button
                onClick={() => onSelect(isSelected ? null : r.code)}
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left transition hover:bg-paper-50/50 md:grid-cols-[minmax(0,2fr)_80px_minmax(140px,1.5fr)_120px_80px_80px] ${
                  isSelected ? "bg-paper-50/70" : ""
                }`}
              >
                {/* Sector cell */}
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded"
                    style={{ background: `color-mix(in oklab, ${color} 18%, transparent)` }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink-950" title={r.label}>
                      {r.label}
                    </div>
                    {r.kpi_label && (
                      <div className="truncate text-[11px] text-ink-500/80">
                        {r.kpi_label}
                      </div>
                    )}
                  </div>
                </div>

                {/* GDP share — mobile: inline chip; desktop: dedicated column */}
                <div className="shrink-0 text-right text-sm tabular-nums md:hidden" style={{ color }}>
                  {r.share_pct.toFixed(1)}%
                </div>
                <div
                  className="hidden text-right text-sm tabular-nums md:block"
                  style={{ color }}
                >
                  {r.share_pct.toFixed(1)}%
                </div>

                {/* Bars — desktop column; on mobile it drops below */}
                <div className="col-span-2 h-7 md:col-span-1">
                  <SectorTrendBars
                    buckets={r.buckets}
                    color={color}
                    height={28}
                    ariaLabel={`${r.label} 24-month trend`}
                  />
                </div>

                {/* Momentum */}
                <div className="col-span-2 md:col-span-1">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${momentumChipClass(
                      r.momentum,
                    )}`}
                  >
                    {momentumLabel(r.momentum)}
                  </span>
                  {!r.hasSeries && (
                    <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-ink-500/70">
                      modelled
                    </span>
                  )}
                </div>

                {/* Risk dots */}
                <div className="hidden items-center justify-center gap-1 md:flex">
                  {riskDotClasses(r.risk).map((cls, idx) => (
                    <span key={idx} className={`h-1.5 w-1.5 rounded-full ${cls}`} />
                  ))}
                </div>

                {/* Confidence */}
                <div className="hidden text-right font-mono text-sm tabular-nums text-ink-700 md:block">
                  {r.confidence}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
