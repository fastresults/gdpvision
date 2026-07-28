/**
 * Tempo — 30 days of institutional activity in a chamber. Not a business
 * metric: the pulse of work. A flat line means the chamber has gone quiet.
 */
export function TempoSparkline({
  data,
  className = "",
}: {
  data: number[];
  className?: string;
}) {
  const w = 120;
  const h = 22;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`);
  const line = `M ${pts.join(" L ")}`;
  const area = `${line} L ${w},${h} L 0,${h} Z`;
  const silent = data.every((v) => v === 0);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`h-[22px] w-full ${className}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {!silent && <path d={area} fill="currentColor" opacity={0.08} />}
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        opacity={silent ? 0.25 : 0.85}
        className="[stroke-dasharray:240] [stroke-dashoffset:0] motion-safe:animate-[executive-draw_700ms_ease-out_both]"
      />
    </svg>
  );
}
