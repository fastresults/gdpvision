import type { VizOverview } from "@/lib/country-viz/viz.functions";
import { sectorColor } from "./sector-color";

export function KpiSmallMultiples({
  sectors,
  series,
  selected,
  onSelect,
}: {
  sectors: VizOverview["sectors"];
  series: VizOverview["sectorKpiSeries"];
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  const visible = selected ? sectors.filter((s) => s.code === selected) : sectors;
  if (!visible.length) {
    return (
      <div className="rounded border border-line-200 p-6 text-center text-xs text-ink-500">
        No sector KPI series available. Commit KPI history (stage 7) to populate.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {visible.map((s, i) => {
        const s0 = series.find((x) => x.sector_code === s.code);
        const color = sectorColor(s.hue_token, i);
        return (
          <button
            key={s.code}
            onClick={() => onSelect(selected === s.code ? null : s.code)}
            className={`text-left rounded border p-3 transition ${
              selected === s.code ? "border-ink-950" : "border-line-200 hover:border-ink-500"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{s.code}</span>
              <span className="ml-auto text-[10px] text-ink-500 tabular-nums">{s.share_pct.toFixed(1)}%</span>
            </div>
            <div className="mt-1 truncate font-medium text-ink-950" title={s.label}>{s.label}</div>
            <div className="mt-2 h-14">
              {s0 && s0.points.length >= 2 ? (
                <Sparkline points={s0.points} color={color} target={s0.target} />
              ) : (
                <div className="flex h-full items-center text-[10px] italic text-ink-500">no timeseries</div>
              )}
            </div>
            {s0 && (
              <div className="mt-1 flex items-center justify-between text-[10px] text-ink-500">
                <span className="truncate" title={s0.label}>{s0.label}</span>
                <span className="tabular-nums">{s0.latest != null ? s0.latest.toFixed(2) : "—"} {s0.unit}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Sparkline({ points, color, target }: { points: { period: string; value: number }[]; color: string; target: number | null }) {
  const W = 220, H = 56, pad = 4;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals, target ?? Infinity);
  const max = Math.max(...vals, target ?? -Infinity);
  const range = max - min || 1;
  const step = (W - pad * 2) / Math.max(1, points.length - 1);
  const y = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(pad + i * step).toFixed(2)},${y(p.value).toFixed(2)}`).join(" ");
  const targetY = target != null ? y(target) : null;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      {targetY != null && (
        <line x1={0} x2={W} y1={targetY} y2={targetY} stroke="var(--color-ink-500)" strokeDasharray="2 2" strokeWidth={0.5} />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={pad + (points.length - 1) * step} cy={y(last.value)} r={2.5} fill={color} />
    </svg>
  );
}
