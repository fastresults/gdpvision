// Sovereign Capital Flow — Sankey (living data).
// Fed by country_capital_flows: inputs (BOP + fiscal receipts) → Consolidated Treasury → outputs.
import { useMemo, useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCapitalFlows, type CapitalFlowsOverview } from "@/lib/country-viz/flows.functions";
import { sectorColor } from "./sector-color";

type LaidNode = {
  key: string;
  label: string;
  side: "L" | "M" | "R";
  value: number;
  color: string;
  y: number;
  h: number;
  citations: Array<{ url: string; title?: string; domain?: string }>;
};

const W = 1400;
const H = 700;
const PAD_X = 24;
const NODE_W = 26;
const GAP = 10;
const COL_L = PAD_X;
const COL_M = W / 2 - NODE_W / 2;
const COL_R = W - PAD_X - NODE_W;

function layoutColumn(nodes: LaidNode[], total: number, topPad = 24, botPad = 24) {
  const usable = H - topPad - botPad - GAP * Math.max(0, nodes.length - 1);
  let y = topPad;
  for (const n of nodes) {
    n.h = Math.max(4, (n.value / total) * usable);
    n.y = y;
    y += n.h + GAP;
  }
}

function ribbon(x0: number, y0: number, h0: number, x1: number, y1: number, h1: number) {
  const cx = (x0 + x1) / 2;
  const top = `M${x0},${y0} C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  const bot = `L${x1},${y1 + h1} C${cx},${y1 + h1} ${cx},${y0 + h0} ${x0},${y0 + h0} Z`;
  return `${top} ${bot}`;
}

function fmtUsdM(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}B`;
  return `$${Math.round(n)}M`;
}

const flowsQuery = (code: string, fetchFn: (input: { data: { countryCode: string } }) => Promise<CapitalFlowsOverview>) =>
  queryOptions({
    queryKey: ["viz", "capital-flows", code],
    queryFn: () => fetchFn({ data: { countryCode: code } }),
    staleTime: 60_000,
  });

const FARM_TO_HOTEL_SHARE = 0.15; // default share of tourism spend reallocated from imports to local wages/agri

