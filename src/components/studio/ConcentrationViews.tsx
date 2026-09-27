import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

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

type Item = Sector & { color: string; rank: number; cum: number };
type Tip =
  | { kind: "sector"; code: string; x: number; y: number }
  | { kind: "marker"; k: number; pct: number; x: number; y: number }
  | { kind: "diagonal" | "axis"; x: number; y: number };

const SHORT: Record<string, string> = {
  "public administration": "Public admin",
  "transport & logistics": "Transport",
  "agriculture & fisheries": "Agriculture",
  "financial services": "Finance",
  "digital economy": "Digital",
  "other services": "Other services",
  "real estate": "Real estate",
};
function shortLabel(label: string) {
  const k = label.toLowerCase();
  if (SHORT[k]) return SHORT[k];
  return label.length > 14 ? label.split(/[\s&,]+/)[0] : label;
}

function sectorsNeeded(items: Item[], target: number) {
  const i = items.findIndex((s) => s.cum >= target);
  return i === -1 ? items.length : i + 1;
}

export function ConcentrationPanel({ code, sectors, hhi }: { code: string; sectors: Sector[]; hhi: number }) {
  const [view, setView] = useUrlState<View>("cview", "bars", {
    allowed: VIEWS.map((v) => v.id),
    replace: true,
  });
  const [tip, setTip] = useState<Tip | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  let run = 0;
  const items: Item[] = [...sectors]
    .sort((a, b) => b.share_pct - a.share_pct)
    .map((s, i) => {
      run += s.share_pct;
      return { ...s, color: sectorColor(s.hue_token, sectors.indexOf(s)), rank: i + 1, cum: run };
    });
  const n50 = sectorsNeeded(items, 50);
  const n80 = sectorsNeeded(items, 80);
  const top = items[0];
  const ctx = { hhi, n50, n80, total: items.length, top: top?.label, topPct: top?.share_pct };

  /** Position a tip from a pointer event or a focused element, relative to the chart wrapper. */
  const at = (e: { clientX?: number; clientY?: number; currentTarget: Element }) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    if (e.clientX != null && e.clientY != null && (e.clientX || e.clientY)) return { x: e.clientX - r.left, y: e.clientY - r.top };
    const b = e.currentTarget.getBoundingClientRect();
    return { x: b.left + b.width / 2 - r.left, y: b.top - r.top };
  };
  const hoverCode = tip?.kind === "sector" ? tip.code : null;
  const vp: VP = { items, code, hoverCode, setTip, at };

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
              onClick={() => {
                setTip(null);
                setView(v.id);
              }}
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

      <div
        ref={wrap}
        className="relative mt-3 border border-line-200 bg-paper-0 p-4"
        onMouseLeave={() => setTip(null)}
      >
        {items.length === 0 ? (
          <p className="text-sm text-ink-500">No sector GDP shares recorded yet.</p>
        ) : view === "bars" ? (
          <RankedBars {...vp} />
        ) : view === "treemap" ? (
          <Treemap {...vp} />
        ) : (
          <Curve {...vp} n50={n50} n80={n80} ctx={ctx} />
        )}
        {tip && <ChartTip tip={tip} items={items} wrap={wrap.current} />}
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

