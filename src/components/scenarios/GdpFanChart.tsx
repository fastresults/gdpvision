import { useMemo, useState } from "react";

type Band = { p10: number; p50: number; p90: number };

export function GdpFanChart({
  years,
  path,
  baseline = 2.0,
  ghostPath,
}: {
  years: number[];
  path: Band[];
  baseline?: number;
  /** Previous P50 path drawn as a dashed line so drag consequences are visible. */
  ghostPath?: Band[];
}) {
  const w = 640;
  const h = 220;
  const pad = { l: 36, r: 12, t: 12, b: 24 };

  const geometry = useMemo(() => {
    const all = path.flatMap((p) => [p.p10, p.p90, baseline, 0]);
    if (ghostPath) all.push(...ghostPath.map((p) => p.p50));
    const min = Math.min(...all) - 0.3;
    const max = Math.max(...all) + 0.3;
    const range = max - min || 1;
    const x = (i: number) =>
      pad.l + (i / Math.max(1, path.length - 1)) * (w - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (v - min) / range) * (h - pad.t - pad.b);

    const top = path
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.p90).toFixed(1)}`)
      .join(" ");
    const bottom = path
      .slice()
      .reverse()
      .map((p, idx) => {
        const i = path.length - 1 - idx;
        return `L${x(i).toFixed(1)},${y(p.p10).toFixed(1)}`;
      })
      .join(" ");
    const band = `${top} ${bottom} Z`;
    const median = path
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.p50).toFixed(1)}`)
      .join(" ");
    const ghost = ghostPath
      ? ghostPath
          .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.p50).toFixed(1)}`)
          .join(" ")
      : null;
    const ticks: number[] = [];
    const step = range > 6 ? 2 : range > 3 ? 1 : 0.5;
    let t = Math.ceil(min / step) * step;
    while (t <= max) {
      ticks.push(Number(t.toFixed(2)));
      t += step;
    }
    return { x, y, band, median, ghost, ticks, baselineY: y(baseline), zeroY: y(0) };
  }, [path, baseline, ghostPath]);

  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="relative min-w-0 w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="block h-56 w-full"

        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const rel = ((e.clientX - rect.left) / rect.width) * w;
          const i = Math.round(
            ((rel - pad.l) / (w - pad.l - pad.r)) * (path.length - 1),
          );
          setHover(Math.max(0, Math.min(path.length - 1, i)));
        }}
      >
        <rect x={0} y={0} width={w} height={h} fill="var(--paper-100)" />
        {geometry.ticks.map((v) => (
          <g key={v}>
            <line
              x1={pad.l}
              x2={w - pad.r}
              y1={geometry.y(v)}
              y2={geometry.y(v)}
              stroke="var(--line-200)"
              strokeWidth={0.5}
            />
            <text
              x={pad.l - 4}
              y={geometry.y(v) + 3}
              textAnchor="end"
              className="fill-current font-mono text-[9px] text-ink-500"
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <path d={geometry.band} fill="var(--sector-03)" opacity={0.18} />
        <line
          x1={pad.l}
          x2={w - pad.r}
          y1={geometry.baselineY}
          y2={geometry.baselineY}
          stroke="var(--ink-500)"
          strokeDasharray="2 3"
          strokeWidth={0.75}
        />
        <path d={geometry.median} fill="none" stroke="var(--ink-950)" strokeWidth={1.5} />
        {hover !== null && (
          <line
            x1={geometry.x(hover)}
            x2={geometry.x(hover)}
            y1={pad.t}
            y2={h - pad.b}
            stroke="var(--ink-950)"
            strokeWidth={0.5}
          />
        )}
        {years.map((y, i) => (
          <text
            key={y}
            x={geometry.x(i)}
            y={h - 6}
            textAnchor="middle"
            className="fill-current font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500"
          >
            {y}
          </text>
        ))}
      </svg>
      {hover !== null && path[hover] && (
        <div className="pointer-events-none absolute right-3 top-3 border border-line-200 bg-paper-0 px-3 py-2 font-mono text-[10px] tabular-nums text-ink-700 shadow-sm">
          <p className="text-[9px] uppercase tracking-[0.2em] text-ink-500">
            {years[hover]}
          </p>
          <p>P90 {path[hover].p90.toFixed(2)}%</p>
          <p className="text-ink-950">P50 {path[hover].p50.toFixed(2)}%</p>
          <p>P10 {path[hover].p10.toFixed(2)}%</p>
        </div>
      )}
    </div>
  );
}
