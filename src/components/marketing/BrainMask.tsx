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

type Node = {
  x: number;
  y: number;
  r: number;
  halo: number;
  color: string;
  tier: "hub" | "mid" | "leaf";
  pulse: boolean;
  delay: number;
};

type Link = { d: string; id: string; dur: number; delay: number; color: string };

/**
 * Decorative, masked constellation used inside the hero SignatureRing's
 * open center. A living cognitive field: tiered nodes, hub-anchored chord
 * graph with traveling signal packets, and a pulsing center anchor.
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
      className="block h-full w-full gdpv-brain"
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
        {scene.links.map((l) => (
          <path key={`def-${l.id}`} id={l.id} d={l.d} />
        ))}
      </defs>

      <g mask="url(#gdpv-brain-mask)">
        {/* Counter-rotating orbit guides */}
        <g className="gdpv-brain-orbits">
          {scene.orbits.map((r, i) => (
            <circle
              key={`o-${i}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="var(--line-200)"
              strokeWidth={0.3}
              strokeDasharray="1 4"
              opacity={0.5}
            />
          ))}
        </g>

        {/* Scene layer — slow ambient rotation */}
        <g className="gdpv-brain-scene">
          {/* Chord fabric */}
          {scene.links.map((l, i) => (
            <use
              key={`l-${i}`}
              href={`#${l.id}`}
              fill="none"
              stroke={l.color}
              strokeWidth={0.6}
              strokeDasharray="3 5"
              opacity={0.4}
              style={{
                animation: `gdpv-brain-breathe 5s ease-in-out ${i * 700}ms infinite, gdpv-brain-dashmarch 8s linear ${i * 600}ms infinite`,
              }}
            />
          ))}

          {/* Nodes */}
          {scene.nodes.map((n, i) => (
            <g key={`n-${i}`}>
              {n.tier !== "leaf" ? (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.halo}
                  fill="none"
                  stroke={n.color}
                  strokeWidth={n.tier === "hub" ? 0.8 : 0.5}
                  opacity={n.tier === "hub" ? 0.5 : 0.3}
                />
              ) : null}
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={n.color}
                opacity={n.tier === "leaf" ? 0.55 : 0.95}
                style={
                  n.pulse
                    ? {
                        transformOrigin: `${n.x}px ${n.y}px`,
                        animation: `gdpv-brain-pulse ${n.tier === "hub" ? "3.2s" : "4.8s"} ease-in-out ${n.delay}ms infinite`,
                      }
                    : undefined
                }
              />
            </g>
          ))}

          {/* Traveling signal packets */}
          {scene.links.map((l, i) => (
            <circle key={`p-${i}`} r={1.8} fill={l.color} opacity={0.95}>
              <animateMotion
                dur={`${l.dur}s`}
                begin={`${l.delay}ms`}
                repeatCount="indefinite"
                rotate="auto"
              >
                <mpath href={`#${l.id}`} />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.1;0.9;1"
                dur={`${l.dur}s`}
                begin={`${l.delay}ms`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>

        {/* Center anchor — pulsing triple halo behind the label */}
        <g>
          {[0, 1300, 2600].map((delay, i) => (
            <circle
              key={`c-${i}`}
              cx={cx}
              cy={cy}
              r={6}
              fill="none"
              stroke="var(--ink-500)"
              strokeWidth={0.5}
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                animation: `gdpv-brain-halo 4s ease-out ${delay}ms infinite`,
              }}
            />
          ))}
          <circle cx={cx} cy={cy} r={2.6} fill="var(--gold-500)" opacity={0.9} />
        </g>
      </g>

      <style>{`
        .gdpv-brain-scene {
          transform-origin: 50% 50%;
          transform-box: fill-box;
          animation: gdpv-brain-rotate 80s linear infinite;
        }
        .gdpv-brain-orbits {
          transform-origin: 50% 50%;
          transform-box: fill-box;
          animation: gdpv-brain-rotate-reverse 140s linear infinite;
        }
        @keyframes gdpv-brain-rotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes gdpv-brain-rotate-reverse {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes gdpv-brain-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50%      { transform: scale(2.1); opacity: 1; }
        }
        @keyframes gdpv-brain-breathe {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 0.65; }
        }
        @keyframes gdpv-brain-dashmarch {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -32; }
        }
        @keyframes gdpv-brain-halo {
          0%   { transform: scale(0.4); opacity: 0.7; }
          100% { transform: scale(4.2); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .gdpv-brain, .gdpv-brain * { animation: none !important; }
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
  const orbits = [rMax * 0.32, rMax * 0.6, rMax * 0.88];

  const palette = CANONICAL_SECTORS.map((s) => `var(${s.cssVar})`);
  const pick = () => palette[Math.floor(rand() * palette.length)];

  const nodes: Node[] = [];

  // Hubs — 4 on the inner orbit, evenly spaced
  const hubOffset = rand() * Math.PI * 2;
  for (let i = 0; i < 4; i++) {
    const a = hubOffset + (i / 4) * Math.PI * 2;
    nodes.push({
      x: cx + Math.cos(a) * orbits[0],
      y: cy + Math.sin(a) * orbits[0],
      r: 3.2,
      halo: 7.5,
      color: pick(),
      tier: "hub",
      pulse: true,
      delay: i * 800,
    });
  }

  // Mid ring — 12 on middle orbit
  const midOffset = rand() * Math.PI * 2;
  for (let i = 0; i < 12; i++) {
    const a = midOffset + (i / 12) * Math.PI * 2 + (rand() - 0.5) * 0.12;
    const jitter = 1 + (rand() - 0.5) * 0.1;
    nodes.push({
      x: cx + Math.cos(a) * orbits[1] * jitter,
      y: cy + Math.sin(a) * orbits[1] * jitter,
      r: 2.0,
      halo: 4.5,
      color: pick(),
      tier: "mid",
      pulse: i % 3 === 0,
      delay: i * 400,
    });
  }

  // Leaf scatter — 18 on outer orbit
  const leafOffset = rand() * Math.PI * 2;
  for (let i = 0; i < 18; i++) {
    const a = leafOffset + (i / 18) * Math.PI * 2 + (rand() - 0.5) * 0.24;
    const jitter = 1 + (rand() - 0.5) * 0.14;
    nodes.push({
      x: cx + Math.cos(a) * orbits[2] * jitter,
      y: cy + Math.sin(a) * orbits[2] * jitter,
      r: 1.1 + rand() * 0.6,
      halo: 0,
      color: pick(),
      tier: "leaf",
      pulse: false,
      delay: 0,
    });
  }

  const hubs = nodes.filter((n) => n.tier === "hub");
  const mids = nodes.filter((n) => n.tier === "mid");

  // Chord fabric: 4 chords from center anchor, 5 hub↔mid chords
  const links: Link[] = [];

  // Center-anchored (4)
  for (let i = 0; i < 4; i++) {
    const target = i < hubs.length ? hubs[i] : mids[i];
    const mx = (cx + target.x) / 2 + (rand() - 0.5) * size * 0.06;
    const my = (cy + target.y) / 2 + (rand() - 0.5) * size * 0.06;
    links.push({
      d: `M ${cx} ${cy} Q ${mx} ${my} ${target.x} ${target.y}`,
      id: `gdpv-link-c${i}`,
      dur: 4 + rand() * 3,
      delay: i * 900,
      color: target.color,
    });
  }

  // Hub ↔ mid (5)
  for (let i = 0; i < 5; i++) {
    const a = hubs[i % hubs.length];
    const b = mids[Math.floor(rand() * mids.length)];
    if (!a || !b) continue;
    const mx = (a.x + b.x) / 2 + (rand() - 0.5) * size * 0.14;
    const my = (a.y + b.y) / 2 + (rand() - 0.5) * size * 0.14;
    links.push({
      d: `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`,
      id: `gdpv-link-h${i}`,
      dur: 5 + rand() * 2.5,
      delay: 500 + i * 750,
      color: a.color,
    });
  }

  return { orbits, nodes, links };
}
