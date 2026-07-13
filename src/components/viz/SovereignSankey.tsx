// Sovereign Capital Flow — Sankey.
// Living data: LEFT = sector GDP shares, CENTER = Consolidated GDP,
// RIGHT = ministry stewardship (Σ sector share × ministry weight).
import { useMemo, useState } from "react";
import type { VizOverview } from "@/lib/country-viz/viz.functions";
import { sectorColor } from "./sector-color";

type Node = {
  id: string;
  label: string;
  side: "L" | "M" | "R";
  value: number;
  color: string;
  y: number;
  h: number;
};
type Flow = { from: string; to: string; value: number; color: string };

const W = 1200;
const H = 620;
const PAD_X = 24;
const NODE_W = 22;
const GAP = 8;
const COL_L = PAD_X;
const COL_M = W / 2 - NODE_W / 2;
const COL_R = W - PAD_X - NODE_W;

function layoutColumn(nodes: Node[], total: number, topPad = 20, botPad = 20) {
  const usable = H - topPad - botPad - GAP * Math.max(0, nodes.length - 1);
  let y = topPad;
  for (const n of nodes) {
    n.h = Math.max(2, (n.value / total) * usable);
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

export function SovereignSankey({ overview }: { overview: VizOverview }) {
  const [hover, setHover] = useState<string | null>(null);

  const built = useMemo(() => {
    const sectors = overview.sectors.filter((s) => s.share_pct > 0);
    if (!sectors.length || !overview.ministries.length) return null;

    // LEFT nodes: sectors, value = share_pct
    const leftNodes: Node[] = sectors.map((s, i) => ({
      id: `L:${s.code}`,
      label: s.label,
      side: "L",
      value: s.share_pct,
      color: sectorColor(s.hue_token, i),
      y: 0, h: 0,
    }));
    const totalL = leftNodes.reduce((a, n) => a + n.value, 0);

    // RIGHT nodes: ministries, value = Σ (sector.share × weight of ministry on that sector)
    const sectorShare = new Map(sectors.map((s) => [s.code, s.share_pct]));
    const rightMap = new Map<string, number>();
    for (const row of overview.ministrySectorMatrix) {
      const share = sectorShare.get(row.sector_code);
      if (!share) continue;
      rightMap.set(row.ministry_slug, (rightMap.get(row.ministry_slug) ?? 0) + share * row.weight);
    }
    let rightNodes: Node[] = overview.ministries
      .map((m, i) => ({
        id: `R:${m.slug}`,
        label: m.name,
        side: "R" as const,
        value: rightMap.get(m.slug) ?? 0,
        color: `var(--sector-${((i % 12) + 1).toString().padStart(2, "0")})`,
        y: 0, h: 0,
      }))
      .filter((n) => n.value > 0)
      .sort((a, b) => b.value - a.value);
    if (!rightNodes.length) return null;

    // Normalize right side to equal totalL (Treasury conservation)
    const totalR = rightNodes.reduce((a, n) => a + n.value, 0);
    const scale = totalL / totalR;
    rightNodes = rightNodes.map((n) => ({ ...n, value: n.value * scale }));

    // CENTER node
    const center: Node = {
      id: "M:treasury",
      label: "Consolidated Treasury",
      side: "M",
      value: totalL,
      color: "var(--sector-02)",
      y: 20, h: H - 40,
    };

    layoutColumn(leftNodes, totalL);
    layoutColumn(rightNodes, totalL);

    // Flows L → M (proportional to node value)
    const flows: Array<Flow & { x0: number; y0: number; h0: number; x1: number; y1: number; h1: number }> = [];
    let midCursorL = center.y;
    for (const n of leftNodes) {
      const h = (n.value / totalL) * center.h;
      flows.push({
        from: n.id, to: center.id, value: n.value, color: n.color,
        x0: COL_L + NODE_W, y0: n.y, h0: n.h,
        x1: COL_M, y1: midCursorL, h1: h,
      });
      midCursorL += h;
    }
    // Flows M → R
    let midCursorR = center.y;
    for (const n of rightNodes) {
      const h = (n.value / totalL) * center.h;
      flows.push({
        from: center.id, to: n.id, value: n.value, color: n.color,
        x0: COL_M + NODE_W, y0: midCursorR, h0: h,
        x1: COL_R, y1: n.y, h1: n.h,
      });
      midCursorR += h;
    }

    return { leftNodes, rightNodes, center, flows, totalL };
  }, [overview]);

  if (!built) {
    return (
      <div className="rounded border border-line-200 bg-paper-0 p-8 text-center text-sm text-ink-500">
        Sovereign flow needs sector shares + ministry mapping (stages 3 & 5).
      </div>
    );
  }

  const { leftNodes, rightNodes, center, flows, totalL } = built;
  const isDim = (id: string) => hover !== null && hover !== id && !flows.some((f) => (f.from === hover && f.to === id) || (f.to === hover && f.from === id));

  return (
    <div className="rounded border border-line-200 bg-paper-0 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Chart C</div>
          <h3 className="font-serif text-lg">Sovereign Capital Flow</h3>
          <div className="text-xs text-ink-500">
            Sectors → Consolidated Treasury → Ministry stewardship. Widths mirror GDP share and ministry-sector weights.
          </div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 tabular-nums">
          Total mapped share · {totalL.toFixed(1)}%
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHover(null)}>
        {/* Flows */}
        <g>
          {flows.map((f, i) => {
            const active = hover === f.from || hover === f.to;
            return (
              <path
                key={i}
                d={ribbon(f.x0, f.y0, f.h0, f.x1, f.y1, f.h1)}
                fill={f.color}
                opacity={hover === null ? 0.38 : active ? 0.7 : 0.08}
                style={{ transition: "opacity 120ms" }}
              />
            );
          })}
        </g>
        {/* Nodes */}
        {[...leftNodes, center, ...rightNodes].map((n) => {
          const x = n.side === "L" ? COL_L : n.side === "M" ? COL_M : COL_R;
          const dim = isDim(n.id);
          return (
            <g key={n.id} onMouseEnter={() => setHover(n.id)} style={{ cursor: "pointer" }}>
              <rect x={x} y={n.y} width={NODE_W} height={n.h} fill={n.color} opacity={dim ? 0.25 : 1} />
              {n.side === "M" ? (
                <>
                  <text x={x + NODE_W / 2} y={n.y + n.h / 2 - 6} textAnchor="middle" className="fill-ink-950 font-mono text-[11px] uppercase tracking-[0.14em]" fontWeight={600}>
                    Consolidated
                  </text>
                  <text x={x + NODE_W / 2} y={n.y + n.h / 2 + 8} textAnchor="middle" className="fill-ink-950 font-mono text-[11px] uppercase tracking-[0.14em]" fontWeight={600}>
                    Treasury
                  </text>
                  <text x={x + NODE_W / 2} y={n.y + n.h / 2 + 26} textAnchor="middle" className="fill-ink-700 font-mono text-[10px] tabular-nums">
                    {n.value.toFixed(1)}%
                  </text>
                </>
              ) : n.h > 10 ? (
                <text
                  x={n.side === "L" ? x - 6 : x + NODE_W + 6}
                  y={n.y + n.h / 2}
                  dominantBaseline="middle"
                  textAnchor={n.side === "L" ? "end" : "start"}
                  className="fill-ink-800 text-[11px]"
                  opacity={dim ? 0.35 : 1}
                >
                  <tspan fontWeight={500}>{n.label}</tspan>
                  <tspan className="fill-ink-500 tabular-nums" dx={6}>{n.value.toFixed(1)}%</tspan>
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
        <span>← Sector inputs</span>
        <span>Treasury</span>
        <span>Ministry stewardship →</span>
      </div>
    </div>
  );
}