function ChartTip({ tip, items, wrap }: { tip: Tip; items: Item[]; wrap: HTMLDivElement | null }) {
  const n = items.length;
  const even = 100 / Math.max(n, 1);
  let title = "";
  let body: ReactNode = null;
  let accent: string | undefined;
  if (tip.kind === "sector") {
    const s = items.find((i) => i.code === tip.code);
    if (!s) return null;
    accent = s.color;
    title = `#${s.rank} ${s.label}`;
    const diff = s.share_pct - even;
    body = (
      <>
        <Row k="Share of GDP" v={`${s.share_pct.toFixed(1)}%`} />
        <Row k={`Top ${s.rank} combined`} v={`${s.cum.toFixed(1)}%`} />
        <Row k={`Even split (1 of ${n})`} v={`${even.toFixed(1)}%`} />
        <p className="mt-2 text-ink-700">
          {Math.abs(diff) < 0.5
            ? "About the size it would be in a perfectly even economy."
            : diff > 0
              ? `${(s.share_pct / even).toFixed(1)}× its even-split size — a load-bearing sector.`
              : `Below its even-split size — room to grow its weight in the economy.`}
        </p>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">Click to open sector</p>
      </>
    );
  } else if (tip.kind === "marker") {
    const names = items.slice(0, tip.k).map((s) => s.label);
    title = `${tip.pct}% of GDP in ${tip.k} of ${n} sectors`;
    body = (
      <>
        <p className="text-ink-700">
          {names.slice(0, 4).join(", ")}
          {names.length > 4 ? ` and ${names.length - 4} more` : ""}.
        </p>
        <p className="mt-2 text-ink-700">
          {tip.k / n <= 0.35
            ? "A shock to these few sectors would move most of the economy — diversifying FDI beyond them lowers that exposure."
            : "Output is spread across many sectors, so a single-sector shock is cushioned."}
        </p>
      </>
    );
  } else if (tip.kind === "diagonal") {
    title = "Perfectly even economy";
    body = (
      <p className="text-ink-700">
        If every sector were the same size, the curve would follow this line. The wider the gold area above it, the more
        concentrated the economy.
      </p>
    );
  } else {
    title = "Cumulative share of GDP";
    body = <p className="text-ink-700">Running total of GDP as sectors are added, largest first.</p>;
  }
  const W = wrap?.clientWidth ?? 800;
  const flip = tip.x > W - 280;
  const below = tip.y < 140;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 w-64 border border-line-200 bg-paper-0 p-3 text-xs shadow-lg"
      style={{
        left: flip ? tip.x - 16 - 256 : tip.x + 16,
        top: below ? tip.y + 16 : tip.y - 16,
        transform: below ? undefined : "translateY(-100%)",
        borderTop: accent ? `3px solid ${accent}` : undefined,
      }}
    >
      <p className="font-medium text-ink-950">{title}</p>
      <div className="mt-1.5">{body}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-ink-500">{k}</span>
      <span className="tabular-nums text-ink-950">{v}</span>
    </div>
  );
}

type AtFn = (e: { clientX?: number; clientY?: number; currentTarget: Element }) => { x: number; y: number };
type VP = {
  items: Item[];
  code: string;
  hoverCode: string | null;
  setTip: (t: Tip | null) => void;
  at: AtFn;
};

/** Hover/focus/touch handlers shared by every sector target. Touch: first tap explains, second opens. */
function useSectorHandlers({ setTip, at, hoverCode, code }: VP) {
  const navigate = useNavigate();
  const lastPointer = useRef<string>("mouse");
  return (s: Item) => ({
    onPointerDown: (e: React.PointerEvent) => {
      lastPointer.current = e.pointerType;
    },
    onMouseMove: (e: React.MouseEvent) => setTip({ kind: "sector", code: s.code, ...at(e) }),
    onFocus: (e: React.FocusEvent) => setTip({ kind: "sector", code: s.code, ...at(e) }),
    onBlur: () => setTip(null),
    onClick: (e: React.MouseEvent) => {
      if (lastPointer.current === "touch" && hoverCode !== s.code) {
        e.preventDefault();
        setTip({ kind: "sector", code: s.code, ...at(e) });
        return;
      }
      if (e.currentTarget.tagName.toLowerCase() !== "a") {
        navigate({ to: "/admin/countries/$code/studio/sectors/$sectorCode", params: { code, sectorCode: s.code } });
      }
    },
  });
}