export function SovereignSankey({ countryCode }: { countryCode: string }) {
  const fetchFn = useServerFn(getCapitalFlows);
  const { data: overview } = useSuspenseQuery(flowsQuery(countryCode, fetchFn as any));
  const [hover, setHover] = useState<string | null>(null);
  const [farmToHotel, setFarmToHotel] = useState(false);

  const built = useMemo(() => {
    if (!overview.values.length) return null;
    const nodeByKey = new Map(overview.nodes.map((n) => [n.node_key, n]));

    const inputs: LaidNode[] = [];
    const outputs: LaidNode[] = [];
    for (const v of overview.values) {
      const reg = nodeByKey.get(v.node_key);
      if (!reg) continue;
      const node: LaidNode = {
        key: v.node_key,
        label: reg.label,
        side: reg.side === "input" ? "L" : "R",
        value: v.value_usd_m,
        color: sectorColor(reg.hue_token, reg.sort_order),
        y: 0, h: 0,
        citations: v.citations,
      };
      if (reg.side === "input") inputs.push(node);
      else outputs.push(node);
    }

    // Farm-to-Hotel: reshape flows by moving `shift` USD from IMPORT_LEAKAGE to WAGES_AGRI.
    if (farmToHotel) {
      const tourism = inputs.find((n) => n.key === "TOURISM_SPEND");
      const leak = outputs.find((n) => n.key === "IMPORT_LEAKAGE");
      const wages = outputs.find((n) => n.key === "WAGES_AGRI");
      if (tourism && leak && wages) {
        const shift = Math.min(leak.value, tourism.value * FARM_TO_HOTEL_SHARE);
        leak.value = Math.max(0, leak.value - shift);
        wages.value = wages.value + shift;
      }
    }
    inputs.sort((a, b) => b.value - a.value);
    outputs.sort((a, b) => b.value - a.value);

    const totalIn = inputs.reduce((a, n) => a + n.value, 0);
    const totalOut = outputs.reduce((a, n) => a + n.value, 0);
    const grand = Math.max(totalIn, totalOut);
    if (grand <= 0) return null;

    const center: LaidNode = {
      key: "TREASURY",
      label: "Consolidated Treasury",
      side: "M",
      value: grand,
      color: "var(--sector-02)",
      y: 24, h: H - 48,
      citations: [],
    };

    // Scale each side to the grand total so the treasury reads as a balanced pipe.
    const scaleIn = totalIn > 0 ? grand / totalIn : 1;
    const scaleOut = totalOut > 0 ? grand / totalOut : 1;
    inputs.forEach((n) => (n.value = n.value * scaleIn));
    outputs.forEach((n) => (n.value = n.value * scaleOut));

    layoutColumn(inputs, grand);
    layoutColumn(outputs, grand);

    type F = { from: string; to: string; color: string; x0: number; y0: number; h0: number; x1: number; y1: number; h1: number };
    const flows: F[] = [];
    let midL = center.y;
    for (const n of inputs) {
      const h = (n.value / grand) * center.h;
      flows.push({ from: n.key, to: center.key, color: n.color, x0: COL_L + NODE_W, y0: n.y, h0: n.h, x1: COL_M, y1: midL, h1: h });
      midL += h;
    }
    let midR = center.y;
    for (const n of outputs) {
      const h = (n.value / grand) * center.h;
      flows.push({ from: center.key, to: n.key, color: n.color, x0: COL_M + NODE_W, y0: midR, h0: h, x1: COL_R, y1: n.y, h1: n.h });
      midR += h;
    }

    return { inputs, outputs, center, flows, grand };
  }, [overview, farmToHotel]);

  if (!overview.diagnostics.hasData) {
    return (
      <div className="rounded border border-line-200 bg-paper-0 p-8 text-center text-sm text-ink-500">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 mb-1">Chart C</div>
        <div className="font-serif text-lg text-ink-950 mb-2">Sovereign Capital Flow</div>
        <p>No capital-flow ledger committed yet — run the <span className="font-mono">capital_flows</span> stage in onboarding.</p>
      </div>
    );
  }

  if (!built) return null;

  const { inputs, outputs, center, flows, grand } = built;
  const activeSet = hover
    ? new Set(
        flows
          .filter((f) => f.from === hover || f.to === hover)
          .flatMap((f) => [f.from, f.to])
          .concat([hover]),
      )
    : null;

  return (
    <div className="rounded border border-line-200 bg-paper-0 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Chart C</div>
          <h3 className="font-serif text-lg">Sovereign Capital Flow (Sankey)</h3>
          <div className="text-xs text-ink-500">
            Left inputs → Consolidated Treasury → Right destinations. All values in USD millions, {overview.period ?? "—"} fiscal year.
          </div>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 tabular-nums">
          {overview.availablePeriods.length > 1 && (
            <span>Periods: {overview.availablePeriods.slice(0, 4).join(" · ")}</span>
          )}
          {overview.diagnostics.reconciliationWarn && (
            <span className="rounded border border-signal-negative/50 bg-signal-negative/5 px-2 py-1 text-signal-negative">
              Reconciliation off {(overview.totals.residual_pct * 100).toFixed(0)}%
            </span>
          )}
          {overview.diagnostics.missingNodes.length > 0 && (
            <span className="rounded border border-line-200 px-2 py-1">
              Missing: {overview.diagnostics.missingNodes.slice(0, 3).join(", ")}
              {overview.diagnostics.missingNodes.length > 3 ? "…" : ""}
            </span>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHover(null)}>
        <g>
          {flows.map((f, i) => {
            const on = activeSet ? activeSet.has(f.from) && activeSet.has(f.to) : true;
            return (
              <path
                key={i}
                d={ribbon(f.x0, f.y0, f.h0, f.x1, f.y1, f.h1)}
                fill={f.color}
                opacity={activeSet ? (on ? 0.75 : 0.06) : 0.42}
                style={{ transition: "opacity 120ms" }}
              />
            );
          })}
        </g>

        {/* Left labels */}
        {inputs.map((n) => {
          const active = !activeSet || activeSet.has(n.key);
          return (
            <g key={n.key} onMouseEnter={() => setHover(n.key)} style={{ cursor: "pointer" }}>
              <rect x={COL_L} y={n.y} width={NODE_W} height={n.h} fill={n.color} opacity={active ? 1 : 0.25} />
              {n.h > 12 && (
                <text
                  x={COL_L + NODE_W + 8}
                  y={n.y + n.h / 2}
                  dominantBaseline="middle"
                  className="fill-ink-900 text-[12px]"
                  opacity={active ? 1 : 0.35}
                >
                  <tspan fontWeight={600}>{n.label}</tspan>
                  <tspan className="fill-ink-500 tabular-nums" dx={6}>· {fmtUsdM(n.value)}</tspan>
                </text>
              )}
            </g>
          );
        })}

        {/* Treasury center */}
        <g onMouseEnter={() => setHover(center.key)} style={{ cursor: "pointer" }}>
          <rect x={COL_M} y={center.y} width={NODE_W} height={center.h} fill={center.color} />
          <text x={COL_M + NODE_W / 2} y={center.y + center.h / 2 - 10} textAnchor="middle" className="fill-ink-950 font-mono text-[12px] uppercase tracking-[0.16em]" fontWeight={700}>
            Consolidated
          </text>
          <text x={COL_M + NODE_W / 2} y={center.y + center.h / 2 + 8} textAnchor="middle" className="fill-ink-950 font-mono text-[12px] uppercase tracking-[0.16em]" fontWeight={700}>
            Treasury
          </text>
          <text x={COL_M + NODE_W / 2} y={center.y + center.h / 2 + 28} textAnchor="middle" className="fill-ink-700 font-mono text-[11px] tabular-nums">
            {fmtUsdM(grand)}
          </text>
        </g>

        {/* Right labels */}
        {outputs.map((n) => {
          const active = !activeSet || activeSet.has(n.key);
          return (
            <g key={n.key} onMouseEnter={() => setHover(n.key)} style={{ cursor: "pointer" }}>
              <rect x={COL_R} y={n.y} width={NODE_W} height={n.h} fill={n.color} opacity={active ? 1 : 0.25} />
              {n.h > 12 && (
                <text
                  x={COL_R - 8}
                  y={n.y + n.h / 2}
                  dominantBaseline="middle"
                  textAnchor="end"
                  className="fill-ink-900 text-[12px]"
                  opacity={active ? 1 : 0.35}
                >
                  <tspan fontWeight={600}>{n.label}</tspan>
                  <tspan className="fill-ink-500 tabular-nums" dx={6}>· {fmtUsdM(n.value)}</tspan>
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex items-center justify-between gap-4 text-[11px] text-ink-500">
        <div className="flex items-center gap-3 font-mono uppercase tracking-[0.18em]">
          <span>Inputs · {fmtUsdM(overview.totals.inputs)}</span>
          <span>Outputs · {fmtUsdM(overview.totals.outputs)}</span>
          <span>Residual · {fmtUsdM(Math.abs(overview.totals.residual))}</span>
        </div>
        {hover && hover !== "TREASURY" && (() => {
          const v = overview.values.find((x) => x.node_key === hover);
          if (!v) return null;
          const cite = v.citations?.[0];
          return (
            <div className="tabular-nums">
              <span className="font-mono uppercase tracking-[0.14em]">{v.method}·{v.confidence_grade}</span>
              {cite?.url && (
                <>
                  {" · "}
                  <a href={cite.url} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-ink-950">
                    {cite.domain || cite.title || "source"}
                  </a>
                </>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
