import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { sectorColor } from "@/components/viz/sector-color";
import { Explain } from "@/components/explain/Explain";
import { useUrlState } from "@/lib/nav/url-state";
import { cn } from "@/lib/utils";
import "@/lib/explain/fdi-entries";

type Sector = { code: string; label: string; share_pct: number; hue_token: string | null };
type View = "bars" | "treemap" | "curve";
const VIEWS: { id: View; label: string }[] = [
  { id: "bars", label: "Bars" },
  { id: "treemap", label: "Treemap" },
  { id: "curve", label: "Curve" },
];

type Item = Sector & { color: string };

function sectorsNeeded(items: Item[], target: number) {
  let sum = 0;
  for (let i = 0; i < items.length; i++) {
    sum += items[i].share_pct;
    if (sum >= target) return i + 1;
  }
  return items.length;
}

export function ConcentrationPanel({ code, sectors, hhi }: { code: string; sectors: Sector[]; hhi: number }) {
  const [view, setView] = useUrlState<View>("cview", "bars", {
    allowed: VIEWS.map((v) => v.id),
    replace: true,
  });
  const [hover, setHover] = useState<string | null>(null);
  const items: Item[] = [...sectors]
    .sort((a, b) => b.share_pct - a.share_pct)
    .map((s) => ({ ...s, color: sectorColor(s.hue_token, sectors.indexOf(s)) }));
  const n50 = sectorsNeeded(items, 50);
  const n80 = sectorsNeeded(items, 80);
  const top = items[0];
  const ctx = { hhi, n50, n80, total: items.length, top: top?.label, topPct: top?.share_pct };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Concentration map · GDP share
        </p>
        <div role="tablist" aria-label="Chart view" className="flex border border-line-200">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              type="button"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
                view === v.id ? "bg-paper-100 text-ink-950" : "text-ink-500 hover:text-ink-950",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 border border-line-200 bg-paper-0 p-4">
        {items.length === 0 ? (
          <p className="text-sm text-ink-500">No sector GDP shares recorded yet.</p>
        ) : view === "bars" ? (
          <RankedBars items={items} code={code} hover={hover} setHover={setHover} />
        ) : view === "treemap" ? (
          <Treemap items={items} code={code} hover={hover} setHover={setHover} />
        ) : (
          <Curve items={items} code={code} hover={hover} setHover={setHover} n50={n50} n80={n80} ctx={ctx} />
        )}
      </div>

      {top && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
          Top sector: {top.label} {top.share_pct.toFixed(1)}% · {n80} sector{n80 === 1 ? "" : "s"} make up 80% of GDP ·{" "}
          <Explain id="fdi.hhi" ctx={ctx}>HHI {hhi.toFixed(3)}</Explain>
        </p>
      )}
    </section>
  );
}

type VP = { items: Item[]; code: string; hover: string | null; setHover: (c: string | null) => void };