function RankedBars(vp: VP) {
  const { items, code, hoverCode } = vp;
  const h = useSectorHandlers(vp);
  const max = Math.max(...items.map((i) => i.share_pct), 1);
  return (
    <ul className="space-y-1.5">
      {items.map((s) => (
        <li key={s.code}>
          <Link
            to="/admin/countries/$code/studio/sectors/$sectorCode"
            params={{ code, sectorCode: s.code }}
            aria-label={`${s.label}, ${s.share_pct.toFixed(1)}% of GDP`}
            {...h(s)}
            className={cn(
              "grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 text-xs transition-opacity sm:grid-cols-[minmax(0,14rem)_1fr_4rem]",
              hoverCode && hoverCode !== s.code && "opacity-40",
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

function Treemap(vp: VP) {
  const { items, code, hoverCode } = vp;
  const h = useSectorHandlers(vp);
  const W = 1000, H = 380;
  const rects = squarify(items, 0, 0, W, H);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Treemap of sector GDP shares">
      {rects.map(({ item, x, y, w, h: rh }) => {
        const fits = w > 90 && rh > 40;
        return (
          <Link
            key={item.code}
            to="/admin/countries/$code/studio/sectors/$sectorCode"
            params={{ code, sectorCode: item.code }}
            aria-label={`${item.label}, ${item.share_pct.toFixed(1)}% of GDP`}
            {...h(item)}
          >
            <g opacity={hoverCode && hoverCode !== item.code ? 0.4 : 1}>
              <rect x={x} y={y} width={w} height={rh} fill={item.color} stroke="var(--color-paper-0)" strokeWidth={2} />
              {fits && (
                <>
                  <text x={x + 10} y={y + 22} fill="var(--color-paper-0)" fontSize={15} fontWeight={500}>
                    {item.label.length > w / 9 ? shortLabel(item.label) : item.label}
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

function Curve(vp: VP & { n50: number; n80: number; ctx: object }) {
  const { items, hoverCode, setTip, at, n50, n80, ctx } = vp;
  const h = useSectorHandlers(vp);
  const n = items.length;
  const tilt = n > 8;
  const W = 1000, H = tilt ? 350 : 320, L = 50, R = 20, T = 30, B = tilt ? 70 : 40;
  const px = (k: number) => L + (k / n) * (W - L - R);
  const py = (v: number) => T + (1 - Math.min(v, 100) / 100) * (H - T - B);
  const cum = [0, ...items.map((s) => s.cum)];
  const line = `M${cum.map((v, k) => `${px(k)},${py(v)}`).join(" L")}`;
  const area = `${line} L${px(n)},${py(0)} L${px(0)},${py(0)} Z`;
  const colW = (W - L - R) / n;
  const hoverIdx = hoverCode ? items.findIndex((s) => s.code === hoverCode) : -1;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img" aria-label="Cumulative concentration curve">
        <defs>
          <linearGradient id="conc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-gold-500)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--color-gold-500)" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <g
          onMouseMove={(e) => setTip({ kind: "axis", ...at(e) })}
          style={{ cursor: "help" }}
        >
          <rect x={0} y={T - 10} width={L - 4} height={H - T - B + 20} fill="transparent" />
          {[0, 25, 50, 75, 100].map((v) => (
            <text key={v} x={L - 8} y={py(v) + 4} textAnchor="end" fontSize={11} fill="var(--color-ink-500)" fontFamily="monospace">
              {v}%
            </text>
          ))}
        </g>
        {[0, 25, 50, 75, 100].map((v) => (
          <line key={v} x1={L} x2={W - R} y1={py(v)} y2={py(v)} stroke="var(--color-line-100)" />
        ))}
        <path d={area} fill="url(#conc-fill)" />
        <line x1={px(0)} y1={py(0)} x2={px(n)} y2={py(100)} stroke="var(--color-ink-300)" strokeDasharray="4 4" />

        {/* Sector column hit zones (behind markers/diagonal hit line) */}
        {items.map((s, i) => (
          <rect
            key={`hit-${s.code}`}
            x={px(i + 1) - colW / 2}
            y={T - 10}
            width={colW}
            height={H - T + 10}
            fill={hoverIdx === i ? "var(--color-ink-950)" : "transparent"}
            fillOpacity={hoverIdx === i ? 0.04 : 0}
            tabIndex={0}
            role="link"
            aria-label={`#${s.rank} ${s.label}, ${s.share_pct.toFixed(1)}% of GDP, cumulative ${s.cum.toFixed(1)}%`}
            style={{ cursor: "pointer", outline: "none" }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const sib = (e.currentTarget.parentNode as SVGElement).querySelectorAll<SVGRectElement>("rect[role=link]");
                sib[Math.max(0, Math.min(n - 1, i + (e.key === "ArrowRight" ? 1 : -1)))]?.focus();
              } else if (e.key === "Enter") {
                (e.currentTarget as unknown as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
              }
            }}
            {...h(s)}
          />
        ))}

        {/* Diagonal hit line */}
        <line
          x1={px(0)} y1={py(0)} x2={px(n)} y2={py(100)}
          stroke="transparent" strokeWidth={14}
          style={{ cursor: "help" }}
          onMouseMove={(e) => setTip({ kind: "diagonal", ...at(e) })}
        />

        <path d={line} fill="none" stroke="var(--color-gold-500)" strokeWidth={2.5} pointerEvents="none" />

        {hoverIdx >= 0 && (
          <line
            x1={px(hoverIdx + 1)} x2={px(hoverIdx + 1)}
            y1={py(cum[hoverIdx + 1])} y2={H - B + 4}
            stroke="var(--color-ink-700)" strokeWidth={1} pointerEvents="none"
          />
        )}

        {[{ k: n50, pct: 50 }, { k: n80, pct: 80 }].map((m) => {
          const x = px(m.k), y = py(cum[m.k]);
          const label = `${m.pct}% in ${m.k}`;
          const lw = label.length * 7 + 12;
          const lx = Math.min(x - lw / 2, W - R - lw);
          return (
            <g
              key={m.pct}
              style={{ cursor: "help" }}
              onMouseMove={(e) => setTip({ kind: "marker", k: m.k, pct: m.pct, ...at(e) })}
            >
              <line x1={x} x2={x} y1={y} y2={py(0)} stroke="var(--color-ink-700)" strokeDasharray="2 3" />
              <rect x={lx} y={y - 30} width={lw} height={18} fill="var(--color-paper-0)" stroke="var(--color-line-200)" />
              <text x={lx + lw / 2} y={y - 17} textAnchor="middle" fontSize={11} fill="var(--color-ink-950)" fontFamily="monospace">
                {label}
              </text>
            </g>
          );
        })}

        {items.map((s, i) => (
          <circle
            key={s.code}
            cx={px(i + 1)} cy={py(s.cum)}
            r={hoverIdx === i ? 7 : 5}
            fill={s.color} stroke="var(--color-paper-0)" strokeWidth={2}
            pointerEvents="none"
          />
        ))}

        {items.map((s, i) => {
          const x = px(i + 1), y = H - B + 18;
          const active = hoverIdx === i;
          const dim = hoverIdx >= 0 && !active;
          const text = n > 12 ? String(s.rank) : shortLabel(s.label);
          return (
            <text
              key={`lbl-${s.code}`}
              x={x} y={y}
              textAnchor={tilt && n <= 12 ? "end" : "middle"}
              transform={tilt && n <= 12 ? `rotate(-30 ${x} ${y})` : undefined}
              fontSize={11}
              fontWeight={active ? 600 : 400}
              fill={active ? "var(--color-ink-950)" : "var(--color-ink-500)"}
              opacity={dim ? 0.45 : 1}
              fontFamily="monospace"
              pointerEvents="none"
            >
              {text}
            </text>
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-ink-500">
        Point at any sector, marker or the dashed line for detail.{" "}
        <Explain id="fdi.concentration-curve" ctx={ctx}>How to read this</Explain>
      </p>
    </div>
  );
}
