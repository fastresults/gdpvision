// 24-bucket vertical bar micro-trend, in the sector's hue.
// Pure inline SVG — no chart library.

import type { Bucket } from "./momentum";

export function SectorTrendBars({
  buckets,
  color,
  height = 56,
  ariaLabel,
}: {
  buckets: Bucket[];
  color: string;
  height?: number;
  ariaLabel?: string;
}) {
  const n = buckets.length || 24;
  const W = 240;
  const H = height;
  const pad = 2;
  const gap = 1.5;
  const barW = Math.max(2, (W - pad * 2 - gap * (n - 1)) / n);

  if (!buckets.length) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" aria-label={ariaLabel} role="img" />
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" aria-label={ariaLabel} role="img" preserveAspectRatio="none">
      {buckets.map((b) => {
        // Minimum bar so a "flat" series is still visible.
        const h = Math.max(3, b.norm * (H - pad * 2));
        const x = pad + b.i * (barW + gap);
        const y = H - pad - h;
        // Opacity ramp: newest bars are more opaque, older ones softer.
        const op = 0.35 + 0.65 * (b.i / (n - 1));
        return (
          <rect
            key={b.i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={1}
            fill={color}
            opacity={op}
          />
        );
      })}
    </svg>
  );
}
