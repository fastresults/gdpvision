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
  amount: number;
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

function fmtPct(part: number, total: number): string {
  if (!total) return "—";
  return `${((part / total) * 100).toFixed(1)}%`;
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
        amount: v.value_usd_m,
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
        const shift = Math.min(leak.amount, tourism.amount * FARM_TO_HOTEL_SHARE);
        leak.amount = Math.max(0, leak.amount - shift);
        wages.amount = wages.amount + shift;
        leak.value = leak.amount;
        wages.value = wages.amount;
      }
    }
    inputs.sort((a, b) => b.value - a.value);
    outputs.sort((a, b) => b.value - a.value);

    const totalIn = inputs.reduce((a, n) => a + n.amount, 0);
    const totalOut = outputs.reduce((a, n) => a + n.amount, 0);
    const grand = Math.max(totalIn, totalOut);
    if (grand <= 0) return null;

    const center: LaidNode = {
      key: "TREASURY",
      label: "Consolidated Treasury",
      side: "M",
      amount: grand,
      value: grand,
      color: "var(--sector-02)",
      y: 24, h: H - 48,
      citations: [],
    };

    // Scale each side to the grand total so the treasury reads as a balanced pipe.
    const scaleIn = totalIn > 0 ? grand / totalIn : 1;
    const scaleOut = totalOut > 0 ? grand / totalOut : 1;
    inputs.forEach((n) => (n.value = n.amount * scaleIn));
    outputs.forEach((n) => (n.value = n.amount * scaleOut));

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
          <button
            type="button"
            onClick={() => setFarmToHotel((v) => !v)}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] transition-colors ${
              farmToHotel
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                : "border-line-200 text-ink-500 hover:text-ink-950"
            }`}
            title={`Reallocate ${Math.round(FARM_TO_HOTEL_SHARE * 100)}% of tourism spend from imports to local wages / agriculture`}
          >
            Farm-to-Hotel: {farmToHotel ? "ACTIVE" : "INACTIVE"}
          </button>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseLeave={() => setHover(null)}
        onKeyDown={(e) => { if (e.key === "Escape") setHover(null); }}
      >
        <defs>
          <filter id="sankey-callout-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="2" result="off" />
            <feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g>
          {flows.map((f, i) => {
            const on = activeSet ? activeSet.has(f.from) && activeSet.has(f.to) : true;
            return (
              <path
                key={i}
                d={ribbon(f.x0, f.y0, f.h0, f.x1, f.y1, f.h1)}
                fill={f.color}
                opacity={activeSet ? (on ? 0.88 : 0.05) : 0.42}
                style={{ transition: "opacity 140ms" }}
                onMouseEnter={() => setHover(f.from === "TREASURY" ? f.to : f.from)}
              />
            );
          })}
        </g>

        {/* Left nodes */}
        {inputs.map((n) => {
          const active = !activeSet || activeSet.has(n.key);
          const focused = hover === n.key;
          const showInline = n.h > 12 && !hover;
          const showLeader = n.h < 14 && !hover;
          return (
            <g
              key={n.key}
              onMouseEnter={() => setHover(n.key)}
              onFocus={() => setHover(n.key)}
              onTouchStart={() => setHover(n.key)}
              tabIndex={0}
              style={{ cursor: "pointer", outline: "none" }}
            >
              <title>{`${n.label} — ${fmtUsdM(n.amount)} — ${fmtPct(n.amount, overview.totals.inputs)} of inputs`}</title>
              <rect
                x={COL_L}
                y={n.y}
                width={NODE_W}
                height={n.h}
                fill={n.color}
                opacity={active ? 1 : 0.22}
                stroke={focused ? "var(--ink-950, #0a0a0a)" : "none"}
                strokeWidth={focused ? 2 : 0}
                style={{ transition: "opacity 140ms" }}
              />
              {showInline && (
                <text
                  x={COL_L + NODE_W + 8}
                  y={n.y + n.h / 2}
                  dominantBaseline="middle"
                  className="fill-ink-900 text-[12px]"
                >
                  <tspan fontWeight={600}>{n.label}</tspan>
                  <tspan className="fill-ink-500 tabular-nums" dx={6}>· {fmtUsdM(n.amount)}</tspan>
                </text>
              )}
              {showLeader && (
                <g opacity={0.7}>
                  <line
                    x1={COL_L + NODE_W}
                    y1={n.y + n.h / 2}
                    x2={COL_L + NODE_W + 12}
                    y2={n.y + n.h / 2}
                    stroke="var(--ink-500, #6b7280)"
                    strokeDasharray="2 2"
                    strokeWidth={1}
                  />
                  <text
                    x={COL_L + NODE_W + 16}
                    y={n.y + n.h / 2}
                    dominantBaseline="middle"
                    className="fill-ink-500 text-[10px]"
                  >
                    {n.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Treasury center */}
        <g
          onMouseEnter={() => setHover(center.key)}
          onFocus={() => setHover(center.key)}
          tabIndex={0}
          style={{ cursor: "pointer", outline: "none" }}
        >
          <rect
            x={COL_M}
            y={center.y}
            width={NODE_W}
            height={center.h}
            fill={center.color}
            stroke={hover === "TREASURY" ? "var(--ink-950, #0a0a0a)" : "none"}
            strokeWidth={hover === "TREASURY" ? 2 : 0}
          />
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

        {/* Right nodes */}
        {outputs.map((n) => {
          const active = !activeSet || activeSet.has(n.key);
          const focused = hover === n.key;
          const showInline = n.h > 12 && !hover;
          const showLeader = n.h < 14 && !hover;
          return (
            <g
              key={n.key}
              onMouseEnter={() => setHover(n.key)}
              onFocus={() => setHover(n.key)}
              onTouchStart={() => setHover(n.key)}
              tabIndex={0}
              style={{ cursor: "pointer", outline: "none" }}
            >
              <title>{`${n.label} — ${fmtUsdM(n.amount)} — ${fmtPct(n.amount, overview.totals.outputs)} of outputs`}</title>
              <rect
                x={COL_R}
                y={n.y}
                width={NODE_W}
                height={n.h}
                fill={n.color}
                opacity={active ? 1 : 0.22}
                stroke={focused ? "var(--ink-950, #0a0a0a)" : "none"}
                strokeWidth={focused ? 2 : 0}
                style={{ transition: "opacity 140ms" }}
              />
              {showInline && (
                <text
                  x={COL_R - 8}
                  y={n.y + n.h / 2}
                  dominantBaseline="middle"
                  textAnchor="end"
                  className="fill-ink-900 text-[12px]"
                >
                  <tspan fontWeight={600}>{n.label}</tspan>
                  <tspan className="fill-ink-500 tabular-nums" dx={6}>· {fmtUsdM(n.amount)}</tspan>
                </text>
              )}
              {showLeader && (
                <g opacity={0.7}>
                  <line
                    x1={COL_R}
                    y1={n.y + n.h / 2}
                    x2={COL_R - 12}
                    y2={n.y + n.h / 2}
                    stroke="var(--ink-500, #6b7280)"
                    strokeDasharray="2 2"
                    strokeWidth={1}
                  />
                  <text
                    x={COL_R - 16}
                    y={n.y + n.h / 2}
                    dominantBaseline="middle"
                    textAnchor="end"
                    className="fill-ink-500 text-[10px]"
                  >
                    {n.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Hover callout */}
        {hover && (() => {
          const isTreasury = hover === "TREASURY";
          const node = isTreasury
            ? center
            : inputs.find((n) => n.key === hover) ?? outputs.find((n) => n.key === hover);
          if (!node) return null;
          const isLeft = node.side === "L";
          const isRight = node.side === "R";
          const total = isLeft ? overview.totals.inputs : isRight ? overview.totals.outputs : grand;
          const shareLabel = isTreasury
            ? "consolidated total"
            : isLeft ? "of inputs" : "of outputs";
          const v = isTreasury ? null : overview.values.find((x) => x.node_key === node.key);
          const cite = v?.citations?.[0];

          const CW = 300;
          const labelLen = node.label.length;
          const dynW = Math.max(CW, labelLen * 10 + 40);
          const CH = v?.notes ? 132 : 108;

          let cx: number;
          let anchor: "start" | "end" | "middle" = "start";
          if (isLeft) {
            cx = COL_L + NODE_W + 14;
            anchor = "start";
          } else if (isRight) {
            cx = COL_R - 14;
            anchor = "end";
          } else {
            cx = COL_M + NODE_W / 2;
            anchor = "middle";
          }
          const rectX = anchor === "start" ? cx - 12 : anchor === "end" ? cx - dynW + 12 : cx - dynW / 2;
          const centerY = node.y + node.h / 2;
          const rectY = Math.max(8, Math.min(H - CH - 8, centerY - CH / 2));
          const textX = anchor === "start" ? cx : anchor === "end" ? cx : cx;

          return (
            <g style={{ pointerEvents: "none", transition: "opacity 140ms", opacity: 1 }}>
              <rect
                x={rectX}
                y={rectY}
                width={dynW}
                height={CH}
                rx={8}
                fill="var(--paper-0, #ffffff)"
                stroke="var(--line-200, #e5e7eb)"
                strokeWidth={1}
                filter="url(#sankey-callout-shadow)"
              />
              <text
                x={textX}
                y={rectY + 26}
                textAnchor={anchor}
                className="fill-ink-950 text-[18px]"
                style={{ fontFamily: "var(--font-serif, Georgia, serif)", fontWeight: 600 }}
              >
                {node.label}
              </text>
              <text
                x={textX}
                y={rectY + 58}
                textAnchor={anchor}
                className="fill-ink-950 font-mono text-[24px] tabular-nums"
                fontWeight={700}
              >
                {fmtUsdM(node.amount)}
              </text>
              <text
                x={textX}
                y={rectY + 80}
                textAnchor={anchor}
                className="fill-ink-500 font-mono text-[11px] uppercase tracking-[0.16em] tabular-nums"
              >
                {isTreasury ? fmtUsdM(grand) : `${fmtPct(node.amount, total)} ${shareLabel}`}
              </text>
              {v && (
                <text
                  x={textX}
                  y={rectY + 100}
                  textAnchor={anchor}
                  className="fill-ink-500 font-mono text-[10px] uppercase tracking-[0.14em]"
                >
                  {v.method} · {v.confidence_grade}
                  {cite?.domain ? ` · ${cite.domain}` : ""}
                </text>
              )}
              {v?.notes && (
                <text
                  x={textX}
                  y={rectY + 120}
                  textAnchor={anchor}
                  className="fill-ink-600 text-[11px]"
                >
                  {v.notes.length > 60 ? v.notes.slice(0, 58) + "…" : v.notes}
                </text>
              )}
            </g>
          );
        })()}
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


      {overview.values.some((v) => v.method === "modelled" || /Formula:|Source basis:/i.test(v.notes ?? "")) && (
        <div className="mt-3 border-t border-line-200 pt-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Assumptions</div>
          <div className="grid gap-2 md:grid-cols-2">
            {overview.values
              .filter((v) => v.method === "modelled" || /Formula:|Source basis:/i.test(v.notes ?? ""))
              .map((v) => {
                const label = overview.nodes.find((n) => n.node_key === v.node_key)?.label ?? v.node_key;
                return (
                  <div key={`${v.node_key}-${v.period}`} className="border border-line-200 bg-paper-100/50 p-2 text-[11px] leading-relaxed text-ink-600">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="font-medium text-ink-950">{label}</span>
                      <span className="font-mono uppercase tracking-[0.14em] text-ink-500">{v.method} · {v.confidence_grade}</span>
                    </div>
                    {v.notes && <p className="line-clamp-4">{v.notes}</p>}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
