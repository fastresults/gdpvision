// Figure 1 — where value is held up. Each pool the model can act on, as a
// share of GDP, for the country (bar) against the regional median (tick),
// where the region's figures are known. Pools are addressable losses, not the
// uplift: the uplift is a bounded fraction of them.

import { POOL_LABEL, computePools, type PoolKey, type ValueInput } from "@/lib/calculator/model";
import type { CountryFacts } from "@/lib/calculator/facts.server";

import { Figure, Key, MONO, type BriefPalette } from "./shared";

/** Which framing inputs each pool depends on (besides GDP). */
const DEPENDS: Record<PoolKey, Array<keyof ValueInput>> = {
  latency: ["publicSpendPct", "latencyMonths"],
  unmeasured: ["publicSpendPct", "unmeasuredPct"],
  commitment: ["publicSpendPct", "decisionsPerQuarter"],
  fdi: [],
  concentration: ["topSectorSharePct"],
  service_friction: ["publicSpendPct", "servicesOfflinePct"],
  sector_drift: ["unplannedPrioritySharePct"],
};

const REGIONAL_FACT: Partial<Record<keyof ValueInput, string>> = {
  publicSpendPct: "public_spend",
  latencyMonths: "latency",
  decisionsPerQuarter: "cabinet",
  topSectorSharePct: "top_sector",
};

export function regionalInput(input: ValueInput, facts: CountryFacts | null) {
  const known = new Set<keyof ValueInput>();
  const out: ValueInput = { ...input };
  for (const [field, key] of Object.entries(REGIONAL_FACT) as Array<[keyof ValueInput, string]>) {
    const r = facts?.facts.find((f) => f.key === key)?.regional;
    if (r) {
      (out[field] as number) = r.value;
      known.add(field);
    }
  }
  return { input: out, known };
}

export function HeldUp({
  input,
  facts,
  palette,
  n = 1,
}: {
  input: ValueInput;
  facts: CountryFacts | null;
  palette: BriefPalette;
  n?: number;
}) {
  const gdp = Math.max(1, input.gdpUsd);
  const own = computePools(input);
  const reg = regionalInput(input, facts);
  const region = computePools(reg.input);
  const rows = (Object.keys(POOL_LABEL) as PoolKey[])
    .map((k) => {
      const comparable = DEPENDS[k].length > 0 && DEPENDS[k].every((f) => reg.known.has(f));
      return {
        k,
        label: POOL_LABEL[k],
        own: (own[k] / gdp) * 100,
        region: comparable ? (region[k] / gdp) * 100 : null,
      };
    })
    .sort((a, b) => b.own - a.own);
  const max = Math.max(0.5, ...rows.map((r) => Math.max(r.own, r.region ?? 0))) * 1.1;

  const W = 640;
  const LABEL = 300;
  const VAL = 64;
  const ROW = 30;
  const H = rows.length * ROW + 20;
  const x = (v: number) => LABEL + ((W - LABEL - VAL) * v) / max;
  const regionName = facts?.region && facts.region !== "reference" ? facts.region : "regional";

  return (
    <Figure
      n={n}
      title="Where value is held up"
      caption={`Each pool is value the state already loses, as a share of GDP. The tick is the ${regionName} median where the region's figures are on record; pools with no regional record carry no tick. The uplift is a bounded fraction of these pools, not their sum.`}
      legend={
        <>
          <Key colour={palette.accent} label={facts?.name ?? "This country"} />
          <Key colour={palette.compare} label={`${regionName} median`} />
        </>
      }
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Pools of held-up value as a share of GDP"
      >
        <line x1={LABEL} y1={0} x2={LABEL} y2={H - 14} stroke={palette.rule} />
        {rows.map((r, i) => {
          const y = i * ROW + 6;
          return (
            <g key={r.k}>
              <text x={0} y={y + 13} fontSize="11" fill={palette.ink}>
                {r.label}
              </text>
              <rect
                x={LABEL}
                y={y + 4}
                width={Math.max(1, x(r.own) - LABEL)}
                height={11}
                fill={palette.accent}
              />
              {r.region != null ? (
                <line
                  x1={x(r.region)}
                  x2={x(r.region)}
                  y1={y}
                  y2={y + 19}
                  stroke={palette.compare}
                  strokeWidth={3}
                />
              ) : null}
              <text
                x={W}
                y={y + 13}
                fontSize="11"
                textAnchor="end"
                fill={palette.ink}
                fontFamily={MONO}
              >
                {r.own.toFixed(2)}%
              </text>
            </g>
          );
        })}
        <text x={LABEL} y={H - 2} fontSize="9.5" fill={palette.muted} fontFamily={MONO}>
          0
        </text>
        <text
          x={W - VAL}
          y={H - 2}
          fontSize="9.5"
          textAnchor="end"
          fill={palette.muted}
          fontFamily={MONO}
        >
          {max.toFixed(1)}% of GDP
        </text>
      </svg>
    </Figure>
  );
}
