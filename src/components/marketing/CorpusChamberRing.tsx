import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CHAMBERS } from "@/lib/chambers";

/**
 * Business Case hero: the Corpus at the centre, the ten Chambers as
 * interlocking puzzle pieces assembling around it — "Elevating GDP".
 * Pure SVG + CSS keyframes (see `.ccr-*` in src/styles.css).
 */
const C = 160;
const R_IN = 84;
const R_OUT = 142;
const R_MID = (R_IN + R_OUT) / 2;
const TAB = 9;
const STEP = 36;

const pt = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
};
const f = (n: number) => n.toFixed(2);

function piecePath(i: number) {
  const gap = 0.6;
  const a0 = i * STEP + gap;
  const a1 = (i + 1) * STEP - gap;
  const p = (r: number, a: number) => pt(r, a).map(f).join(" ");
  return [
    `M ${p(R_OUT, a0)}`,
    `A ${R_OUT} ${R_OUT} 0 0 1 ${p(R_OUT, a1)}`,
    `L ${p(R_MID + TAB, a1)}`,
    // tab protrudes clockwise into the next piece
    `A ${TAB} ${TAB} 0 0 1 ${p(R_MID - TAB, a1)}`,
    `L ${p(R_IN, a1)}`,
    `A ${R_IN} ${R_IN} 0 0 0 ${p(R_IN, a0)}`,
    `L ${p(R_MID - TAB, a0)}`,
    // notch receives the previous piece's tab
    `A ${TAB} ${TAB} 0 0 0 ${p(R_MID + TAB, a0)}`,
    "Z",
  ].join(" ");
}

const FRAGMENTS = Array.from({ length: 14 }, (_, k) => {
  const a = (k * 360) / 14 + 11;
  const [x, y] = pt(R_IN + 70, a);
  return { x: x - C, y: y - C, d: k * 0.12 };
});

