// Figure 3 — the term. Cumulative uplift against cumulative cost, month by
// month, over the government's remaining term (from the Mandate Compact's
// election cycle) or five years where no cycle is on record. The central line
// follows the chosen stance; the dashed line is the conservative stance.
// Uplift ramps 35 / 75 / 100 per cent over years one to three, then holds.

import { computeValue, formatUsd, type ValueInput, type ValueResult } from "@/lib/calculator/model";

import { Figure, Key, MONO, type BriefPalette } from "./shared";

export function termSeries(result: ValueResult, months: number) {
  const up: number[] = [];
  const cost: number[] = [];
  let u = 0;
  let c = 0;
  for (let m = 1; m <= months; m++) {
    const year = Math.min(3, Math.ceil(m / 12));
    u += (result.path[year - 1]?.usd ?? 0) / 12;
    // Each year's cost is committed at its start; year one carries the uplift.
    if (m % 12 === 1) c += m === 1 ? result.yearOneCostUsd : result.annualCostUsd;
    up.push(u);
    cost.push(c);
  }
  const breakEven = up.findIndex((v, i) => v >= cost[i]!);
  return { up, cost, breakEven: breakEven >= 0 ? breakEven + 1 : null };
}

export function termMonths(termMonthsRemaining: number | null | undefined) {
  return termMonthsRemaining != null && termMonthsRemaining >= 6
    ? Math.min(72, termMonthsRemaining)
    : 60;
}

export function Term({
  input,
  result,
  termMonthsRemaining,
  palette,
  n = 3,
}: {
  input: ValueInput;
  result: ValueResult;
  termMonthsRemaining: number | null;
  palette: BriefPalette;
  n?: number;
}) {
  const months = termMonths(termMonthsRemaining);
  const fromCycle = termMonthsRemaining != null && termMonthsRemaining >= 6;
  const central = termSeries(result, months);
  const cons = termSeries(computeValue({ ...input, stance: "conservative" }), months);
  const showCons = input.stance !== "conservative";

  const W = 640;
  const H = 240;
  const L = 8;
  const R = 70;
  const TOP = 14;
  const BASE = H - 28;
  const max = Math.max(1, ...central.up, ...central.cost) * 1.06;
  const x = (m: number) => L + ((W - L - R) * m) / months;
  const y = (v: number) => BASE - ((BASE - TOP) * v) / max;
  const line = (s: number[]) =>
    s.map((v, i) => `${i === 0 ? "M" : "L"}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const endUp = central.up[months - 1] ?? 0;
  const endCost = central.cost[months - 1] ?? 0;

  return (
    <Figure
      n={n}
      title={fromCycle ? "Within the remaining term" : "Over five years"}
      caption={`${fromCycle ? `${months} months remain in the current term, from the Mandate Compact's election cycle.` : "No election cycle is on record, so the view runs five years."} By the end of it, cumulative uplift of ${formatUsd(endUp)} against cumulative instrument cost of ${formatUsd(endCost)}, each year counted when it is committed${central.breakEven ? `; the lines cross in month ${central.breakEven}` : "; the lines do not cross in this window"}${showCons && cons.breakEven ? ` (month ${cons.breakEven} at the conservative stance)` : ""}. The national platform build is costed separately.`}
      legend={
        <>
          <Key colour={palette.accent} label="Cumulative uplift" />
          {showCons ? <Key colour={palette.accent} label="Conservative" dashed /> : null}
          <Key colour={palette.compare} label="Cumulative cost" />
        </>
      }
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Cumulative uplift against cost over ${months} months`}
      >
        <line x1={L} x2={W - R} y1={BASE} y2={BASE} stroke={palette.rule} />
        {Array.from({ length: Math.floor(months / 12) }, (_, i) => (i + 1) * 12).map((m) => (
          <g key={m}>
            <line
              x1={x(m)}
              x2={x(m)}
              y1={TOP}
              y2={BASE}
              stroke={palette.rule}
              strokeDasharray="2 3"
            />
            <text
              x={x(m)}
              y={BASE + 14}
              fontSize="9.5"
              textAnchor="middle"
              fill={palette.muted}
              fontFamily={MONO}
            >
              Y{m / 12}
            </text>
          </g>
        ))}
        <path d={line(central.cost)} fill="none" stroke={palette.compare} strokeWidth={2} />
        {showCons ? (
          <path
            d={line(cons.up)}
            fill="none"
            stroke={palette.accent}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        ) : null}
        <path d={line(central.up)} fill="none" stroke={palette.accent} strokeWidth={2.5} />
        {central.breakEven ? (
          <g>
            <circle
              cx={x(central.breakEven)}
              cy={y(central.up[central.breakEven - 1]!)}
              r={4}
              fill="#fff"
              stroke={palette.ink}
              strokeWidth={1.5}
            />
            <text
              x={x(central.breakEven) + 7}
              y={y(central.up[central.breakEven - 1]!) - 7}
              fontSize="9.5"
              fill={palette.ink}
              fontFamily={MONO}
            >
              Month {central.breakEven}
            </text>
          </g>
        ) : null}
        <text x={W - R + 6} y={y(endUp) + 3} fontSize="10" fill={palette.ink} fontFamily={MONO}>
          {formatUsd(endUp).replace("US$", "")}
        </text>
        <text x={W - R + 6} y={y(endCost) + 3} fontSize="10" fill={palette.muted} fontFamily={MONO}>
          {formatUsd(endCost).replace("US$", "")}
        </text>
      </svg>
    </Figure>
  );
}
