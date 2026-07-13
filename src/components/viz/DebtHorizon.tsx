import type { VizOverview } from "@/lib/country-viz/viz.functions";

export function DebtHorizon({ series }: { series: VizOverview["fiscalSeries"] }) {
  const { debtToGdp, fiscalBalance } = series;
  if (!debtToGdp.length && !fiscalBalance.length) {
    return (
      <div className="rounded border border-line-200 p-6 text-center text-xs text-ink-500">
        Debt-to-GDP / fiscal balance series missing. Commit KPIs `debt_to_gdp` and `fiscal_balance_pct_gdp` with history.
      </div>
    );
  }

  const W = 900, H = 260, pad = { l: 40, r: 40, t: 20, b: 26 };
  const allX = Array.from(new Set([...debtToGdp.map((p) => p.period), ...fiscalBalance.map((p) => p.period)])).sort();
  const xIdx = new Map(allX.map((p, i) => [p, i]));
  const xStep = (W - pad.l - pad.r) / Math.max(1, allX.length - 1);
  const debtVals = debtToGdp.map((p) => p.value);
  const balVals = fiscalBalance.map((p) => p.value);
  const debtMax = Math.max(100, ...debtVals, 60);
  const debtMin = 0;
  const balMax = Math.max(5, ...balVals);
  const balMin = Math.min(-10, ...balVals);
  const yDebt = (v: number) => pad.t + (1 - (v - debtMin) / (debtMax - debtMin)) * (H - pad.t - pad.b);
  const yBal = (v: number) => pad.t + (1 - (v - balMin) / (balMax - balMin)) * (H - pad.t - pad.b);

  const debtPath = debtToGdp
    .map((p, i) => `${i === 0 ? "M" : "L"}${(pad.l + (xIdx.get(p.period) ?? 0) * xStep).toFixed(1)},${yDebt(p.value).toFixed(1)}`)
    .join(" ");
  const balPath = fiscalBalance
    .map((p, i) => `${i === 0 ? "M" : "L"}${(pad.l + (xIdx.get(p.period) ?? 0) * xStep).toFixed(1)},${yBal(p.value).toFixed(1)}`)
    .join(" ");

  const ceilingY = yDebt(60);

  return (
    <div className="rounded border border-line-200 bg-paper-0 p-4">
      <div className="mb-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Chart · Fiscal Horizon</div>
        <h3 className="font-serif text-lg">Debt-to-GDP + fiscal balance</h3>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Debt ceiling */}
        <line x1={pad.l} x2={W - pad.r} y1={ceilingY} y2={ceilingY} stroke="var(--color-signal-negative)" strokeDasharray="4 3" strokeWidth={1} opacity={0.7} />
        <text x={W - pad.r} y={ceilingY - 4} fontSize={10} textAnchor="end" fill="var(--color-signal-negative)">60% ceiling</text>

        {/* zero line for balance */}
        <line x1={pad.l} x2={W - pad.r} y1={yBal(0)} y2={yBal(0)} stroke="var(--color-ink-500)" strokeWidth={0.5} opacity={0.35} />

        <path d={debtPath} fill="none" stroke="var(--color-sector-01)" strokeWidth={2} />
        <path d={balPath} fill="none" stroke="var(--color-sector-06)" strokeWidth={2} strokeDasharray="3 2" />

        {allX.map((p, i) => (i % Math.ceil(allX.length / 8) === 0 ? (
          <text key={p} x={pad.l + i * xStep} y={H - 8} fontSize={9} fill="var(--color-ink-500)" textAnchor="middle">{p}</text>
        ) : null))}

        {/* Y left */}
        {[0, 30, 60, 90, 120].filter((v) => v <= debtMax).map((v) => (
          <g key={`dl${v}`}>
            <text x={pad.l - 6} y={yDebt(v) + 3} fontSize={9} textAnchor="end" fill="var(--color-ink-500)">{v}%</text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex gap-4 text-[10px] text-ink-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4" style={{ background: "var(--color-sector-01)" }} /> Debt / GDP (%)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: "var(--color-sector-06)" }} /> Fiscal balance (% GDP)</span>
      </div>
    </div>
  );
}
