import { useMemo, useRef, useState } from "react";

import type { AllocationEntry } from "@/lib/fdi-resilience.functions";
import { sectorColor } from "@/components/viz/sector-color";
import { cn } from "@/lib/utils";
import { ExplainHover } from "./ExplainHover";
import { EXPLAIN } from "./explain-copy";

type Sector = { code: string; label: string; hue_token?: string | null };

export function ReallocationMarimekko({
  entries,
  sectors,
  onChange,
}: {
  entries: AllocationEntry[];
  sectors: Sector[];
  onChange: (next: AllocationEntry[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [view, setView] = useState<"bars" | "rings" | "slope">("bars");
  const [hover, setHover] = useState<string | null>(null);

  const bySector = useMemo(
    () => new Map(sectors.map((s, i) => [s.code, { s, i }])),
    [sectors],
  );

  function onHandlePointerDown(idx: number, e: React.PointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(idx);
  }

  function onHandlePointerMove(idx: number, e: React.PointerEvent) {
    if (dragging !== idx) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pctFromLeft = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    // sum of resilient_pct up to and including idx should equal pctFromLeft.
    const sumBefore = entries.slice(0, idx).reduce((s, e2) => s + e2.resilient_pct, 0);
    const newIdxPct = Math.max(0, pctFromLeft - sumBefore);
    const currentIdxPct = entries[idx].resilient_pct;
    const delta = newIdxPct - currentIdxPct;
    const next = entries.slice(0, idx + 1).map((e2) => ({ ...e2 }));
    next[idx].resilient_pct = Number(newIdxPct.toFixed(2));
    // take delta from the next sector (idx+1) if exists, distribute otherwise
    const rest = entries.slice(idx + 1).map((e2) => ({ ...e2 }));
    if (rest.length > 0) {
      const restSum = rest.reduce((s, r) => s + r.resilient_pct, 0);
      const newRestSum = Math.max(0, restSum - delta);
      const scale = restSum > 0 ? newRestSum / restSum : 0;
      rest.forEach((r) => {
        r.resilient_pct = Number((r.resilient_pct * scale).toFixed(2));
      });
    }
    onChange([...next, ...rest]);
  }

  function onHandlePointerUp(e: React.PointerEvent) {
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    setDragging(null);
  }

  return (
    <div className="border border-line-200 bg-paper-0 p-4">
      <div className="flex items-baseline justify-between">
        <ExplainHover copy={EXPLAIN.marimekko} side="bottom">
          <p className="cursor-help font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 underline decoration-dotted decoration-line-200 underline-offset-4">
            <span className="mr-1 text-ink-950">2</span>· Reshape the mix · FDI envelope reallocation
          </p>
        </ExplainHover>
        <p className="font-mono text-[10px] text-ink-500">drag between sectors →</p>
      </div>

      <div role="tablist" aria-label="Visualization mode" className="mt-4 flex gap-1 border-b border-line-200">
        {([
          ["bars", "Stacked bars"],
          ["rings", "Twin rings"],
          ["slope", "Slope shift"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={view === k}
            onClick={() => setView(k)}
            className={cn(
              "-mb-px border-b-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
              view === k ? "border-ink-950 text-ink-950" : "border-transparent text-ink-500 hover:text-ink-950",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "bars" && (
        <>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Current</p>
      <StackedBar entries={entries} field="current_pct" bySector={bySector} />

      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
        Resilient (drag handles below)
      </p>
      <div ref={containerRef} className="relative">
        <StackedBar entries={entries} field="resilient_pct" bySector={bySector} />
        {/* handles between segments */}
        <div className="pointer-events-none absolute inset-0">
          {entries.slice(0, -1).map((_, idx) => {
            const left = entries.slice(0, idx + 1).reduce((s, e) => s + e.resilient_pct, 0);
            return (
              <div
                key={idx}
                className="absolute top-0 h-full"
                style={{ left: `${left}%`, transform: "translateX(-50%)" }}
              >
                <button
                  type="button"
                  onPointerDown={(e) => onHandlePointerDown(idx, e)}
                  onPointerMove={(e) => onHandlePointerMove(idx, e)}
                  onPointerUp={onHandlePointerUp}
                  onPointerCancel={onHandlePointerUp}
                  className={cn(
                    "pointer-events-auto grid h-full w-3 cursor-ew-resize place-items-center",
                    dragging === idx && "bg-paper-0/30",
                  )}
                  aria-label="Drag to reallocate"
                >
                  <span className="h-full w-[2px] bg-paper-0" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

        </>
      )}
      {view === "rings" && (
        <TwinRings entries={entries} bySector={bySector} hover={hover} setHover={setHover} />
      )}
      {view === "slope" && (
        <SlopeShift entries={entries} bySector={bySector} hover={hover} setHover={setHover} />
      )}
      {view !== "bars" && (
        <p className="mt-2 font-mono text-[10px] text-ink-500">
          Switch to Stacked bars to drag and reallocate.
        </p>
      )}

      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-3 lg:grid-cols-4">
        {entries.map((e, i) => {
          const meta = bySector.get(e.sector_code);
          const color = sectorColor(meta?.s.hue_token, meta?.i ?? i);
          const delta = e.resilient_pct - e.current_pct;
          return (
            <li
              key={e.sector_code}
              onMouseEnter={() => setHover(e.sector_code)}
              onMouseLeave={() => setHover(null)}
              className={cn(
                "flex items-center gap-2 text-xs transition-opacity",
                hover && hover !== e.sector_code && "opacity-40",
              )}
            >
              <span className="inline-block h-2 w-2 flex-none" style={{ background: color }} />
              <span className="min-w-0 truncate text-ink-700">{meta?.s.label ?? e.sector_code}</span>
              <span className="ml-auto font-mono tabular-nums text-ink-950">
                {e.resilient_pct.toFixed(1)}%
              </span>
              <span
                className={cn(
                  "font-mono text-[10px] tabular-nums",
                  delta > 0.05 ? "text-emerald-700" : delta < -0.05 ? "text-rose-600" : "text-ink-500",
                )}
              >
                {delta > 0 ? "+" : ""}
                {delta.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StackedBar({
  entries,
  field,
  bySector,
}: {
  entries: AllocationEntry[];
  field: "current_pct" | "resilient_pct";
  bySector: Map<string, { s: Sector; i: number }>;
}) {
  return (
    <div className="mt-2 flex h-9 w-full overflow-hidden border border-line-200">
      {entries.map((e, i) => {
        const meta = bySector.get(e.sector_code);
        const color = sectorColor(meta?.s.hue_token, meta?.i ?? i);
        const pct = e[field];
        if (pct <= 0) return null;
        return (
          <div
            key={e.sector_code}
            className="relative h-full"
            style={{ width: `${pct}%`, background: color }}
            title={`${meta?.s.label ?? e.sector_code} · ${pct.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}

type VizProps = {
  entries: AllocationEntry[];
  bySector: Map<string, { s: Sector; i: number }>;
  hover: string | null;
  setHover: (c: string | null) => void;
};

function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const pt = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)].map((v) => v.toFixed(3));
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
}

function TwinRings({ entries, bySector, hover, setHover }: VizProps) {
  const size = 280, c = size / 2;
  const rings = [
    { field: "current_pct" as const, r0: 62, r1: 88, label: "Current" },
    { field: "resilient_pct" as const, r0: 96, r1: 134, label: "Resilient" },
  ];
  const focus = entries.find((e) => e.sector_code === hover);
  const focusMeta = focus ? bySector.get(focus.sector_code) : null;
  return (
    <div className="mt-4 flex flex-col items-center gap-6 md:flex-row md:justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-72 w-72" role="img" aria-label="Current inner ring, resilient outer ring">
        {rings.map((ring) => {
          const total = entries.reduce((s, e) => s + Math.max(0, e[ring.field]), 0) || 1;
          let a = -Math.PI / 2;
          return entries.map((e, i) => {
            const v = Math.max(0, e[ring.field]);
            if (v <= 0) return null;
            const a0 = a, a1 = a + (v / total) * Math.PI * 2 - 0.004;
            a += (v / total) * Math.PI * 2;
            const meta = bySector.get(e.sector_code);
            return (
              <path
                key={ring.field + e.sector_code}
                d={arcPath(c, c, ring.r0, ring.r1, a0, a1)}
                fill={sectorColor(meta?.s.hue_token, meta?.i ?? i)}
                opacity={hover && hover !== e.sector_code ? 0.25 : 1}
                onMouseEnter={() => setHover(e.sector_code)}
                onMouseLeave={() => setHover(null)}
                className="transition-opacity"
              >
                <title>{`${meta?.s.label ?? e.sector_code} · ${ring.label} ${v.toFixed(1)}%`}</title>
              </path>
            );
          });
        })}
        <text x={c} y={c - 6} textAnchor="middle" className="fill-ink-500 font-mono" fontSize="9" letterSpacing="2">
          {focus ? (focusMeta?.s.label ?? focus.sector_code).toUpperCase().slice(0, 18) : "INNER · CURRENT"}
        </text>
        <text x={c} y={c + 14} textAnchor="middle" className="fill-ink-950 font-mono" fontSize="16">
          {focus ? `${focus.current_pct.toFixed(1)}→${focus.resilient_pct.toFixed(1)}%` : "OUTER · RESILIENT"}
        </text>
      </svg>
    </div>
  );
}

function SlopeShift({ entries, bySector, hover, setHover }: VizProps) {
  const W = 640, H = 300, padX = 150, padY = 20;
  const max = Math.max(1, ...entries.flatMap((e) => [e.current_pct, e.resilient_pct]));
  const y = (v: number) => H - padY - (v / max) * (H - padY * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img" aria-label="Slope chart of current versus resilient share">
      <defs>
        {entries.map((e, i) => {
          const meta = bySector.get(e.sector_code);
          const col = sectorColor(meta?.s.hue_token, meta?.i ?? i);
          return (
            <linearGradient key={e.sector_code} id={`slope-${e.sector_code}`} x1="0" x2="1">
              <stop offset="0%" stopColor={col} stopOpacity="0.45" />
              <stop offset="100%" stopColor={col} stopOpacity="1" />
            </linearGradient>
          );
        })}
      </defs>
      {[padX, W - padX].map((x, k) => (
        <g key={x}>
          <line x1={x} x2={x} y1={padY} y2={H - padY} className="stroke-line-200" />
          <text x={x} y={12} textAnchor="middle" className="fill-ink-500 font-mono" fontSize="9" letterSpacing="2">
            {k === 0 ? "CURRENT" : "RESILIENT"}
          </text>
        </g>
      ))}
      {entries.map((e, i) => {
        const meta = bySector.get(e.sector_code);
        const col = sectorColor(meta?.s.hue_token, meta?.i ?? i);
        const dim = hover && hover !== e.sector_code;
        const label = meta?.s.label ?? e.sector_code;
        const y0 = y(e.current_pct), y1 = y(e.resilient_pct);
        const showLabel = !hover ? e.current_pct >= 4 || e.resilient_pct >= 4 : hover === e.sector_code;
        return (
          <g
            key={e.sector_code}
            opacity={dim ? 0.15 : 1}
            onMouseEnter={() => setHover(e.sector_code)}
            onMouseLeave={() => setHover(null)}
            className="cursor-default transition-opacity"
          >
            <line x1={padX} x2={W - padX} y1={y0} y2={y1} stroke="transparent" strokeWidth="12" />
            <line x1={padX} x2={W - padX} y1={y0} y2={y1} stroke={`url(#slope-${e.sector_code})`} strokeWidth={hover === e.sector_code ? 4 : 2.5} strokeLinecap="round" />
            <circle cx={padX} cy={y0} r="4" fill={col} />
            <circle cx={W - padX} cy={y1} r="5" fill={col} />
            {showLabel && (
              <>
                <text x={padX - 10} y={y0 + 3} textAnchor="end" className="fill-ink-700" fontSize="10">
                  {label.slice(0, 20)} {e.current_pct.toFixed(1)}%
                </text>
                <text x={W - padX + 10} y={y1 + 3} className="fill-ink-950 font-mono" fontSize="10">
                  {e.resilient_pct.toFixed(1)}%
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
