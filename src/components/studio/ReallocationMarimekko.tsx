import { useMemo, useRef, useState } from "react";

import type { AllocationEntry } from "@/lib/fdi-resilience.functions";
import { sectorColor } from "@/components/viz/sector-color";
import { cn } from "@/lib/utils";

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
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          FDI envelope reallocation
        </p>
        <p className="font-mono text-[10px] text-ink-500">drag between sectors →</p>
      </div>

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

      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-3 lg:grid-cols-4">
        {entries.map((e, i) => {
          const meta = bySector.get(e.sector_code);
          const color = sectorColor(meta?.s.hue_token, meta?.i ?? i);
          const delta = e.resilient_pct - e.current_pct;
          return (
            <li key={e.sector_code} className="flex items-center gap-2 text-xs">
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