function RankedBars({ items, code, hover, setHover }: VP) {
  const max = Math.max(...items.map((i) => i.share_pct), 1);
  return (
    <ul className="space-y-1.5">
      {items.map((s) => (
        <li key={s.code}>
          <Link
            to="/admin/countries/$code/studio/sectors/$sectorCode"
            params={{ code, sectorCode: s.code }}
            onMouseEnter={() => setHover(s.code)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(s.code)}
            onBlur={() => setHover(null)}
            className={cn(
              "grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 text-xs transition-opacity sm:grid-cols-[minmax(0,14rem)_1fr_4rem]",
              hover && hover !== s.code && "opacity-40",
            )}
          >
            <span className="truncate text-ink-700">{s.label}</span>
            <span className="h-4 bg-paper-100">
              <span className="block h-full" style={{ width: `${(s.share_pct / max) * 100}%`, background: s.color }} />
            </span>
            <span className="text-right tabular-nums text-ink-950">{s.share_pct.toFixed(1)}%</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

type Rect = { item: Item; x: number; y: number; w: number; h: number };

/** Squarified treemap layout. */
function squarify(items: Item[], x: number, y: number, w: number, h: number): Rect[] {
  const total = items.reduce((a, b) => a + Math.max(b.share_pct, 0.01), 0);
  const scaled = items.map((i) => ({ item: i, a: (Math.max(i.share_pct, 0.01) / total) * w * h }));
  const out: Rect[] = [];
  let rest = scaled;
  let rx = x, ry = y, rw = w, rh = h;
  const worst = (row: { a: number }[], side: number) => {
    const s = row.reduce((p, r) => p + r.a, 0);
    const mx = Math.max(...row.map((r) => r.a));
    const mn = Math.min(...row.map((r) => r.a));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  while (rest.length) {
    const side = Math.min(rw, rh);
    let row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) {
      row = [...row, rest[i]];
      i++;
    }
    const s = row.reduce((p, r) => p + r.a, 0);
    if (rw >= rh) {
      const cw = s / rh;
      let cy = ry;
      for (const r of row) {
        const ch = r.a / cw;
        out.push({ item: r.item, x: rx, y: cy, w: cw, h: ch });
        cy += ch;
      }
      rx += cw; rw -= cw;
    } else {
      const ch = s / rw;
      let cx = rx;
      for (const r of row) {
        const cw = r.a / ch;
        out.push({ item: r.item, x: cx, y: ry, w: cw, h: ch });
        cx += cw;
      }
      ry += ch; rh -= ch;
    }
    rest = rest.slice(i);
  }
  return out;
}

function Treemap({ items, code, hover, setHover }: VP) {
  const W = 1000, H = 380;
  const rects = squarify(items, 0, 0, W, H);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Treemap of sector GDP shares">
      {rects.map(({ item, x, y, w, h }) => {
        const fits = w > 90 && h > 40;
        return (
          <Link
            key={item.code}
            to="/admin/countries/$code/studio/sectors/$sectorCode"
            params={{ code, sectorCode: item.code }}
            onMouseEnter={() => setHover(item.code)}
            onMouseLeave={() => setHover(null)}
          >
            <g opacity={hover && hover !== item.code ? 0.4 : 1}>
              <title>{`${item.label} · ${item.share_pct.toFixed(1)}%`}</title>
              <rect x={x} y={y} width={w} height={h} fill={item.color} stroke="var(--color-paper-0)" strokeWidth={2} />
              {fits && (
                <>
                  <text x={x + 10} y={y + 22} fill="var(--color-paper-0)" fontSize={15} fontWeight={500}>
                    {item.label.length > w / 9 ? item.label.slice(0, Math.floor(w / 9) - 1) + "…" : item.label}
                  </text>
                  <text x={x + 10} y={y + 42} fill="var(--color-paper-0)" fontSize={13} fontFamily="monospace">
                    {item.share_pct.toFixed(1)}%
                  </text>
                </>
              )}
            </g>
          </Link>
        );
      })}
    </svg>
  );
}

function Curve({ items, code, hover, setHover, n50, n80, ctx }: VP & { n50: number; n80: number; ctx: object }) {
  const W = 1000, H = 320, L = 44, R = 16, T = 16, B = 36;
  const n = items.length;
  const px = (k: number) => L + (k / n) * (W - L - R);
  const py = (v: number) => T + (1 - Math.min(v, 100) / 100) * (H - T - B);
  const cum: number[] = [0];
  items.forEach((s, i) => cum.push(cum[i] + s.share_pct));
  const pts = cum.map((v, k) => `${px(k)},${py(v)}`);
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${px(n)},${py(0)} L${px(0)},${py(0)} Z`;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img" aria-label="Cumulative concentration curve">
        <defs>
          <linearGradient id="conc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-gold-500)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--color-gold-500)" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={py(v)} y2={py(v)} stroke="var(--color-line-100)" />
            <text x={L - 8} y={py(v) + 4} textAnchor="end" fontSize={11} fill="var(--color-ink-500)" fontFamily="monospace">
              {v}%
            </text>
          </g>
        ))}
        <line x1={px(0)} y1={py(0)} x2={px(n)} y2={py(100)} stroke="var(--color-ink-300)" strokeDasharray="4 4" />
        <path d={area} fill="url(#conc-fill)" />
        <path d={line} fill="none" stroke="var(--color-gold-500)" strokeWidth={2.5} />
        {[{ k: n50, l: "50%" }, { k: n80, l: "80%" }].map((m) => (
          <g key={m.l}>
            <line x1={px(m.k)} x2={px(m.k)} y1={py(cum[m.k])} y2={py(0)} stroke="var(--color-ink-700)" strokeDasharray="2 3" />
            <text x={px(m.k) + 6} y={py(cum[m.k]) + 16} fontSize={11} fill="var(--color-ink-950)" fontFamily="monospace">
              {m.l} in {m.k}
            </text>
          </g>
        ))}
        {items.map((s, i) => (
          <Link
            key={s.code}
            to="/admin/countries/$code/studio/sectors/$sectorCode"
            params={{ code, sectorCode: s.code }}
            onMouseEnter={() => setHover(s.code)}
            onMouseLeave={() => setHover(null)}
          >
            <circle cx={px(i + 1)} cy={py(cum[i + 1])} r={hover === s.code ? 7 : 5} fill={s.color} stroke="var(--color-paper-0)" strokeWidth={2}>
              <title>{`${i + 1}. ${s.label} · ${s.share_pct.toFixed(1)}% (cumulative ${cum[i + 1].toFixed(1)}%)`}</title>
            </circle>
            {n <= 14 && (
              <text x={px(i + 1)} y={H - 14} textAnchor="middle" fontSize={10} fill={hover === s.code ? "var(--color-ink-950)" : "var(--color-ink-500)"} fontFamily="monospace">
                {s.code.split("-")[0].slice(0, 9)}
              </text>
            )}
          </Link>
        ))}
      </svg>
      <p className="mt-1 text-xs text-ink-500">
        Sectors ordered largest first; dashed diagonal = perfectly even economy.{" "}
        <Explain id="fdi.concentration-curve" ctx={ctx}>How to read this</Explain>
      </p>
    </div>
  );
}
