import { useMemo } from "react";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

interface BrainMaskProps {
  /** Diameter of the masked scene in px. */
  size: number;
}

// Deterministic PRNG (mulberry32) — same layout every render.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Decorative, masked constellation used inside the hero SignatureRing's
 * open center. No data, no auth, no interactivity — a marketing lyric
 * that says "there is intelligence inside the signature".
 */
export function BrainMask({ size }: BrainMaskProps) {
  const scene = useMemo(() => buildScene(size), [size]);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      aria-hidden="true"
      className="block h-full w-full"
      style={{
        // Slow ambient rotation; disabled under prefers-reduced-motion.
        animation: "gdpv-brain-rotate 120s linear infinite",
      }}
    >
      <defs>
        <radialGradient id="gdpv-brain-vignette" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="70%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="gdpv-brain-mask">
          <rect width={size} height={size} fill="url(#gdpv-brain-vignette)" />
        </mask>
      </defs>

      <g mask="url(#gdpv-brain-mask)" opacity={0.72}>
        {/* Concentric orbit guides */}
        {scene.orbits.map((r, i) => (
          <circle
            key={`o-${i}`}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--line-200)"
            strokeWidth={0.4}
            strokeDasharray="1 3"
          />
        ))}

        {/* Chord links — breathing */}
        {scene.links.map((l, i) => (
          <path
            key={`l-${i}`}
            d={l.d}
            fill="none"
            stroke="var(--line-300)"
            strokeWidth={0.5}
            strokeDasharray="4 6"
            style={{
              animation: `gdpv-brain-breathe 6s ease-in-out ${i * 700}ms infinite`,
            }}
          />
        ))}

        {/* Nodes */}
        {scene.nodes.map((n, i) => (
          <g key={`n-${i}`}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.halo}
              fill="none"
              stroke={n.color}
              strokeWidth={0.5}
              opacity={0.35}
            />
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={n.color}
              style={
                n.pulse
                  ? {
                      transformOrigin: `${n.x}px ${n.y}px`,
                      animation: `gdpv-brain-pulse 3.2s ease-in-out ${n.delay}ms infinite`,
                    }
                  : undefined
              }
            />
          </g>
        ))}
      </g>

      <style>{`
        @keyframes gdpv-brain-rotate {
          from { transform: rotate(0deg); transform-origin: 50% 50%; }
          to   { transform: rotate(360deg); transform-origin: 50% 50%; }
        }
        @keyframes gdpv-brain-pulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50%      { transform: scale(1.9); opacity: 1; }
        }
        @keyframes gdpv-brain-breathe {
          0%, 100% { stroke-dashoffset: 0; opacity: 0.35; }
          50%      { stroke-dashoffset: 20; opacity: 0.75; }
        }
        @media (prefers-reduced-motion: reduce) {
          svg[aria-hidden="true"] { animation: none !important; }
          svg[aria-hidden="true"] * { animation: none !important; }
        }
      `}</style>
    </svg>
  );
}

function buildScene(size: number) {
  const rand = rng(0x51d3);
  const cx = size / 2;
  const cy = size / 2;
  const rMax = size * 0.42;
  const orbits = [rMax * 0.35, rMax * 0.68, rMax * 0.95];

  const colors = CANONICAL_SECTORS.map((s) => `var(${s.cssVar})`);

  const nodes: Array<{
    x: number;
    y: number;
    r: number;
    halo: number;
    color: string;
    pulse: boolean;
    delay: number;
  }> = [];

  const distribution = [4, 6, 8]; // per orbit — total 18
  distribution.forEach((count, oi) => {
    const orbit = orbits[oi];
    const offset = rand() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.18;
      const jitter = 1 + (rand() - 0.5) * 0.08;
      const x = cx + Math.cos(a) * orbit * jitter;
      const y = cy + Math.sin(a) * orbit * jitter;
      const color = colors[Math.floor(rand() * colors.length)];
      nodes.push({
        x,
        y,
        r: 1.6 + rand() * 1.4,
        halo: 4 + rand() * 3,
        color,
        pulse: false,
        delay: 0,
      });
    }
  });

  // Elect 4 heartbeat nodes
  const pulseIdx = [2, 7, 11, 15];
  pulseIdx.forEach((idx, k) => {
    if (nodes[idx]) {
      nodes[idx].pulse = true;
      nodes[idx].delay = k * 850;
      nodes[idx].r = 2.4;
    }
  });

  // 4 chord links between random pairs
  const links: Array<{ d: string }> = [];
  for (let i = 0; i < 4; i++) {
    const a = nodes[Math.floor(rand() * nodes.length)];
    const b = nodes[Math.floor(rand() * nodes.length)];
    if (!a || !b || a === b) continue;
    const mx = (a.x + b.x) / 2 + (rand() - 0.5) * size * 0.12;
    const my = (a.y + b.y) / 2 + (rand() - 0.5) * size * 0.12;
    links.push({ d: `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}` });
  }

  return { orbits, nodes, links };
}
