import { useMemo, useState } from "react";

import type { SignalRow } from "@/lib/narrative-chamber.functions";
import { priorityFor, type PriorityLevel } from "@/lib/narrative-priority";
import { cn } from "@/lib/utils";

/**
 * Polar radar scope for the Signal Radar header.
 * Rings = scope (local inner → international outer).
 * Angle = age over the last 7 days (12 o'clock = now, clockwise = older).
 * Dot colour = response priority, dot size = reach.
 */
const RINGS = [
  { key: "local", label: "Local", r0: 22, r1: 52 },
  { key: "regional", label: "Regional", r0: 52, r1: 82 },
  { key: "international", label: "International", r0: 82, r1: 112 },
] as const;

const PRIORITY_FILL: Record<PriorityLevel, string> = {
  1: "var(--signal-negative)",
  2: "var(--signal-caution)",
  3: "var(--signal-positive)",
  4: "var(--ink-700, currentColor)",
  5: "var(--line-200, currentColor)",
};

const WINDOW_H = 24 * 7;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}
const q = (n: number) => Math.round(n * 1000) / 1000;

export function SignalRadarScope({ signals }: { signals: SignalRow[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const size = 240;
  const c = size / 2;

  const dots = useMemo(() => {
    const now = Date.now();
    return signals
      .filter((s) => s.scope)
      .map((s) => {
        const ring = RINGS.find((r) => r.key === s.scope) ?? RINGS[2];
        const age = Math.max(0, (now - new Date(s.created_at).getTime()) / 3_600_000);
        const t = Math.min(1, age / WINDOW_H);
        const a = -Math.PI / 2 + t * Math.PI * 2 * 0.97;
        const r = ring.r0 + 5 + hash(s.id) * (ring.r1 - ring.r0 - 10);
        const p = priorityFor(s);
        return {
          s,
          p,
          x: q(c + r * Math.cos(a)),
          y: q(c + r * Math.sin(a)),
          rad: 2 + Math.min(4, (s.reach ?? 0) * 0.8),
          stale: age > WINDOW_H,
        };
      })
      .sort((a, b) => b.p.level - a.p.level);
  }, [signals, c]);

  const fresh = dots.filter((d) => !d.stale).length;
  const urgent = dots.filter((d) => d.p.level <= 2).length;
  const active = dots.find((d) => d.s.id === hover);

  return (
    <div className="flex flex-col gap-6 border border-line-200 bg-paper-0/40 p-5 lg:flex-row lg:items-center lg:gap-8">
      <div className="relative mx-auto w-full max-w-[300px] shrink-0 lg:mx-0">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full" role="img" aria-label={`Signal radar: ${dots.length} signals, ${urgent} urgent`}>
          <defs>
            <radialGradient id="radar-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--gold-500)" stopOpacity="0.10" />
              <stop offset="100%" stopColor="var(--gold-500)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="radar-sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--gold-500)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--gold-500)" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          <circle cx={c} cy={c} r={112} fill="url(#radar-bg)" />
          {RINGS.map((r) => (
            <circle key={r.key} cx={c} cy={c} r={r.r1} fill="none" className="stroke-line-200" strokeDasharray={r.key === "international" ? undefined : "2 3"} />
          ))}
          {Array.from({ length: 7 }).map((_, i) => {
            const a = -Math.PI / 2 + (i / 7) * Math.PI * 2;
            return (
              <line key={i} x1={q(c + 22 * Math.cos(a))} y1={q(c + 22 * Math.sin(a))} x2={q(c + 112 * Math.cos(a))} y2={q(c + 112 * Math.sin(a))} className="stroke-line-100" />
            );
          })}
          {/* sweep */}
          <g className="origin-center motion-safe:animate-[spin_6s_linear_infinite]" style={{ transformOrigin: `${c}px ${c}px` }}>
            <path d={`M${c},${c} L${c},${c - 112} A112,112 0 0 1 ${q(c + 112 * Math.sin(0.6))},${q(c - 112 * Math.cos(0.6))} Z`} fill="url(#radar-sweep)" />
          </g>
          {dots.map((d) => (
            <circle
              key={d.s.id}
              cx={d.x}
              cy={d.y}
              r={hover === d.s.id ? d.rad + 2 : d.rad}
              fill={PRIORITY_FILL[d.p.level]}
              opacity={hover && hover !== d.s.id ? 0.25 : d.stale ? 0.45 : 0.95}
              className="cursor-pointer stroke-paper-0 transition-all"
              strokeWidth={1}
              onMouseEnter={() => setHover(d.s.id)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${d.p.label} · ${d.s.topic}`}</title>
            </circle>
          ))}
          <circle cx={c} cy={c} r={22} className="fill-paper-0 stroke-line-200" />
          <text x={c} y={c + 2} textAnchor="middle" className="fill-ink-950 font-serif" fontSize="15">{dots.length}</text>
          <text x={c} y={c + 12} textAnchor="middle" className="fill-ink-500 font-mono" fontSize="6" letterSpacing="1">SIGNALS</text>
          <text x={c} y={6} textAnchor="middle" className="fill-ink-500 font-mono" fontSize="7" letterSpacing="1">NOW</text>
        </svg>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        {active ? (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{active.p.label} · {active.s.scope}</p>
            <p className="mt-1 line-clamp-3 font-serif text-base leading-snug text-ink-950">{active.s.topic}</p>
            <p className="mt-1 font-mono text-[10px] text-ink-500">
              severity {active.s.severity ?? "—"} · reach {active.s.reach ?? "—"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Last 7 days" value={fresh} />
            <Stat label="P1–P2 urgent" value={urgent} tone={urgent > 0 ? "alert" : undefined} />
          </div>
        )}
        <ul className="grid grid-cols-5 gap-2 border-t border-line-200 pt-3">
          {([1, 2, 3, 4, 5] as PriorityLevel[]).map((l) => (
            <li key={l} className="border border-line-200 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_FILL[l] }} />
                P{l}
              </span>
              <span className="mt-1 block font-serif text-lg tabular-nums text-ink-950">
                {dots.filter((d) => d.p.level === l).length}
              </span>
            </li>
          ))}
        </ul>
        <p className="font-mono text-[9px] leading-relaxed text-ink-500">
          Rings: local → international. Clockwise from 12: older, up to 7 days. Size = reach.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "alert" }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">{label}</p>
      <p className={cn("font-serif text-2xl tabular-nums", tone === "alert" ? "text-signal-negative" : "text-ink-950")}>{value}</p>
    </div>
  );
}
