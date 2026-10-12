import { useState } from "react";
import { DEMO_COUNTRY } from "@/lib/present/chambers";
import { cn } from "@/lib/utils";
import { ElevatingGdpPuzzleMark } from "./ElevatingGdpPuzzleMark";
import { LiveFrame } from "./LiveFrame";

/**
 * "One corpus. Two worlds. You hold the switch." Patterned on the chamber
 * slides: the corpus circuit on the left (live global feeds, the sovereign
 * data center, the control switch), the live Data Sources screen on the right.
 */

const W = 560;
const H = 400;
const BX = 72;
const BY = 200;
const BR = 62;
const SX = 174;
const SW = 362;
const SH = 64;
const SY = [70, 168, 266];
const OUT_Y = 362;

const STAGES = [
  { k: "STAGE 1", t: "Live global feeds", d: "Live API and MCP links to IMF, World Bank, ECCB" },
  {
    k: "STAGE 2",
    t: "The sovereign data center",
    d: "Tax, customs, cabinet records on state hardware",
  },
  {
    k: "STAGE 3",
    t: "You hold the switch",
    d: "Toggle any source on or off · every change logged",
  },
];

function feed(y: number) {
  const x1 = BX + BR;
  const mx = (x1 + SX) / 2;
  return `M ${x1} ${BY} C ${mx} ${BY}, ${mx} ${y}, ${SX} ${y}`;
}

function CorpusCircuit() {
  const [paused, setPaused] = useState(false);
  const gold = "var(--gold-500)";
  const red = "var(--signal-negative, #B3261E)";
  const centers = SY.map((y) => y + SH / 2);
  const outX = SX + SW / 2;
  return (
    <div
      onClick={() => setPaused((p) => !p)}
      title={paused ? "Click to resume" : "Click to pause"}
      className={cn(
        "cursor-pointer",
        paused && "outline outline-1 outline-dashed outline-line-200",
      )}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label="The Second Brain draws on live global feeds and on sovereign records held in a government data center; officials switch each source on or off, producing evidence the government controls end to end."
      >
        <g className="prs-rise">
          <text x={BX - BR} y={18} className="prs-label" fill="var(--ink-500)">
            THE QUESTION
          </text>
          <text
            x={BX - BR}
            y={46}
            fontFamily="var(--font-display)"
            fontSize={22}
            fontStyle="italic"
            fill="var(--ink-950)"
          >
            Can we use the world's data and keep our own?
          </text>
        </g>

        {/* national boundary around the sovereign stage */}
        <rect
          x={SX - 10}
          y={SY[1] - 8}
          width={SW + 20}
          height={SH + 16}
          fill="none"
          stroke={red}
          strokeDasharray="4 4"
          strokeWidth={1}
          opacity={0.7}
        />

        <g className="prs-rise" style={{ animationDelay: "150ms" }}>
          <ElevatingGdpPuzzleMark x={BX} y={BY} r={BR} />
        </g>

        {centers.map((cy, i) => {
          const d = feed(cy);
          const c = i === 1 ? red : gold;
          return (
            <g key={i}>
              <path
                d={d}
                pathLength={1}
                fill="none"
                stroke={c}
                strokeWidth={1.5}
                className="prs-draw"
                style={{ animationDelay: `${400 + i * 200}ms` }}
              />
              {!paused && (
                <circle r={3} fill={c}>
                  <animateMotion
                    dur={`${3 + i * 0.6}s`}
                    repeatCount="indefinite"
                    path={d}
                    keyPoints={i === 0 ? "1;0" : "0;1"}
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                </circle>
              )}
            </g>
          );
        })}

        {STAGES.map((s, i) => (
          <g key={s.k} className="prs-rise" style={{ animationDelay: `${500 + i * 200}ms` }}>
            <rect
              x={SX}
              y={SY[i]}
              width={SW}
              height={SH}
              fill="var(--paper-0)"
              stroke="var(--line-200)"
            />
            <rect x={SX} y={SY[i]} width={3} height={SH} fill={i === 1 ? red : gold} />
            <text x={SX + 18} y={SY[i] + 20} className="prs-label" fill="var(--ink-500)">
              {s.k}
            </text>
            <text x={SX + 18} y={SY[i] + 40} fontSize={18} fill="var(--ink-950)">
              {s.t}
            </text>
            <text x={SX + 18} y={SY[i] + 56} fontSize={11} fill="var(--ink-500)">
              {s.d}
            </text>
          </g>
        ))}

        <path
          d={`M ${outX} ${SY[2] + SH} L ${outX} ${OUT_Y - 22}`}
          stroke="var(--ink-950)"
          strokeWidth={1.5}
          className="prs-draw"
          style={{ animationDelay: "1200ms" }}
        />
        <g className="prs-rise" style={{ animationDelay: "1400ms" }}>
          <rect
            x={SX}
            y={OUT_Y - 22}
            width={SW}
            height={36}
            rx={18}
            fill="var(--paper-0)"
            stroke={red}
            strokeWidth={2}
          />
          <text
            x={outX}
            y={OUT_Y + 2}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize={17}
            fill="var(--ink-950)"
          >
            Evidence the government controls, end to end
          </text>
        </g>
      </svg>
    </div>
  );
}

export function SovereignCorpusStep({ on }: { on?: boolean }) {
  const [wide, setWide] = useState(false);
  void on;
  return (
    <div
      className={cn(
        "grid w-full min-w-0 items-center gap-10 lg:gap-0",
        wide ? "grid-cols-1" : "lg:grid-cols-2",
      )}
    >
      <div className={cn("lg:pl-24 lg:pr-10", wide && "hidden")}>
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          05 · The sovereign corpus
        </div>
        <h2 className="mt-3 font-display text-[clamp(2rem,3.6vw,3.4rem)] leading-[1.02] tracking-tight text-ink-950">
          One corpus. Two worlds.
        </h2>
        <p className="mt-3 font-display text-[clamp(1.2rem,1.7vw,1.5rem)] italic leading-snug text-ink-700">
          You hold the switch.
        </p>
        <p className="mt-4 text-[clamp(1rem,1.2vw,1.15rem)] leading-[1.5] text-ink-700">
          The Second Brain listens to the world through live API and MCP connections, and keeps the
          nation's sensitive records on a mini data center the government owns. One screen decides
          which sources count.
        </p>
        <div className="mt-6 border-t border-line-200 pt-4">
          <CorpusCircuit />
        </div>
      </div>
      <div className="prs-rise min-w-0 w-full" style={{ animationDelay: "200ms" }}>
        <LiveFrame
          src={`/admin/countries/${DEMO_COUNTRY}/data`}
          label={`gdpvision.com/admin/countries/${DEMO_COUNTRY}/data`}
          title={`Data sources control panel, live for ${DEMO_COUNTRY}`}
          wide={wide}
          onWide={() => setWide(true)}
          onNarrow={() => setWide(false)}
        />
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
          This is the live control panel — toggle a source and the Second Brain re-weights.
        </p>
      </div>
    </div>
  );
}
