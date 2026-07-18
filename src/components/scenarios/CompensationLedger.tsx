import { useMemo } from "react";
import type { CompensationSummary } from "@/lib/scenarios/compensation";

const SURPLUS = "var(--sector-06)"; // green-ish semantic
const DEFICIT = "var(--sector-04)"; // red-ish semantic

export function CompensationLedger({ summary }: { summary: CompensationSummary }) {
  const { perYear, regime, breakEvenYear, gapClosedPct, cumulativeEndPp } = summary;

  const geometry = useMemo(() => {
    const w = 640;
    const h = 96;
    const pad = { l: 40, r: 12, t: 10, b: 22 };
    const values = perYear.map((p) => p.cumulativePp);
    const max = Math.max(0.5, ...values, ...values.map((v) => -v));
    const y0 = pad.t + (h - pad.t - pad.b) / 2;
    const yScale = (v: number) => y0 - (v / max) * ((h - pad.t - pad.b) / 2);
    const xStep = perYear.length > 1 ? (w - pad.l - pad.r) / (perYear.length - 1) : 0;
    const x = (i: number) => pad.l + i * xStep;

    // Filled polyline from y0 down/up to cumulative value per year.
    const line = perYear
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yScale(p.cumulativePp).toFixed(1)}`)
      .join(" ");
    const area = `M${x(0)},${y0} ${perYear
      .map((p, i) => `L${x(i).toFixed(1)},${yScale(p.cumulativePp).toFixed(1)}`)
      .join(" ")} L${x(perYear.length - 1)},${y0} Z`;

    return { w, h, pad, y0, yScale, x, line, area, max };
  }, [perYear]);

  const regimeLabel =
    regime === "surplus"
      ? "Net surplus vs. baseline"
      : regime === "break_even"
      ? "At break-even"
      : regime === "deficit"
      ? "Levers offsetting deficit"
      : "At baseline — move a lever to see compensation";

  const regimeColor =
    regime === "surplus" ? SURPLUS : regime === "deficit" ? DEFICIT : "var(--ink-500)";

  const calloutPrimary = (() => {
    if (regime === "at_baseline") return "—";
    if (regime === "surplus")
      return `+${cumulativeEndPp.toFixed(2)} pp surplus by Y${perYear.length}`;
    if (regime === "break_even") return `Break-even Y${breakEvenYear ?? perYear.length}`;
    // deficit
    if (gapClosedPct !== null) return `Gap closed: ${gapClosedPct.toFixed(0)}%`;
    return `${cumulativeEndPp.toFixed(2)} pp short`;
  })();

  const calloutSub = (() => {
    if (regime === "surplus" && breakEvenYear)
      return `Crossed baseline in Y${breakEvenYear}`;
    if (regime === "deficit")
      return `Cumulative Δ ${cumulativeEndPp.toFixed(2)} pp at horizon end`;
    if (regime === "break_even")
      return `Cumulative Δ ${cumulativeEndPp.toFixed(2)} pp`;
    return "Baseline is your do-nothing reference";
  })();

  return (
    <div className="border border-line-200 bg-paper-0">
      <div className="flex items-center justify-between gap-3 border-b border-line-200 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: regimeColor }}
            aria-hidden
          />
          <p
            className="truncate font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: regimeColor }}
            aria-live="polite"
          >
            {regimeLabel}
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
          Compensation ledger · cumulative Δ vs baseline
        </p>
      </div>
      <div className="grid grid-cols-1 gap-0 md:grid-cols-[minmax(0,1fr)_220px]">
        {/* Strip */}
        <div className="relative min-w-0 px-2 py-2">
          <svg
            viewBox={`0 0 ${geometry.w} ${geometry.h}`}
            preserveAspectRatio="none"
            className="block h-24 w-full"
          >
            <rect x={0} y={0} width={geometry.w} height={geometry.h} fill="var(--paper-100)" />
            {/* Fill under/over the zero line, tinted by sign */}
            <defs>
              <clipPath id="above-zero">
                <rect x={0} y={0} width={geometry.w} height={geometry.y0} />
              </clipPath>
              <clipPath id="below-zero">
                <rect x={0} y={geometry.y0} width={geometry.w} height={geometry.h - geometry.y0} />
              </clipPath>
            </defs>
            <path d={geometry.area} fill={SURPLUS} opacity={0.28} clipPath="url(#above-zero)" />
            <path d={geometry.area} fill={DEFICIT} opacity={0.28} clipPath="url(#below-zero)" />
            {/* Zero break-even line */}
            <line
              x1={geometry.pad.l}
              x2={geometry.w - geometry.pad.r}
              y1={geometry.y0}
              y2={geometry.y0}
              stroke="var(--ink-950)"
              strokeWidth={0.75}
            />
            <text
              x={geometry.pad.l - 4}
              y={geometry.y0 + 3}
              textAnchor="end"
              className="fill-current font-mono text-[9px] text-ink-500"
            >
              0
            </text>
            {/* Cumulative line */}
            <path
              d={geometry.line}
              fill="none"
              stroke="var(--ink-950)"
              strokeWidth={1.25}
            />
            {/* Break-even marker */}
            {breakEvenYear !== null &&
              (() => {
                const idx = perYear.findIndex((p) => p.year === breakEvenYear);
                if (idx < 0) return null;
                return (
                  <g>
                    <line
                      x1={geometry.x(idx)}
                      x2={geometry.x(idx)}
                      y1={geometry.pad.t}
                      y2={geometry.h - geometry.pad.b}
                      stroke="var(--ink-950)"
                      strokeDasharray="2 3"
                      strokeWidth={0.75}
                    />
                    <circle cx={geometry.x(idx)} cy={geometry.y0} r={3} fill="var(--ink-950)" />
                  </g>
                );
              })()}
            {/* Year ticks */}
            {perYear.map((p, i) => (
              <text
                key={p.year}
                x={geometry.x(i)}
                y={geometry.h - 6}
                textAnchor="middle"
                className="fill-current font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500"
              >
                {p.year}
              </text>
            ))}
            {/* Per-year cumulative dots + labels */}
            {perYear.map((p, i) => (
              <g key={`d-${p.year}`}>
                <circle
                  cx={geometry.x(i)}
                  cy={geometry.yScale(p.cumulativePp)}
                  r={2.25}
                  fill={p.cumulativePp >= 0 ? SURPLUS : DEFICIT}
                />
              </g>
            ))}
          </svg>
        </div>
        {/* Callout */}
        <div className="flex flex-col justify-center border-t border-line-200 px-4 py-3 md:border-l md:border-t-0">
          <p
            className="font-serif text-[22px] leading-tight text-ink-950 tabular-nums"
            data-numeric
            style={{ color: regime === "surplus" ? SURPLUS : regime === "deficit" ? DEFICIT : undefined }}
          >
            {calloutPrimary}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            {calloutSub}
          </p>
        </div>
      </div>
    </div>
  );
}