export function CorpusChamberRing() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [active, setActive] = useState<number | "core" | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => es.some((e) => e.isIntersecting) && (setOn(true), io.disconnect()),
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const ch = typeof active === "number" ? CHAMBERS[active] : null;

  return (
    <figure
      ref={ref}
      className={`ccr relative w-[460px] select-none ${on ? "ccr-on" : ""}`}
      aria-label="The Corpus at the centre, with the ten GDPVision Chambers assembled around it as interlocking pieces, elevating GDP."
    >
      <svg viewBox="-120 -6 560 332" className="block h-auto w-full overflow-visible">
        <defs>
          <pattern id="ccr-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--color-ink-700)" strokeWidth="0.5" opacity="0.35" />
          </pattern>
        </defs>

        {/* Ring of ten Chambers */}
        <g className="ccr-spin" style={{ transformOrigin: `${C}px ${C}px` }}>
          {CHAMBERS.map((c, i) => {
            const mid = i * STEP + STEP / 2;
            const [ox, oy] = pt(40, mid).map((v) => v - C);
            const [lx, ly] = pt(6, mid).map((v) => v - C);
            const [tx, ty] = pt(R_MID, mid);
            const dim = active !== null && active !== i;
            return (
              <g key={c.index} className="ccr-piece" style={{ ["--i" as string]: i, ["--dx" as string]: `${ox}px`, ["--dy" as string]: `${oy}px`, transformOrigin: `${C}px ${C}px` }}>
                <Link
                  to="/"
                  hash="instrument"
                  aria-label={`Chamber ${c.index}: ${c.title}. ${c.outcome}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                >
                  <g
                    style={{ transform: active === i ? `translate(${lx}px, ${ly}px)` : undefined, opacity: dim ? 0.35 : 1, transition: "transform .3s ease, opacity .3s ease" }}
                  >
                    <path d={piecePath(i)} fill="var(--color-paper-0)" stroke="var(--color-ink-700)" strokeWidth="0.9" />
                    <path d={piecePath(i)} fill="url(#ccr-hatch)" />
                    <path className="ccr-glow" style={{ ["--i" as string]: i }} d={piecePath(i)} fill="none" stroke="var(--color-gold-500)" strokeWidth="1.4" />
                    <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" transform={`rotate(${mid > 90 && mid < 270 ? mid + 180 : mid} ${tx} ${ty})`} className="font-mono" fontSize="10" fill="var(--color-ink-950)" style={{ letterSpacing: "0.08em" }}>
                      {c.index}
                    </text>
                  </g>
                </Link>
              </g>
            );
          })}
        </g>

        {/* Rising GDP line */}
        <path className="ccr-rise" d={`M ${C} ${C - 30} C ${C + 6} 70, ${C - 4} 30, ${C + 10} 4`} fill="none" stroke="var(--color-gold-500)" strokeWidth="1.2" pathLength={1} />

        {/* Chamber names (static, outside the ring) */}
        {CHAMBERS.map((c, i) => {
          const mid = i * STEP + STEP / 2;
          const [x, y] = pt(R_OUT + 12, mid);
          const anchor = mid < 170 ? "start" : mid > 190 ? "end" : "middle";
          const dim = active !== null && active !== i;
          return (
            <text
              key={`n-${c.index}`}
              className="ccr-name font-mono"
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="central"
              fontSize="11"
              fill={active === i ? "var(--color-ink-950)" : "var(--color-ink-700)"}
              style={{ ["--i" as string]: i, letterSpacing: "0.06em", opacity: dim ? 0.35 : undefined, fontWeight: active === i ? 600 : 400 }}
              aria-hidden
            >
              {c.title.replace(/^The /, "")}
            </text>
          );
        })}

        {/* Corpus core */}
        <g
          tabIndex={0}
          role="img"
          aria-label="The Corpus: graded, cited national evidence."
          onMouseEnter={() => setActive("core")}
          onMouseLeave={() => setActive(null)}
          onFocus={() => setActive("core")}
          onBlur={() => setActive(null)}
          className="outline-none"
        >
          <g className="ccr-core" style={{ transformOrigin: `${C}px ${C}px` }}>
            <circle cx={C} cy={C} r={70} fill="var(--color-paper-0)" />
            {[70, 58, 46].map((r) => (
              <circle key={r} className="ccr-draw" cx={C} cy={C} r={r} fill="none" stroke="var(--color-ink-700)" strokeWidth={r === 70 ? 1 : 0.5} pathLength={1} />
            ))}
            <circle cx={C} cy={C} r={34} fill="url(#ccr-hatch)" />
          </g>
          <g transform={`translate(${C} ${C})`}>
            {FRAGMENTS.map((p, k) => (
              <circle key={k} className="ccr-frag" r="1.6" fill="var(--color-ink-700)" style={{ ["--fx" as string]: `${p.x}px`, ["--fy" as string]: `${p.y}px`, animationDelay: `${p.d}s` }} />
            ))}
          </g>
          <text x={C} y={C - 3} textAnchor="middle" className="font-mono" fontSize="10" fill="var(--color-ink-950)" style={{ letterSpacing: "0.22em" }}>
            CORPUS
          </text>
          <text x={C} y={C + 11} textAnchor="middle" className="font-mono" fontSize="6.5" fill="var(--color-ink-500)" style={{ letterSpacing: "0.18em" }}>
            GRADED · CITED
          </text>
        </g>
      </svg>

      <figcaption className="ccr-caption mt-5 text-center">
        <div className="flex items-center justify-center gap-3 font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-ink-950">
          <span className="h-px w-8 bg-gold-500" aria-hidden />
          Elevating GDP
          <span className="h-px w-8 bg-gold-500" aria-hidden />
        </div>
        <div className="mt-2 min-h-[34px] text-[12px] leading-snug text-ink-500" aria-live="polite">
          {ch ? (
            <>
              <span className="font-mono text-ink-950">{ch.index} · {ch.title}</span>
              <br />
              {ch.outcome}
            </>
          ) : active === "core" ? (
            "The Corpus: graded, cited national evidence."
          ) : (
            "Ten Chambers. One national corpus."
          )}
        </div>
      </figcaption>
    </figure>
  );
}
