import { ArrowRight } from "lucide-react";

import {
  ExecutivePerspectiveProvider,
  useExecutivePerspective,
  type ExecutivePerspective,
} from "@/components/home/ExecutivePerspective";
import { Explain } from "@/components/explain/Explain";
import type { PlanCitationRow, PlanSectionRow } from "@/lib/sector/db";
import { summarizeSectorPlan, type PlanTarget } from "@/lib/sector/plan-summary";
import type { SectorStage } from "@/lib/sector/stages";
import { cn } from "@/lib/utils";

import { MICRO } from "./labels";

const LABELS = {
  comparison: "Source section",
  trend: "Plan reading",
  members: "Evidence strength",
  relevance: "Decision relevance",
  caution: "Status & caution",
} as const;

function perspective(
  id: string,
  title: string,
  summary: string,
  source: string,
  reading: string,
  evidence: string,
  relevance: string,
  caution: string,
): ExecutivePerspective {
  return {
    id,
    title,
    summary,
    comparison: source,
    trend: reading,
    members: evidence,
    relevance,
    caution,
    labels: LABELS,
  };
}

function PerspectiveSurface({
  item,
  children,
  className,
}: {
  item: ExecutivePerspective;
  children: React.ReactNode;
  className?: string;
}) {
  const bind = useExecutivePerspective(item);
  return (
    <div {...bind} className={cn("cursor-default outline-none", className)}>
      {children}
    </div>
  );
}

function ReadinessGauge({
  pct,
  label,
  checks,
}: {
  pct: number;
  label: string;
  checks: Array<{ label: string; passed: boolean }>;
}) {
  const r = 48;
  const c = 2 * Math.PI * r;
  const item = perspective(
    "sector-plan-readiness",
    "Plan readiness",
    `${checks.filter((check) => check.passed).length} of ${checks.length} evidence and completeness checks pass.`,
    "All ten saved sections, their citations and deterministic Auditor findings.",
    label,
    checks.map((check) => `${check.passed ? "Passed" : "Open"}: ${check.label}`).join(" · "),
    "Close the open checks before asking a second person to approve the plan.",
    "This measures review readiness, not whether the proposed outcomes have already been delivered.",
  );
  return (
    <PerspectiveSurface item={item} className="flex min-w-0 items-center gap-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" role="img" aria-label={`${pct}% plan readiness`}>
          <defs>
            <linearGradient id="sector-readiness-gradient" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--gold-300)" />
              <stop offset="100%" stopColor="var(--ink-950)" />
            </linearGradient>
          </defs>
          <g transform="rotate(-90 60 60)">
            <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line-100)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke="url(#sector-readiness-gradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct / 100)}
              className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none"
            />
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl tabular-nums text-ink-950">{pct}%</span>
          <span className="max-w-20 text-center font-mono text-[8px] uppercase tracking-[0.12em] text-ink-500">
            {label}
          </span>
        </div>
      </div>
      <div className="min-w-0 space-y-1.5">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-2 text-[11px] text-ink-700">
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                check.passed ? "bg-signal-positive" : "bg-signal-caution",
              )}
            />
            {check.label}
          </div>
        ))}
      </div>
    </PerspectiveSurface>
  );
}

function linePoints(target: PlanTarget, width: number, height: number): string {
  const known = target.values.filter((point) => point.value != null) as Array<
    (typeof target.values)[number] & { value: number }
  >;
  if (known.length < 2) return "";
  const values = known.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return target.values
    .map((point, index) =>
      point.value == null
        ? null
        : `${18 + (index * (width - 36)) / Math.max(1, target.values.length - 1)},${height - 22 - ((point.value - min) / span) * (height - 52)}`,
    )
    .filter(Boolean)
    .join(" ");
}

