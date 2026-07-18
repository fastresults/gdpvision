import type { Allocation, ResilienceAction, StrategyMetrics } from "@/lib/fdi-resilience.functions";
import { StatStrip } from "@/components/scenarios/StatStrip";
import { sectorColor } from "@/components/viz/sector-color";

type Sector = { code: string; label: string; hue_token?: string | null };

export function StressTestPanel({
  metrics,
  allocation,
  actions,
  sectors,
}: {
  metrics: StrategyMetrics;
  allocation: Allocation;
  actions: ResilienceAction[];
  sectors: Sector[];
}) {
  const bySector = new Map(sectors.map((s, i) => [s.code, { s, i }]));
  const totalExposure = allocation.entries.reduce(
    (s, e) => s + Math.max(0, e.exposure_delta_pp),
    0,
  );
  const contribs = allocation.entries
    .filter((e) => e.exposure_delta_pp > 0)
    .map((e) => {
      const closed = actions
        .filter((a) => a.sector_code === e.sector_code)
        .reduce((s, a) => s + a.target_pp, 0);
      return { sector_code: e.sector_code, exposure: e.exposure_delta_pp, closed };
    })
    .sort((a, b) => b.exposure - a.exposure);
  const maxBar = Math.max(totalExposure, 1);

  return (
    <div className="space-y-4">
      <StatStrip
        cells={[
          {
            label: "Exposure closed",
            value: `${metrics.exposure_closed_pp.toFixed(1)} pp`,
            sub: `of ${totalExposure.toFixed(1)} pp at risk`,
          },
          {
            label: "Residual risk",
            value: `${metrics.residual_risk_pp.toFixed(1)} pp`,
            sub: metrics.residual_risk_pp > 0 ? "not yet covered" : "fully covered",
          },
          {
            label: "Diversification (HHI Δ)",
            value: `${metrics.hhi_delta > 0 ? "+" : ""}${metrics.hhi_delta.toFixed(0)}`,
            sub: metrics.hhi_delta < 0 ? "more diverse" : "more concentrated",
          },
          {
            label: "Time to resilience",
            value: `${metrics.time_to_resilience_years} yr`,
            sub: `${metrics.ministries_engaged} ministries`,
          },
        ]}
      />

      <div className="border border-line-200 bg-paper-0 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Exposure → mitigation waterfall
        </p>
        <ul className="mt-4 space-y-3">
          {contribs.map((c) => {
            const meta = bySector.get(c.sector_code);
            const color = sectorColor(meta?.s.hue_token, meta?.i ?? 0);
            const closedPct = Math.min(100, (c.closed / c.exposure) * 100);
            return (
              <li key={c.sector_code}>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5" style={{ background: color }} />
                    {meta?.s.label ?? c.sector_code}
                  </span>
                  <span className="font-mono tabular-nums text-ink-700">
                    {c.closed.toFixed(1)} / {c.exposure.toFixed(1)} pp
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full bg-line-200">
                  <div
                    className="h-full bg-rose-500/30"
                    style={{ width: `${(c.exposure / maxBar) * 100}%` }}
                  >
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${closedPct}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
          {contribs.length === 0 && (
            <li className="text-sm text-ink-500">No exposure identified yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
