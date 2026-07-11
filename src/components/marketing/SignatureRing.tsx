import { useEffect, useRef, useState } from "react";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";
import { cn } from "@/lib/utils";

interface SignatureRingProps {
  /** Diameter in px (SVG is square). */
  size?: number;
  /** Skip the assemble animation. Also skipped automatically under prefers-reduced-motion. */
  animate?: boolean;
  className?: string;
}

// The National Signature — an idealized 12-segment ring rendered in the
// Sector Spectrum (PRD §10.3). Marketing uses the master mark, not a
// per-nation instance mark.
export function SignatureRing({ size = 520, animate = true, className }: SignatureRingProps) {
  const [assembled, setAssembled] = useState(false);
  const played = useRef(false);

  useEffect(() => {
    if (!animate) {
      setAssembled(true);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alreadyPlayed =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("gdpv:signature-played") === "1";
    if (reduce || alreadyPlayed) {
      setAssembled(true);
      return;
    }
    const t = window.setTimeout(() => {
      setAssembled(true);
      window.sessionStorage.setItem("gdpv:signature-played", "1");
      played.current = true;
    }, 40);
    return () => window.clearTimeout(t);
  }, [animate]);

  const cx = size / 2;
  const cy = size / 2;
  const outer = size * 0.44;
  const inner = size * 0.34;
  const segments = CANONICAL_SECTORS.length; // 12
  const gapDeg = 1.4; // hairline gap between segments
  const arcDeg = 360 / segments - gapDeg;

  const totalPct = 100 / segments;
  const description = `National Signature ring. ${segments} balanced sectors, each ${totalPct.toFixed(1)}% of the master mark: ${CANONICAL_SECTORS.map((s) => s.label).join(", ")}.`;

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={description}
        className="block h-full w-full"
      >
        {/* Hairline concentric guides */}
        <circle cx={cx} cy={cy} r={outer + 8} fill="none" stroke="var(--line-200)" strokeWidth={0.5} />
        <circle cx={cx} cy={cy} r={inner - 8} fill="none" stroke="var(--line-200)" strokeWidth={0.5} />

        {CANONICAL_SECTORS.map((sector, i) => {
          const startDeg = -90 + i * (360 / segments) + gapDeg / 2;
          const endDeg = startDeg + arcDeg;
          const d = ringSegmentPath(cx, cy, inner, outer, startDeg, endDeg);
          return (
            <path
              key={sector.slug}
              d={d}
              fill={`var(${sector.cssVar})`}
              opacity={assembled ? 1 : 0}
              style={{
                transition: `opacity var(--dur-draw) var(--ease-draw)`,
                transitionDelay: `${i * 60}ms`,
                transformOrigin: `${cx}px ${cy}px`,
              }}
            >
              <title>{sector.label}</title>
            </path>
          );
        })}
      </svg>
      {/* Screen-reader table equivalent (PRD §13.3 extended to marketing) */}
      <table className="sr-only">
        <caption>National Signature — balanced master mark, 12 sectors</caption>
        <thead>
          <tr><th>Sector</th><th>Share</th></tr>
        </thead>
        <tbody>
          {CANONICAL_SECTORS.map((s) => (
            <tr key={s.slug}><td>{s.label}</td><td>{totalPct.toFixed(1)}%</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function ringSegmentPath(
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  startDeg: number,
  endDeg: number,
) {
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  const p1 = polar(cx, cy, r2, startDeg);
  const p2 = polar(cx, cy, r2, endDeg);
  const p3 = polar(cx, cy, r1, endDeg);
  const p4 = polar(cx, cy, r1, startDeg);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${r2} ${r2} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${r1} ${r1} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}