function TargetTrajectory({
  targets,
  stale,
  onOpen,
}: {
  targets: PlanTarget[];
  stale: boolean;
  onOpen: () => void;
}) {
  const W = 620;
  const H = 218;
  const item = perspective(
    "sector-targets",
    "Outcome target trajectory",
    targets.length
      ? `${targets.length} outcome measures chart the plan's intended direction.`
      : "The Ambition section does not yet contain a chartable target table.",
    "Ambition and choice.",
    targets.length
      ? "Each measure is normalized to reveal its direction across the plan horizon; endpoint labels preserve the saved values."
      : "Add a baseline and Year 3, 5 and 10 values to make the trajectory visible.",
    stale
      ? "The Ambition section is out of date with the country's corpus."
      : "Only values explicitly saved in the plan are used.",
    "Test whether the three outcomes express the national choice clearly enough for Cabinet and delivery teams.",
    "Planned targets are neither forecasts nor achieved results. Different units are not compared by vertical height.",
  );
  return (
    <PerspectiveSurface item={item} className="min-w-0 lg:col-span-2">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className={MICRO}>Target trajectory</div>
          <p className="mt-1 text-xs text-ink-500">Baseline → Year 3 → Year 5 → Year 10</p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="btn-ghost px-2 py-1 text-[10px]"
        >
          Open ambition <ArrowRight size={11} />
        </button>
      </div>
      {targets.length ? (
        <>
          <div className="mt-4 grid gap-x-5 gap-y-2 sm:grid-cols-3" aria-label="Target legend">
            {targets.map((target, i) => (
              <div key={target.label} className="flex min-w-0 items-start gap-2 text-[10px] leading-snug text-ink-600">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(--sector-${String(i + 3).padStart(2, "0")})` }}
                />
                <span className="min-w-0">
                  <span className="block line-clamp-2">{target.label}</span>
                  <strong className="font-mono font-normal text-ink-950">
                    {target.values.at(-1)?.raw ?? "—"}
                  </strong>
                </span>
              </div>
            ))}
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mt-1 h-auto max-h-[218px] min-h-[150px] w-full"
            role="img"
            aria-label="Planned outcome target trajectories"
          >
          <defs>
            {[0, 1, 2].map((i) => (
              <linearGradient key={i} id={`sector-target-area-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={`var(--sector-${String(i + 3).padStart(2, "0")})`}
                  stopOpacity="0.3"
                />
                <stop offset="100%" stopColor="var(--paper-0)" stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {[0, 1, 2, 3].map((i) => (
            <line
              key={i}
              x1={18 + (i * (W - 36)) / 3}
              x2={18 + (i * (W - 36)) / 3}
              y1="20"
              y2={H - 22}
              stroke="var(--line-100)"
            />
          ))}
          {targets.map((target, i) => {
            const points = linePoints(target, W, H);
            if (!points) return null;
            const coords = points.split(" ");
            const first = coords[0];
            const last = coords.at(-1);
            const area =
              first && last
                ? `M${first} L${coords.slice(1).join(" L")} L${last.split(",")[0]},${H - 22} L${first.split(",")[0]},${H - 22} Z`
                : "";
            const color = `var(--sector-${String(i + 3).padStart(2, "0")})`;
            return (
              <g key={target.label}>
                <path d={area} fill={`url(#sector-target-area-${i})`} />
                <polyline
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                {target.values.map((point, index) => {
                  const known = target.values
                    .filter((p) => p.value != null)
                    .map((p) => p.value as number);
                  if (point.value == null || known.length < 2) return null;
                  const min = Math.min(...known),
                    max = Math.max(...known),
                    span = max - min || 1,
                    x = 18 + (index * (W - 36)) / Math.max(1, target.values.length - 1),
                    y = H - 22 - ((point.value - min) / span) * (H - 52);
                  return (
                    <g key={point.period}>
                      <circle
                        cx={x}
                        cy={y}
                        r="4"
                        fill="var(--paper-0)"
                        stroke={color}
                        strokeWidth="2"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
          {(targets[0]?.values ?? []).map((point, i) => (
            <text
              key={point.period}
              x={18 + (i * (W - 36)) / Math.max(1, (targets[0]?.values.length ?? 1) - 1)}
              y={H - 4}
              textAnchor={
                i === 0 ? "start" : i === (targets[0]?.values.length ?? 1) - 1 ? "end" : "middle"
              }
              className="fill-ink-500 font-mono text-[9px] uppercase"
            >
              {point.period}
            </text>
          ))}
          </svg>
        </>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="mt-5 flex h-[190px] w-full items-center justify-center border border-dashed border-line-200 text-sm text-ink-500"
        >
          Add chartable targets in the Ambition section
        </button>
      )}
      {stale ? (
        <p className="text-xs text-signal-caution">This visual is out of date with the corpus.</p>
      ) : null}
    </PerspectiveSurface>
  );
}

export function PlanVisualSummary({
  sections,
  citations,
  onOpenStage,
}: {
  sections: PlanSectionRow[];
  citations: PlanCitationRow[];
  onOpenStage: (stage: SectorStage) => void;
}) {
  const summary = summarizeSectorPlan(sections, citations);
  const pillars = Array.from(new Set(summary.projects.map((project) => project.pillar)));
  const confirmed = summary.projects.filter((project) => project.confirmed).length;
  const evidenceTotal =
    summary.evidence.grounded + summary.evidence.needsConfirmation + summary.evidence.gaps || 1;
  const deliveryItem = perspective(
    "sector-delivery",
    "Delivery portfolio",
    `${summary.projects.length} Entry Point Projects are organized across ${pillars.length} strategy pillars.`,
    "Entry Point Projects.",
    summary.flagship
      ? `Flagship: ${summary.flagship}.`
      : "No flagship could be identified in the saved section.",
    `${confirmed} confirmed · ${summary.projects.length - confirmed} need confirmation.`,
    "Use the portfolio to test whether each pillar has an executable project and accountable owner.",
    "These are proposed projects, not evidence that implementation has begun.",
  );
  const roadmapItem = perspective(
    "sector-roadmap",
    "Planned achievement path",
    `${summary.phases.length} delivery phases are visible across the plan horizon.`,
    "Roadmap and cost envelope.",
    summary.phases.map((phase) => `${phase.label}: ${phase.achievement}`).join(" · ") ||
      "No structured phase table was found.",
    "Milestones come directly from the saved roadmap.",
    "Use each gate as a decision point before moving public funds or delivery capacity forward.",
    "Every item is a planned achievement until delivery evidence is recorded elsewhere.",
  );
  const evidenceItem = perspective(
    "sector-evidence",
    "Evidence and gaps",
    `${summary.evidence.grounded} sections are grounded without an explicit unresolved marker.`,
    "All saved plan sections, citations and Auditor notes.",
    `${summary.evidence.needsConfirmation} need confirmation · ${summary.evidence.gaps} are gaps.`,
    `${summary.evidence.citations} citations · ${summary.evidence.findings} Auditor notes.`,
    "Resolve the largest evidence gaps before approval and public communication.",
    "A grounded section can still contain judgement; inspect its cited source lines before relying on it.",
  );

  return (
    <ExecutivePerspectiveProvider>
      <section className="mb-10 border-b border-line-200 pb-8" aria-labelledby="plan-at-a-glance">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className={MICRO}>Executive visual abstract</div>
            <h2 id="plan-at-a-glance" className="mt-1 font-display text-2xl text-ink-950">
              Plan at a glance
            </h2>
          </div>
          <p className="max-w-xl text-right text-xs leading-relaxed text-ink-500">
            Planned outcomes, delivery machinery and evidence strength. Hover or focus for the
            executive perspective.
          </p>
        </div>
        <div className="grid gap-x-8 gap-y-7 lg:grid-cols-3">
          <TargetTrajectory
            targets={summary.targets}
            stale={summary.staleStages.includes("ambition")}
            onOpen={() => onOpenStage("ambition")}
          />
          <div className="border-t border-line-200 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <div className={MICRO}>
              <Explain id="sector.plan-readiness" ctx={summary.readiness}>
                Plan readiness
              </Explain>
            </div>
            <ReadinessGauge {...summary.readiness} />
          </div>
          <PerspectiveSurface item={deliveryItem} className="border-t border-line-200 pt-5">
            <div className="flex items-center justify-between">
              <div className={MICRO}>
                <Explain
                  id="sector.delivery-portfolio"
                  ctx={{ projects: summary.projects.length, confirmed }}
                >
                  Delivery portfolio
                </Explain>
              </div>
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenStage("projects");
                }}
              >
                Open projects <ArrowRight size={11} />
              </button>
            </div>
            <div
              className="mt-4 flex items-end gap-1.5"
              aria-label={`${summary.projects.length} projects across ${pillars.length} pillars`}
            >
              {pillars.length ? (
                pillars.map((pillar, i) => {
                  const count = summary.projects.filter((p) => p.pillar === pillar).length;
                  return (
                    <div key={pillar} className="min-w-0 flex-1">
                      <div className="relative h-20 bg-paper-100">
                        <div
                          className="absolute inset-x-0 bottom-0"
                          style={{
                            height: `${Math.max(12, (count / Math.max(...pillars.map((x) => summary.projects.filter((p) => p.pillar === x).length))) * 100)}%`,
                            backgroundColor: `var(--sector-${String((i % 10) + 3).padStart(2, "0")})`,
                            opacity: 0.78,
                          }}
                        />
                      </div>
                      <p className="mt-2 truncate text-[10px] text-ink-500">{pillar}</p>
                      <p className="font-mono text-sm tabular-nums text-ink-950">{count}</p>
                    </div>
                  );
                })
              ) : (
                <p className="py-8 text-sm text-ink-500">
                  Draft a project table to see the delivery portfolio.
                </p>
              )}
            </div>
            <p className="mt-3 text-xs text-ink-700">
              <span className="font-mono tabular-nums">
                {confirmed}/{summary.projects.length}
              </span>{" "}
              fully specified
              {summary.flagship
                ? ` · Flagship: ${summary.flagship}`
                : " · Flagship needs confirmation"}
            </p>
          </PerspectiveSurface>
          <PerspectiveSurface item={roadmapItem} className="border-t border-line-200 pt-5">
            <div className="flex items-center justify-between">
              <div className={MICRO}>Planned achievement path</div>
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenStage("roadmap");
                }}
              >
                Open roadmap <ArrowRight size={11} />
              </button>
            </div>
            <div className="relative mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-line-200" />
              {summary.phases.length ? (
                summary.phases.map((phase) => (
                  <div key={`${phase.label}-${phase.achievement}`} className="relative pl-6">
                    <span className="absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-gold-500 bg-paper-0" />
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">
                      {phase.label}
                    </p>
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink-700">
                      {phase.achievement}
                    </p>
                  </div>
                ))
              ) : (
                <p className="pl-6 text-sm text-ink-500">
                  Add a structured phase table to reveal the achievement path.
                </p>
              )}
            </div>
          </PerspectiveSurface>
          <PerspectiveSurface item={evidenceItem} className="border-t border-line-200 pt-5">
            <div className={MICRO}>
              <Explain id="sector.evidence-composition" ctx={summary.evidence}>
                Evidence and gaps
              </Explain>
            </div>
            <div
              className="mt-5 flex h-4 overflow-hidden bg-line-100"
              aria-label="Plan evidence composition"
            >
              <div
                className="bg-signal-positive"
                style={{ width: `${(summary.evidence.grounded / evidenceTotal) * 100}%` }}
              />
              <div
                className="bg-signal-caution"
                style={{ width: `${(summary.evidence.needsConfirmation / evidenceTotal) * 100}%` }}
              />
              <div
                className="bg-signal-negative"
                style={{ width: `${(summary.evidence.gaps / evidenceTotal) * 100}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-signal-positive">●</span> Grounded
                <br />
                <strong className="font-mono text-lg text-ink-950">
                  {summary.evidence.grounded}
                </strong>
              </div>
              <div>
                <span className="text-signal-caution">●</span> Confirm
                <br />
                <strong className="font-mono text-lg text-ink-950">
                  {summary.evidence.needsConfirmation}
                </strong>
              </div>
              <div>
                <span className="text-signal-negative">●</span> Gaps
                <br />
                <strong className="font-mono text-lg text-ink-950">{summary.evidence.gaps}</strong>
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-500">
              {summary.evidence.citations} citations · {summary.evidence.findings} Auditor notes
            </p>
          </PerspectiveSurface>
        </div>
      </section>
    </ExecutivePerspectiveProvider>
  );
}
