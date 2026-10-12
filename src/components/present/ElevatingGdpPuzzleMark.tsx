import { CHAMBERS } from "@/lib/chambers";

const STEP = 36;

function polar(x: number, y: number, r: number, degrees: number) {
  const angle = ((degrees - 90) * Math.PI) / 180;
  return [x + r * Math.cos(angle), y + r * Math.sin(angle)] as const;
}

function piecePath(x: number, y: number, inner: number, outer: number, index: number) {
  const gap = 0.8;
  const tab = outer * 0.065;
  const middle = (inner + outer) / 2;
  const start = index * STEP + gap;
  const end = (index + 1) * STEP - gap;
  const point = (radius: number, angle: number) =>
    polar(x, y, radius, angle).map((value) => value.toFixed(2)).join(" ");

  return [
    `M ${point(outer, start)}`,
    `A ${outer} ${outer} 0 0 1 ${point(outer, end)}`,
    `L ${point(middle + tab, end)}`,
    `A ${tab} ${tab} 0 0 1 ${point(middle - tab, end)}`,
    `L ${point(inner, end)}`,
    `A ${inner} ${inner} 0 0 0 ${point(inner, start)}`,
    `L ${point(middle - tab, start)}`,
    `A ${tab} ${tab} 0 0 0 ${point(middle + tab, start)}`,
    "Z",
  ].join(" ");
}

export function ElevatingGdpPuzzleMark({
  x,
  y,
  r,
}: {
  x: number;
  y: number;
  r: number;
}) {
  const inner = r * 0.59;
  const core = r * 0.48;

  return (
    <g
      className="egp-mark"
      role="img"
      aria-label="Elevating GDP: the graded and cited national Corpus at the centre, surrounded by all ten interlocking GDPVision Chambers."
    >
      <defs>
        <pattern
          id="egp-compact-hatch"
          width="3"
          height="3"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="3"
            stroke="var(--ink-700)"
            strokeWidth="0.45"
            opacity="0.3"
          />
        </pattern>
      </defs>

      <g className="egp-core" style={{ transformOrigin: `${x}px ${y}px` }}>
        <circle cx={x} cy={y} r={inner} fill="var(--paper-0)" stroke="var(--ink-700)" />
        {[core, core * 0.78].map((radius) => (
          <circle
            key={radius}
            cx={x}
            cy={y}
            r={radius}
            fill="none"
            stroke="var(--line-200)"
            strokeWidth={0.7}
            className="egp-draw"
            pathLength={1}
          />
        ))}
        <circle cx={x} cy={y} r={core * 0.57} fill="url(#egp-compact-hatch)" />
        <text x={x} y={y - 2} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={7.5} fill="var(--ink-950)" style={{ letterSpacing: "0.16em" }}>
          CORPUS
        </text>
        <text x={x} y={y + 9} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={4.5} fill="var(--ink-500)" style={{ letterSpacing: "0.12em" }}>
          GRADED · CITED
        </text>
      </g>

      {CHAMBERS.map((chamber, index) => {
        const midpoint = index * STEP + STEP / 2;
        const [tx, ty] = polar(x, y, (inner + r) / 2, midpoint);
        const [dx, dy] = polar(0, 0, r * 0.45, midpoint);
        return (
          <g
            key={chamber.index}
            className="egp-piece"
            style={{
              ["--i" as string]: index,
              ["--dx" as string]: `${dx}px`,
              ["--dy" as string]: `${dy}px`,
              transformOrigin: `${x}px ${y}px`,
            }}
          >
            <path d={piecePath(x, y, inner, r, index)} fill="var(--paper-0)" stroke="var(--ink-700)" strokeWidth={0.8} />
            <path d={piecePath(x, y, inner, r, index)} fill="url(#egp-compact-hatch)" />
            <text
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(${midpoint > 90 && midpoint < 270 ? midpoint + 180 : midpoint} ${tx} ${ty})`}
              fontFamily="var(--font-mono)"
              fontSize={6.5}
              fill="var(--ink-950)"
            >
              {chamber.index}
            </text>
          </g>
        );
      })}

      <path
        d={`M ${x} ${y - core * 0.55} C ${x + 3} ${y - r * 0.75}, ${x - 2} ${y - r * 1.12}, ${x + 7} ${y - r * 1.36}`}
        fill="none"
        stroke="var(--gold-500)"
        strokeWidth={1.1}
        className="egp-growth egp-draw"
        pathLength={1}
      />
      <g className="egp-caption">
        <line x1={x - r * 0.72} y1={y + r + 15} x2={x - r * 0.38} y2={y + r + 15} stroke="var(--gold-500)" />
        <text x={x} y={y + r + 18} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={7.5} fontWeight={600} fill="var(--ink-950)" style={{ letterSpacing: "0.2em" }}>
          ELEVATING GDP
        </text>
        <line x1={x + r * 0.38} y1={y + r + 15} x2={x + r * 0.72} y2={y + r + 15} stroke="var(--gold-500)" />
      </g>
    </g>
  );
}