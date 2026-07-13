// Squarified treemap of sector GDP shares. Ported from Sovereign Pulse.
import { useMemo } from "react";
import type { SectorTile } from "@/lib/country-viz/viz.functions";
import { sectorColor } from "./sector-color";

interface Rect { x: number; y: number; w: number; h: number }
interface Tile { code: string; label: string; value: number; color: string }
interface Placed extends Tile, Rect {}

export function GdpTreemap({
  sectors,
  selected,
  onSelect,
}: {
  sectors: SectorTile[];
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  const W = 1000, H = 500;
  const items: Tile[] = useMemo(
    () => sectors.map((s, i) => ({
      code: s.code,
      label: s.label,
      value: Math.max(0.1, Number(s.share_pct) || 0.1),
      color: sectorColor(s.hue_token, i),
    })),
    [sectors],
  );
  const tiles = useMemo(() => squarify(items, { x: 0, y: 0, w: W, h: H }), [items]);

  if (!sectors.length) {
    return (
      <div className="border border-line-200 p-8 text-center text-sm text-ink-500">
        Sector composition not committed — run stage 3 in onboarding.
      </div>
    );
  }

  return (
    <div className="rounded border border-line-200 bg-paper-0 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Chart · GDP Composition</div>
          <h3 className="font-serif text-lg">Sector share of GDP</h3>
        </div>
        {selected && (
          <button onClick={() => onSelect(null)} className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 hover:text-ink-950">
            Clear filter ×
          </button>
        )}
      </div>
      <div className="w-full overflow-hidden" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full">
          {tiles.map((t) => {
            const isSel = selected === t.code;
            const dim = selected && !isSel ? 0.15 : 1;
            return (
              <g key={t.code} className="cursor-pointer" onClick={() => onSelect(isSel ? null : t.code)} opacity={dim}>
                <rect
                  x={t.x + 2}
                  y={t.y + 2}
                  width={Math.max(0, t.w - 4)}
                  height={Math.max(0, t.h - 4)}
                  fill={t.color}
                  fillOpacity={isSel ? 0.85 : 0.55}
                  stroke={t.color}
                  strokeOpacity={0.9}
                  strokeWidth={isSel ? 2 : 1}
                />
                {t.w > 60 && t.h > 30 && (
                  <text x={t.x + 10} y={t.y + 20} fill="var(--color-paper-0)" fontSize={12} fontWeight={600}>
                    {t.label}
                  </text>
                )}
                {t.w > 60 && t.h > 46 && (
                  <text x={t.x + 10} y={t.y + 38} fill="var(--color-paper-0)" fontSize={11} className="tabular-nums" opacity={0.85}>
                    {t.value.toFixed(1)}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ---- squarified treemap ----
interface Scaled extends Tile { area: number }
function squarify(items: Tile[], rect: Rect): Placed[] {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const scaled: Scaled[] = items.map((it) => ({ ...it, area: (it.value / total) * (rect.w * rect.h) }));
  const out: Placed[] = [];
  layoutRow(scaled, [], rect, out);
  return out;
}
function layoutRow(remaining: Scaled[], row: Scaled[], rect: Rect, out: Placed[]) {
  if (!remaining.length && !row.length) return;
  const short = Math.min(rect.w, rect.h);
  if (!remaining.length) { placeRow(row, rect, out); return; }
  const next = remaining[0];
  const withNext = [...row, next];
  const worstCur = row.length ? worst(row, short) : Infinity;
  const worstNext = worst(withNext, short);
  if (!row.length || worstNext <= worstCur) layoutRow(remaining.slice(1), withNext, rect, out);
  else { const r = placeRow(row, rect, out); layoutRow(remaining, [], r, out); }
}
function worst(row: Scaled[], short: number) {
  const sum = row.reduce((s, r) => s + r.area, 0);
  const mx = Math.max(...row.map((r) => r.area));
  const mn = Math.min(...row.map((r) => r.area));
  const s2 = sum * sum, w2 = short * short;
  return Math.max((w2 * mx) / s2, s2 / (w2 * mn));
}
function placeRow(row: Scaled[], rect: Rect, out: Placed[]): Rect {
  const sum = row.reduce((s, r) => s + r.area, 0);
  if (!sum) return rect;
  if (rect.w >= rect.h) {
    const rw = sum / rect.h;
    let cy = rect.y;
    for (const r of row) { const th = r.area / rw; out.push({ ...r, x: rect.x, y: cy, w: rw, h: th }); cy += th; }
    return { x: rect.x + rw, y: rect.y, w: rect.w - rw, h: rect.h };
  } else {
    const rh = sum / rect.w;
    let cx = rect.x;
    for (const r of row) { const tw = r.area / rh; out.push({ ...r, x: cx, y: rect.y, w: tw, h: rh }); cx += tw; }
    return { x: rect.x, y: rect.y + rh, w: rect.w, h: rect.h - rh };
  }
}
