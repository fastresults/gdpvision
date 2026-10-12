import type { ChamberDemo } from "@/lib/present/chambers";
import { CorpusMark } from "./CorpusMark";

/**
 * One chamber's circuit, drawn for the live briefing: the Second Brain feeds
 * evidence through the chamber's three stages and out as a decision. Pure
 * SVG; reveals and draws run off the `.prs-*` keyframes once the parent step
 * carries `.is-on`. Colour comes from the chamber's accent variable.
 */

const W = 560;
const H = 372;
const BRAIN_X = 62;
const BRAIN_Y = 186;
const BRAIN_R = 42;
const STAGE_X = 170;
const STAGE_W = 366;
const STAGE_H = 54;
const STAGE_Y = [80, 160, 240];
const OUT_Y = 328;

function feed(y: number) {
  const x1 = BRAIN_X + BRAIN_R;
  const x2 = STAGE_X;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${BRAIN_Y} C ${mx} ${BRAIN_Y}, ${mx} ${y}, ${x2} ${y}`;
}

export function ChamberCircuit({ demo, accentVar }: { demo: ChamberDemo; accentVar: string }) {
  const accent = `var(${accentVar})`;
  const centers = STAGE_Y.map((y) => y + STAGE_H / 2);
  const outX = STAGE_X + STAGE_W / 2;
  const drop = `M ${outX} ${STAGE_Y[2] + STAGE_H} L ${outX} ${OUT_Y - 2}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`${demo.ask} The Second Brain feeds ${demo.stages.join(", then ")}, producing ${demo.output}.`}
    >
      {/* The question */}
      <g className="prs-rise">
        <text x={BRAIN_X - BRAIN_R} y={18} className="prs-label" fill="var(--ink-500)">
          THE QUESTION
        </text>
        <text
          x={BRAIN_X - BRAIN_R}
          y={48}
          fontFamily="var(--font-display)"
          fontSize={23}
          fontStyle="italic"
          fill="var(--ink-950)"
        >
          {demo.ask}
        </text>
      </g>

      {/* The Second Brain — the live corpus */}
      <g className="prs-rise" style={{ animationDelay: "150ms" }}>
        <CorpusMark x={BRAIN_X} y={BRAIN_Y} r={BRAIN_R} accent={accent} highlight={demo.index} />
      </g>
      {/* Feed lines, brain to each stage */}
      {centers.map((cy, i) => (
        <path
          key={i}
          d={feed(cy)}
          pathLength={1}
          fill="none"
          stroke={accent}
          strokeWidth={1.5}
          className="prs-draw-n"
          style={{ animationDelay: `${450 + i * 380}ms` }}
        />
      ))}

      {/* Stages */}
      {STAGE_Y.map((y, i) => (
        <g key={i} className="prs-rise" style={{ animationDelay: `${700 + i * 380}ms` }}>
          <rect
            x={STAGE_X}
            y={y}
            width={STAGE_W}
            height={STAGE_H}
            rx={6}
            fill="var(--paper-0)"
            stroke="var(--line-200)"
          />
          <rect x={STAGE_X} y={y} width={4} height={STAGE_H} rx={2} fill={accent} />
          <path
            d={`M ${STAGE_X - 9} ${y + STAGE_H / 2 - 5} L ${STAGE_X - 1} ${y + STAGE_H / 2} L ${STAGE_X - 9} ${y + STAGE_H / 2 + 5} Z`}
            fill={accent}
          />
          <text x={STAGE_X + 18} y={y + 21} className="prs-label" fill="var(--ink-500)">
            {`STAGE ${i + 1}`}
          </text>
          <text
            x={STAGE_X + 18}
            y={y + 42}
            fontFamily="var(--font-sans)"
            fontSize={17}
            fill="var(--ink-950)"
          >
            {demo.stages[i]}
          </text>
        </g>
      ))}

      {/* Evidence travelling from the brain */}
      {centers.map((cy, i) => (
        <circle key={i} r={3.6} fill={accent} opacity={0}>
          <set attributeName="opacity" to="1" begin={`${1.8 + i * 1.1}s`} />
          <animateMotion
            dur={`${3.2 + i * 0.4}s`}
            begin={`${1.8 + i * 1.1}s`}
            repeatCount="indefinite"
            path={feed(cy)}
          />
        </circle>
      ))}

      {/* Out the other side */}
      <path
        d={drop}
        pathLength={1}
        fill="none"
        stroke="var(--ink-800)"
        strokeWidth={1.5}
        className="prs-draw-n"
        style={{ animationDelay: "1900ms" }}
      />
      <g className="prs-rise" style={{ animationDelay: "2400ms" }}>
        <path
          d={`M ${outX - 5} ${OUT_Y - 11} L ${outX} ${OUT_Y - 2} L ${outX + 5} ${OUT_Y - 11} Z`}
          fill="var(--ink-800)"
        />
        <rect
          x={STAGE_X}
          y={OUT_Y}
          width={STAGE_W}
          height={42}
          rx={21}
          fill="var(--paper-0)"
          stroke={accent}
          strokeWidth={2}
        />
        <text
          x={outX}
          y={OUT_Y + 27}
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontSize={18}
          fill="var(--ink-950)"
        >
          {demo.output}
        </text>
      </g>
    </svg>
  );
}
