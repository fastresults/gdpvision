import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Explain } from "@/components/explain/Explain";
import "@/lib/explain/portfolio-entries";

export type MinisterExposurePoint = {
  slug: string;
  name: string;
  minister: string | null;
  sectorCount: number;
  gdp: number;
};

const WIDTH = 880;
const HEIGHT = 286;
const LEFT = 42;
const RIGHT = 28;
const TOP = 34;
const BASELINE = 208;

function shortMinisterName(name: string | null): string {
  if (!name) return "Not on record";
  const cleaned = name
    .replace(/\b(hon\.?|honourable|dr\.?|sir|dame|mr\.?|mrs\.?|ms\.?)\b/gi, "")
    .replace(/\b(jr\.?|sr\.?|ii|iii|iv)\b/gi, "")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length < 2) return parts[0] ?? cleaned;
  return `${parts[0].charAt(0)}. ${parts.at(-1)}`;
}

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index++) {
    const current = points[index];
    const next = points[index + 1];
    const midpoint = (current.x + next.x) / 2;
    path += ` C ${midpoint} ${current.y}, ${midpoint} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

export function MinisterGdpExposureCurve({
  code,
  points,
}: {
  code: string;
  points: MinisterExposurePoint[];
}) {
  const ordered = useMemo(
    () => [...points].sort((a, b) => a.gdp - b.gdp || a.name.localeCompare(b.name)),
    [points],
  );
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const active = ordered.find((point) => point.slug === activeSlug) ?? null;
  const scaleMax = Math.max(
    20,
    Math.ceil(Math.max(...ordered.map((point) => point.gdp), 0) / 20) * 20,
  );
  const plotWidth = WIDTH - LEFT - RIGHT;
  const chartPoints = ordered.map((point, index) => ({
    ...point,
    x: LEFT + (ordered.length === 1 ? plotWidth / 2 : (index / (ordered.length - 1)) * plotWidth),
    y: BASELINE - (point.gdp / scaleMax) * (BASELINE - TOP),
  }));
  const line = smoothPath(chartPoints);
  const area = chartPoints.length
    ? `${line} L ${chartPoints.at(-1)?.x ?? LEFT} ${BASELINE} L ${chartPoints[0].x} ${BASELINE} Z`
    : "";

  if (ordered.length === 0) return null;

  return (
    <section
      className="mt-8 border-y border-line-200 bg-paper-50 px-4 py-5 sm:px-6"
      aria-labelledby="portfolio-exposure-title"
    >
      <div className="flex flex-col gap-3 border-b border-line-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Cabinet influence curve
          </p>
          <h3 id="portfolio-exposure-title" className="mt-1 font-serif text-xl text-ink-950">
            GDP exposure under portfolio influence
          </h3>
        </div>
        <div className="sm:max-w-xs sm:text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            Lowest → highest exposure
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            Ranked by mapped sector share, not budget or legal authority.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto pb-2 pt-4">
        <div className="relative min-w-[760px]" onMouseLeave={() => setActiveSlug(null)}>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-auto w-full"
            role="img"
            aria-label="Ministers ranked from lowest to highest GDP exposure"
          >
            <defs>
              <linearGradient id="portfolioExposureFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--signal-positive)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--signal-positive)" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((tick) => {
              const y = BASELINE - tick * (BASELINE - TOP);
              return (
                <g key={tick}>
                  <line
                    x1={LEFT}
                    x2={WIDTH - RIGHT}
                    y1={y}
                    y2={y}
                    stroke="var(--line-200)"
                    strokeWidth="1"
                  />
                  <text
                    x={LEFT - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="var(--ink-500)"
                    className="font-mono text-[9px]"
                  >
                    {Math.round(scaleMax * tick)}%
                  </text>
                </g>
              );
            })}
            <path d={area} fill="url(#portfolioExposureFill)" />
            <path
              d={line}
              fill="none"
              stroke="var(--signal-positive)"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength="1"
              className="portfolio-exposure-draw"
            />
            {chartPoints.map((point, index) => {
              const selected = activeSlug === point.slug;
              const highest = index === chartPoints.length - 1;
              return (
                <g key={point.slug}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={selected || highest ? 6 : 4.5}
                    fill={selected || highest ? "var(--signal-positive)" : "var(--paper-0)"}
                    stroke="var(--signal-positive)"
                    strokeWidth="2"
                  />
                  <text
                    x={point.x}
                    y={point.y - 12}
                    textAnchor="middle"
                    fill={highest ? "var(--signal-positive)" : "var(--ink-950)"}
                    className="font-mono text-[10px] font-medium"
                  >
                    {point.gdp > 0 ? `${point.gdp.toFixed(1)}%` : "Not measured"}
                  </text>
                  <text
                    x={point.x}
                    y={BASELINE + 24}
                    textAnchor="middle"
                    fill="var(--ink-700)"
                    className="font-mono text-[9px] uppercase"
                  >
                    {shortMinisterName(point.minister).slice(0, 13)}
                  </text>
                </g>
              );
            })}
          </svg>

          {chartPoints.map((point) => (
            <Link
              key={point.slug}
              to="/admin/countries/$code/portfolio/$ministry"
              params={{ code, ministry: point.slug }}
              onMouseEnter={() => setActiveSlug(point.slug)}
              onFocus={() => setActiveSlug(point.slug)}
              onBlur={() => setActiveSlug(null)}
              aria-label={`Open ${point.name}, ${point.gdp.toFixed(1)} percent GDP exposure`}
              className="btn-ghost absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-transparent p-0 opacity-0"
              style={{ left: `${(point.x / WIDTH) * 100}%`, top: `${(point.y / HEIGHT) * 100}%` }}
            >
              <span className="sr-only">Open portfolio</span>
            </Link>
          ))}

          {active ? (
            <div
              className="pointer-events-none absolute right-4 top-4 w-72 border border-line-200 bg-paper-0 p-3 shadow-sm"
              aria-live="polite"
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-signal-positive">
                {active.gdp.toFixed(1)}% GDP exposure
              </p>
              <p className="mt-1 text-sm font-medium text-ink-950">
                {active.minister ?? "Minister not on record"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">{active.name}</p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
                {active.sectorCount} mapped sector{active.sectorCount === 1 ? "" : "s"} · Select to
                open dossier
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-line-200 pt-3 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Portfolio exposures overlap where responsibility for a sector is shared.</p>
        <Explain
          id="portfolio.gdp-exposure"
          ctx={{ points: ordered }}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-700"
        >
          Calculation basis
        </Explain>
      </div>
    </section>
  );
}
