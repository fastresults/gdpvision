// Analytical sparkstrip: line + area sparkline + delta chips.
// Deliberately different visual language from SectorTrendBars (bars).
import type { Bucket } from "./momentum";

function pctDelta(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / Math.abs(a)) * 100;
}

function fmtDelta(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "▲" : v < 0 ? "▼" : "▪";
  return `${sign} ${Math.abs(v).toFixed(1)}%`;
}

function deltaClass(v: number | null): string {
  if (v == null || Math.abs(v) < 0.5) return "text-ink-500";
  return v > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300";
}

export function SectorSparkstrip({
  buckets,
  color,
  ariaLabel,
}: {
  buckets: Bucket[];
  color: string;
  ariaLabel?: string;
}) {
  const W = 200;
  const H = 28;
  const pad = 2;
  const n = buckets.length;

  if (!n) {
    return <div className="h-7 w-full" aria-label={ariaLabel} />;
  }

  const stepX = n > 1 ? (W - pad * 2) / (n - 1) : 0;
  const y = (v: number) => H - pad - v * (H - pad * 2);
  const points = buckets.map((b, i) => [pad + i * stepX, y(b.norm)] as const);
  const path = points.map(([x, py], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${path} L${(pad + (n - 1) * stepX).toFixed(1)},${H - pad} L${pad.toFixed(1)},${H - pad} Z`;
  const gradId = `sspark-${color.replace(/[^a-z0-9]/gi, "")}-${n}`;

  // Deltas — 6-mo (last vs 6 back) and 24-mo (last vs first).
  const last = buckets[n - 1].norm;
  const sixBack = buckets[Math.max(0, n - 7)].norm;
  const first = buckets[0].norm;
  const d6 = pctDelta(sixBack, last);
  const d24 = pctDelta(first, last);

  return (
    <div className="flex h-7 w-full items-center gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-7 flex-1" role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.30" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={path} fill="none" stroke={color} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
        {/* Latest dot */}
        <circle cx={points[n - 1][0]} cy={points[n - 1][1]} r={2} fill={color} />
      </svg>
      <div className="hidden shrink-0 items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider tabular-nums sm:flex">
        <span className={deltaClass(d6)} title="6-month change">
          6m {fmtDelta(d6)}
        </span>
        <span className="text-line-300">·</span>
        <span className={deltaClass(d24)} title="24-month change">
          24m {fmtDelta(d24)}
        </span>
      </div>
    </div>
  );
}
