import { useId, useState } from "react";

import { Explain } from "@/components/explain/Explain";
import "@/lib/explain/indices-entries";
import { sextantHue } from "@/lib/indices/sextant-hue";

// Sextant radar for an index card: four spokes (the Sextant parts), filled in the
// Sextant colour, with a radar-scope sweep. Reduced motion → static, fully drawn.

export type SextantParts = {
  availability: number;
  timeliness: number;
  grade_quality: number;
  source_health: number;
};

const AXES: Array<{ key: keyof SextantParts; label: string; measures: string }> = [
  { key: "availability", label: "Availability", measures: "Inputs with a valid value" },
  { key: "timeliness", label: "Timeliness", measures: "Input age vs tolerance" },
  { key: "grade_quality", label: "Grade quality", measures: "A–D grade mix" },
  { key: "source_health", label: "Source health", measures: "Sources that answered" },
];

const band = (s: number) => (s >= 80 ? "clear" : s >= 60 ? "fair" : s >= 40 ? "hazy" : "obscured");
const q = (n: number) => Math.round(n * 100) / 100;

export function SextantRadar({
  score,
  parts,
  delay = 0,
}: {
  score: number | null;
  parts: SextantParts | null;
  delay?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const size = 160;
  const c = size / 2;
  const R = 58;
  const empty = score == null;
  const hue = empty ? "var(--line-200)" : sextantHue(score);
  const ang = (i: number) => -Math.PI / 2 + (i * Math.PI * 2) / AXES.length;
  const pt = (i: number, v: number) => {
    const r = (Math.max(0, Math.min(100, v)) / 100) * R;
    return [q(c + r * Math.cos(ang(i))), q(c + r * Math.sin(ang(i)))] as const;
  };
  const pts = parts ? AXES.map((a, i) => pt(i, parts[a.key])) : [];
  const poly = pts.map((p) => p.join(",")).join(" ");
  const sweepMs = 6000;

  return (
    <div className="flex flex-col items-center">
      <style>{`
        @keyframes sx-sweep-${uid}{to{transform:rotate(360deg)}}
        @keyframes sx-grow-${uid}{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes sx-ping-${uid}{0%,8%{opacity:1;r:4.5}30%,100%{opacity:.55;r:2.5}}
        .sx-${uid} .sx-sweep{transform-origin:${c}px ${c}px;animation:sx-sweep-${uid} ${sweepMs}ms linear infinite;animation-delay:${delay}ms}
        .sx-${uid} .sx-shape{transform-origin:${c}px ${c}px;animation:sx-grow-${uid} 900ms cubic-bezier(.2,.8,.2,1) both;animation-delay:${delay}ms}
        .sx-${uid} .sx-dot{animation:sx-ping-${uid} ${sweepMs}ms linear infinite}
        .sx-${uid}:hover .sx-sweep,.sx-${uid}:hover .sx-dot{animation-play-state:paused}
        @media (prefers-reduced-motion: reduce){
          .sx-${uid} .sx-sweep{display:none}
          .sx-${uid} .sx-shape,.sx-${uid} .sx-dot{animation:none}
        }
      `}</style>
      <svg
        viewBox={`-34 0 ${size + 68} ${size}`}
        className={`sx-${uid} h-auto w-full max-w-[220px]`}
        role="img"
        aria-label={
          empty
            ? "No Sextant yet"
            : `Sextant median ${Math.round(score)}, ${band(score)}. ` +
              (parts ? AXES.map((a) => `${a.label} ${Math.round(parts[a.key])}`).join(", ") : "")
        }
      >
        <defs>
          <radialGradient id={`bg-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={hue} stopOpacity="0.12" />
            <stop offset="100%" stopColor={hue} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`sw-${uid}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={hue} stopOpacity="0" />
            <stop offset="100%" stopColor={hue} stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={R} fill={`url(#bg-${uid})`} />
        {[40, 60, 80, 100].map((v) => (
          <circle
            key={v}
            cx={c}
            cy={c}
            r={(v / 100) * R}
            fill="none"
            className="stroke-line-200"
            strokeDasharray={v === 100 ? undefined : "2 3"}
          />
        ))}
        {AXES.map((a, i) => {
          const [x, y] = pt(i, 100);
          return <line key={a.key} x1={c} y1={c} x2={x} y2={y} className="stroke-line-100" />;
        })}
        {!empty && (
          <g className="sx-sweep">
            <path
              d={`M${c},${c} L${c},${c - R} A${R},${R} 0 0 1 ${q(c + R * Math.sin(0.7))},${q(c - R * Math.cos(0.7))} Z`}
              fill={`url(#sw-${uid})`}
            />
            <line x1={c} y1={c} x2={c} y2={c - R} stroke={hue} strokeOpacity="0.7" />
          </g>
        )}
        {parts && !empty && (
          <g className="sx-shape">
            <polygon points={poly} fill={hue} fillOpacity="0.35" stroke={hue} strokeWidth={1.5} />
            {pts.map(([x, y], i) => (
              <circle
                key={AXES[i].key}
                className="sx-dot cursor-pointer"
                cx={x}
                cy={y}
                r={3}
                fill={hue}
                // the beam passes spoke i at i/4 of a turn
                style={{ animationDelay: `${delay + (i * sweepMs) / AXES.length}ms` }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${AXES[i].label}: ${Math.round(parts[AXES[i].key])} — ${AXES[i].measures}`}</title>
              </circle>
            ))}
          </g>
        )}
        {AXES.map((a, i) => {
          const k = i % 2 ? 1.45 : 1.18;
          const x = q(c + R * k * Math.cos(ang(i)));
          const y = q(c + R * k * Math.sin(ang(i)));
          return (
            <text
              key={a.key}
              x={x}
              y={y + 2}
              textAnchor="middle"
              className="fill-ink-500 font-mono"
              fontSize="6.5"
              letterSpacing="0.5"
            >
              {a.label.toUpperCase()}
            </text>
          );
        })}
        <circle cx={c} cy={c} r={16} className="fill-paper-0 stroke-line-200" />
        <text x={c} y={c + 4} textAnchor="middle" className="fill-ink-950 font-serif" fontSize="13">
          {empty ? "—" : Math.round(score)}
        </text>
      </svg>
      <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
        {hover != null && parts ? (
          `${AXES[hover].label} ${Math.round(parts[AXES[hover].key])} · ${AXES[hover].measures}`
        ) : empty ? (
          "No Sextant yet"
        ) : (
          <Explain id="indices.sextant">Sextant median · {band(score)}</Explain>
        )}
      </p>
    </div>
  );
}
