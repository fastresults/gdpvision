// Figure 2 — from each chamber to the capped total. Chambers in the proposed
// sequence, each stepping up from the last, closing on the year-three total.
// The ceiling (1.2% of GDP × stance) is drawn, and so is the uncapped sum the
// ceiling discounts, so the cap is visible rather than implied.

import {
  STANCE_MULTIPLIER,
  UPLIFT_CEILING_PCT_OF_GDP,
  formatUsd,
  type ValueInput,
  type ValueResult,
} from "@/lib/calculator/model";

import { Figure, Key, MONO, type BriefPalette } from "./shared";

export function Waterfall({
  input,
  result,
  order,
  palette,
  n = 2,
}: {
  input: ValueInput;
  result: ValueResult;
  order: string[];
  palette: BriefPalette;
  n?: number;
}) {
  const ceiling =
    input.gdpUsd * (UPLIFT_CEILING_PCT_OF_GDP / 100) * STANCE_MULTIPLIER[input.stance];
  const steps = order
    .map((idx) => result.chambers.find((c) => c.index === idx))
    .filter((c): c is NonNullable<typeof c> => !!c && c.usd > 0);

  const W = 640;
  const H = 260;
  const TOP = 22;
  const BASE = H - 42;
  const LEFT = 8;
  const RIGHT = 8;
  const cols = steps.length + 1;
  const colW = (W - LEFT - RIGHT) / Math.max(cols, 1);
  // Scale to the ceiling; an uncapped sum far above it is labelled, not drawn to scale.
  const max = Math.max(ceiling * 1.18, result.upliftUsd * 1.1, 1);
  const rawOnScale = result.rawUsd <= max * 0.97;
  const y = (v: number) => BASE - ((BASE - TOP) * v) / max;

  let run = 0;
  const bars = steps.map((c, i) => {
    const from = run;
    run += c.usd;
    return { c, i, from, to: run };
  });

  return (
    <Figure
      n={n}
      title="From each chamber to the capped total"
      caption={`Year-three contributions in the proposed order. The ceiling is ${UPLIFT_CEILING_PCT_OF_GDP}% of GDP at the chosen stance (${formatUsd(ceiling)}); the dashed line is the sum before the ceiling is applied (${formatUsd(result.rawUsd)}). Contributions are scaled so they add exactly to the total.`}
      legend={
        <>
          <Key colour={palette.accent} label="Contribution" />
          <Key colour={palette.compare} label="Ceiling" />
          <Key colour={palette.muted} label="Before the cap" dashed />
        </>
      }
    >
      {steps.length === 0 ? (
        <p className="text-[13px] text-ink-500">
          No chamber is adopted; the total is nil by construction.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Waterfall of chamber contributions to ${formatUsd(result.upliftUsd)}`}
        >
          <line x1={LEFT} x2={W - RIGHT} y1={BASE} y2={BASE} stroke={palette.rule} />
          {bars.map(({ c, i, from, to }) => {
            const x = LEFT + i * colW + colW * 0.18;
            const w = colW * 0.64;
            return (
              <g key={c.index}>
                <rect
                  x={x}
                  y={y(to)}
                  width={w}
                  height={Math.max(1, y(from) - y(to))}
                  fill={palette.accent}
                  fillOpacity={0.35 + 0.65 * (c.adoption / 100)}
                  stroke={palette.accent}
                />
                {i < bars.length - 1 ? (
                  <line
                    x1={x + w}
                    x2={x + colW}
                    y1={y(to)}
                    y2={y(to)}
                    stroke={palette.rule}
                    strokeDasharray="2 2"
                  />
                ) : null}
                <text
                  x={x + w / 2}
                  y={BASE + 14}
                  fontSize="10.5"
                  textAnchor="middle"
                  fill={palette.ink}
                  fontFamily={MONO}
                >
                  {c.index}
                </text>
                <text
                  x={x + w / 2}
                  y={BASE + 27}
                  fontSize="9"
                  textAnchor="middle"
                  fill={palette.muted}
                  fontFamily={MONO}
                >
                  {formatUsd(c.usd).replace("US$", "")}
                </text>
              </g>
            );
          })}
          {(() => {
            const x = LEFT + steps.length * colW + colW * 0.12;
            const w = colW * 0.76;
            return (
              <g>
                <rect
                  x={x}
                  y={y(result.upliftUsd)}
                  width={w}
                  height={BASE - y(result.upliftUsd)}
                  fill="none"
                  stroke={palette.ink}
                  strokeWidth={1.5}
                />
                <text
                  x={x + w / 2}
                  y={BASE + 14}
                  fontSize="10.5"
                  textAnchor="middle"
                  fill={palette.ink}
                  fontFamily={MONO}
                >
                  Total
                </text>
                <text
                  x={x + w / 2}
                  y={BASE + 27}
                  fontSize="9"
                  textAnchor="middle"
                  fill={palette.ink}
                  fontFamily={MONO}
                >
                  {formatUsd(result.upliftUsd).replace("US$", "")}
                </text>
              </g>
            );
          })()}
          <line
            x1={LEFT}
            x2={W - RIGHT}
            y1={y(ceiling)}
            y2={y(ceiling)}
            stroke={palette.compare}
            strokeWidth={2}
          />
          <text
            x={W - RIGHT}
            y={y(ceiling) - 5}
            fontSize="9.5"
            textAnchor="end"
            fill={palette.ink}
            fontFamily={MONO}
          >
            Ceiling {formatUsd(ceiling)}
          </text>
          {result.rawUsd > result.upliftUsd * 1.01 ? (
            rawOnScale ? (
              <line
                x1={LEFT}
                x2={W - RIGHT}
                y1={y(result.rawUsd)}
                y2={y(result.rawUsd)}
                stroke={palette.muted}
                strokeDasharray="5 4"
              />
            ) : (
              <g>
                <line
                  x1={LEFT}
                  x2={W - RIGHT}
                  y1={TOP - 8}
                  y2={TOP - 8}
                  stroke={palette.muted}
                  strokeDasharray="5 4"
                />
                <text x={LEFT} y={TOP + 4} fontSize="9.5" fill={palette.muted} fontFamily={MONO}>
                  ↑ Before the cap {formatUsd(result.rawUsd)} (off scale)
                </text>
              </g>
            )
          ) : null}
        </svg>
      )}
    </Figure>
  );
}
