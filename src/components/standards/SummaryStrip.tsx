import { Explain } from "@/components/explain/Explain";
import type { StandardsSummaryCtx } from "@/lib/explain/standards-entries";
import type { SnapshotPoint } from "@/lib/standards/audit.functions";
import {
  IMPACT_WEIGHT,
  type AuditRow,
  type AuditSummary,
  type ReqStatus,
} from "@/lib/standards/scoring";
import { cn } from "@/lib/utils";

import { MICRO, STATUS_META } from "./labels";
import { type StandardsPerspective, useStandardsPerspective } from "./StandardsPerspective";

const COUNT_ORDER: ReqStatus[] = ["collected", "partial", "stale", "planned", "missing"];
const STATUS_FILL: Record<ReqStatus, string> = {
  collected: "bg-signal-positive",
  partial: "bg-gold-500",
  stale: "bg-signal-caution",
  planned: "bg-scenario-tint",
  missing: "bg-signal-negative",
};

function makePerspective(
  id: string,
  title: string,
  summary: string,
  delta: number | null,
  rows: AuditRow[],
  action: string,
): StandardsPerspective {
  const highGaps = rows.filter((row) => row.impact === "high" && row.status !== "collected").length;
  return {
    id,
    title,
    summary,
    direction:
      delta == null
        ? "There is not yet enough monthly history to establish direction."
        : delta > 0
          ? `The weighted index is up ${delta.toFixed(1)} points from the prior recorded month.`
          : delta < 0
            ? `The weighted index is down ${Math.abs(delta).toFixed(1)} points from the prior recorded month.`
            : "The weighted index is unchanged from the prior recorded month.",
    exposure: `${highGaps} high-impact requirement${highGaps === 1 ? " remains" : "s remain"} below collected status.`,
    action,
    caution:
      "Scores measure evidence coverage and timeliness, not the quality of policy outcomes. Plans do not count as collected evidence.",
  };
}

function RadialGauge({
  summary,
  rows,
  delta,
  ctx,
}: {
  summary: AuditSummary;
  rows: AuditRow[];
  delta: number | null;
  ctx: StandardsSummaryCtx;
}) {
  const radiusOuter = 66;
  const radiusInner = 51;
  const circumferenceOuter = 2 * Math.PI * radiusOuter;
  const circumferenceInner = 2 * Math.PI * radiusInner;
  const perspective = makePerspective(
    "standards-audit-pulse",
    "National audit pulse",
    `${summary.coveragePct.toFixed(1)}% of requirements are fully collected; impact weighting lifts readiness to ${summary.weightedPct.toFixed(1)}%.`,
    delta,
    rows,
    "Prioritise high-impact missing and out-of-date requirements before lower-impact completeness work.",
  );
  const bind = useStandardsPerspective(perspective);

  return (
    <div {...bind} className="group relative mx-auto h-44 w-44 cursor-default outline-none sm:mx-0">
      <svg
        viewBox="0 0 176 176"
        role="img"
        aria-label={`Coverage ${summary.coveragePct.toFixed(1)} percent; weighted readiness ${summary.weightedPct.toFixed(1)} percent`}
      >
        <defs>
          <linearGradient id="audit-coverage-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--gold-300)" />
            <stop offset="100%" stopColor="var(--gold-500)" />
          </linearGradient>
          <linearGradient id="audit-weighted-gradient" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--ink-400)" />
            <stop offset="100%" stopColor="var(--ink-950)" />
          </linearGradient>
        </defs>
        <g transform="rotate(-90 88 88)">
          <circle
            cx="88"
            cy="88"
            r={radiusOuter}
            fill="none"
            stroke="var(--line-100)"
            strokeWidth="9"
          />
          <circle
            cx="88"
            cy="88"
            r={radiusOuter}
            fill="none"
            stroke="url(#audit-coverage-gradient)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumferenceOuter}
            strokeDashoffset={circumferenceOuter * (1 - summary.coveragePct / 100)}
            className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none"
          />
          <circle
            cx="88"
            cy="88"
            r={radiusInner}
            fill="none"
            stroke="var(--line-100)"
            strokeWidth="5"
          />
          <circle
            cx="88"
            cy="88"
            r={radiusInner}
            fill="none"
            stroke="url(#audit-weighted-gradient)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumferenceInner}
            strokeDashoffset={circumferenceInner * (1 - summary.weightedPct / 100)}
            className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none"
          />
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-display text-4xl tabular-nums text-ink-950">
          <Explain id="standards.coverage" ctx={ctx}>
            {summary.coveragePct.toFixed(1)}%
          </Explain>
        </div>
        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
          coverage
        </div>
        <div className="mt-1 text-[11px] tabular-nums text-ink-700">
          {summary.weightedPct.toFixed(1)}% weighted
        </div>
      </div>
    </div>
  );
}

function MomentumChart({
  points,
  summary,
  rows,
  delta,
}: {
  points: SnapshotPoint[];
  summary: AuditSummary;
  rows: AuditRow[];
  delta: number | null;
}) {
  const history = [
    ...points.slice(-11),
    {
      period: "Now",
      coveragePct: summary.coveragePct,
      weightedPct: summary.weightedPct,
      counts: summary.counts,
    },
  ];
  const W = 520;
  const H = 190;
  const px = 12;
  const py = 18;
  const values = history.flatMap((p) => [p.coveragePct, p.weightedPct]);
  const lo = Math.max(0, Math.floor((Math.min(...values) - 10) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...values) + 10) / 10) * 10);
  const span = hi - lo || 1;
  const x = (i: number) =>
    history.length === 1 ? W / 2 : px + (i * (W - px * 2)) / (history.length - 1);
  const y = (v: number) => H - py - ((v - lo) / span) * (H - py * 2);
  const line = (key: "coveragePct" | "weightedPct") =>
    history
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`)
      .join(" ");
  const weighted = line("weightedPct");
  const area = `${weighted} L${x(history.length - 1).toFixed(1)},${H - py} L${x(0).toFixed(1)},${H - py} Z`;
  const movingAverage =
    history.length >= 3
      ? history
          .map((point, i) => ({
            ...point,
            average:
              i < 2
                ? null
                : (history[i - 2].weightedPct + history[i - 1].weightedPct + point.weightedPct) / 3,
          }))
          .filter((point) => point.average != null)
      : [];
  const averagePath = movingAverage
    .map((point, i) => {
      const sourceIndex = history.findIndex((candidate) => candidate.period === point.period);
      return `${i === 0 ? "M" : "L"}${x(sourceIndex).toFixed(1)},${y(point.average ?? 0).toFixed(1)}`;
    })
    .join(" ");
  const perspective = makePerspective(
    "standards-momentum",
    "Audit momentum",
    history.length > 1
      ? `${history.length - 1} recorded month${history.length === 2 ? "" : "s"} lead to the current weighted readiness of ${summary.weightedPct.toFixed(1)}%.`
      : "This is the first audit period; a trend cannot yet be inferred.",
    delta,
    rows,
    delta != null && delta < 0
      ? "Review newly stale evidence and restore its publication cadence."
      : "Sustain collection cadence and close the largest remaining high-impact gaps.",
  );
  const bind = useStandardsPerspective(perspective);

  return (
    <div {...bind} className="min-w-0 cursor-default outline-none">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className={MICRO}>12-month momentum</div>
          <p className="mt-1 text-xs text-ink-500">
            Weighted readiness · coverage · 3-month average
          </p>
        </div>
        <div
          className={cn(
            "font-mono text-sm tabular-nums",
            delta == null
              ? "text-ink-500"
              : delta > 0
                ? "text-signal-positive"
                : delta < 0
                  ? "text-signal-negative"
                  : "text-ink-500",
          )}
        >
          {delta == null ? "First period" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} pts`}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-48 w-full overflow-visible"
        role="img"
        aria-label={`Monthly audit trend: ${history.map((p) => `${p.period} ${p.weightedPct.toFixed(1)} percent weighted`).join(", ")}`}
      >
        <defs>
          <linearGradient id="audit-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold-300)" stopOpacity="0.48" />
            <stop offset="100%" stopColor="var(--paper-0)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((portion) => (
          <line
            key={portion}
            x1={px}
            x2={W - px}
            y1={py + portion * (H - py * 2)}
            y2={py + portion * (H - py * 2)}
            stroke="var(--line-100)"
          />
        ))}
        {history.length > 1 ? <path d={area} fill="url(#audit-area-gradient)" /> : null}
        {history.length > 1 ? (
          <path
            d={line("coveragePct")}
            fill="none"
            stroke="var(--ink-300)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        ) : null}
        {history.length > 1 ? (
          <path
            d={weighted}
            fill="none"
            stroke="var(--gold-500)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        ) : null}
        {averagePath ? (
          <path
            d={averagePath}
            fill="none"
            stroke="var(--ink-950)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ) : null}
        {history.map((point, i) => (
          <circle
            key={`${point.period}-${i}`}
            cx={x(i)}
            cy={y(point.weightedPct)}
            r={i === history.length - 1 ? 4 : 2}
            fill="var(--gold-500)"
          />
        ))}
        <text x={px} y={H - 2} className="fill-ink-500 font-mono text-[9px]">
          {history[0].period}
        </text>
        <text x={W - px} y={H - 2} textAnchor="end" className="fill-ink-500 font-mono text-[9px]">
          Now
        </text>
      </svg>
    </div>
  );
}

function GapComposition({
  summary,
  rows,
  delta,
  onSelect,
}: {
  summary: AuditSummary;
  rows: AuditRow[];
  delta: number | null;
  onSelect: (status: ReqStatus) => void;
}) {
  const perspective = makePerspective(
    "standards-gap-composition",
    "Composition of the audit",
    `${summary.counts.collected} of ${summary.total} requirements are collected; ${summary.counts.missing + summary.counts.stale} are missing or out of date.`,
    delta,
    rows,
    "Open the largest non-collected segment to move directly to the underlying requirements.",
  );
  const bind = useStandardsPerspective(perspective);
  return (
    <div {...bind} className="cursor-default outline-none">
      <div className={MICRO}>Gap composition</div>
      <div
        className="mt-3 flex h-3 overflow-hidden bg-line-100"
        aria-label="Requirement status composition"
      >
        {COUNT_ORDER.map((status) =>
          summary.counts[status] ? (
            <button
              key={status}
              type="button"
              aria-label={`${STATUS_META[status].label}: ${summary.counts[status]} requirements`}
              onClick={() => onSelect(status)}
              className={cn(
                "h-full min-w-1 transition-[filter] hover:brightness-110",
                STATUS_FILL[status],
              )}
              style={{ width: `${(summary.counts[status] / summary.total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
        {COUNT_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            className="btn-ghost justify-start px-0 py-1 text-left"
            onClick={() => onSelect(status)}
          >
            <span className={cn("h-2 w-2", STATUS_FILL[status])} />
            <span className="text-[11px] text-ink-700">{STATUS_META[status].label}</span>
            <span className="ml-auto font-mono text-xs tabular-nums text-ink-950">
              {summary.counts[status]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PriorityMatrix({
  rows,
  delta,
  onSelect,
}: {
  rows: AuditRow[];
  delta: number | null;
  onSelect: (impact: string, status: ReqStatus) => void;
}) {
  const gaps = COUNT_ORDER.filter((status) => status !== "collected");
  const impacts = ["high", "medium", "low"];
  const max = Math.max(
    1,
    ...impacts.flatMap((impact) =>
      gaps.map(
        (status) => rows.filter((row) => row.impact === impact && row.status === status).length,
      ),
    ),
  );
  const perspective = makePerspective(
    "standards-priority-matrix",
    "Priority gap matrix",
    "This matrix separates urgency from volume: rows carry impact while columns show the kind of collection failure.",
    delta,
    rows,
    "Start at the upper-left exposure: high-impact missing, out-of-date, or only partially collected requirements.",
  );
  const bind = useStandardsPerspective(perspective);
  return (
    <div {...bind} className="cursor-default outline-none">
      <div className={MICRO}>Priority gap matrix</div>
      <div className="mt-3 grid grid-cols-[54px_repeat(4,minmax(34px,1fr))] gap-1 text-center">
        <span />
        {gaps.map((status) => (
          <span key={status} className="truncate font-mono text-[8px] uppercase text-ink-500">
            {STATUS_META[status].label}
          </span>
        ))}
        {impacts.map((impact) => [
          <span
            key={`${impact}-label`}
            className="self-center text-left font-mono text-[9px] uppercase text-ink-500"
          >
            {impact}
          </span>,
          ...gaps.map((status) => {
            const count = rows.filter(
              (row) => row.impact === impact && row.status === status,
            ).length;
            const level = count / max;
            return (
              <button
                key={`${impact}-${status}`}
                type="button"
                disabled={count === 0}
                onClick={() => onSelect(impact, status)}
                aria-label={`${count} ${impact}-impact ${STATUS_META[status].label.toLowerCase()} requirements`}
                className={cn(
                  "btn-secondary h-8 px-0 py-0 font-mono text-xs tabular-nums",
                  level >= 0.67
                    ? "border-signal-negative text-signal-negative"
                    : level >= 0.34
                      ? "border-gold-500 text-gold-500"
                      : "text-ink-500",
                )}
              >
                {count}
              </button>
            );
          }),
        ])}
      </div>
    </div>
  );
}

export function SummaryStrip({
  summary,
  rows,
  snapshots,
  currentMonth,
  canRecord,
  recording,
  recordError,
  onRecord,
  onSelectStatus,
  onSelectPriority,
}: {
  summary: AuditSummary;
  rows: AuditRow[];
  snapshots: SnapshotPoint[];
  currentMonth: string;
  canRecord: boolean;
  recording: boolean;
  recordError: string | null;
  onRecord: () => void;
  onSelectStatus: (status: ReqStatus) => void;
  onSelectPriority: (impact: string, status: ReqStatus) => void;
}) {
  const ctx: StandardsSummaryCtx = {
    total: summary.total,
    counts: summary.counts,
    coveragePct: summary.coveragePct,
    weightedPct: summary.weightedPct,
    rows: rows.map((r) => ({ impact: r.impact, status: r.status })),
  };
  const prior = [...snapshots].reverse().find((snapshot) => snapshot.period < currentMonth) ?? null;
  const delta = prior ? Math.round((summary.weightedPct - prior.weightedPct) * 10) / 10 : null;
  return (
    <section className="mb-8 border-y border-line-200 py-6" aria-labelledby="audit-pulse-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className={MICRO}>Executive view</div>
          <h2 id="audit-pulse-title" className="mt-1 font-display text-2xl text-ink-950">
            Audit pulse
          </h2>
        </div>
        {canRecord ? (
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-xs"
            disabled={recording}
            onClick={onRecord}
          >
            {recording ? "Recording…" : "Record this month"}
          </button>
        ) : null}
      </div>
      <div className="grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)_minmax(280px,0.75fr)] lg:items-center">
        <RadialGauge summary={summary} rows={rows} delta={delta} ctx={ctx} />
        <MomentumChart points={snapshots} summary={summary} rows={rows} delta={delta} />
        <div className="grid gap-7">
          <GapComposition summary={summary} rows={rows} delta={delta} onSelect={onSelectStatus} />
          <PriorityMatrix rows={rows} delta={delta} onSelect={onSelectPriority} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-5 border-t border-line-100 pt-3 text-[10px] text-ink-500">
        <span>
          <span className="mr-1.5 inline-block h-0.5 w-5 bg-gold-500 align-middle" />
          Impact-weighted
        </span>
        <span>
          <span className="mr-1.5 inline-block w-5 border-t border-dashed border-ink-300 align-middle" />
          Coverage
        </span>
        {snapshots.length >= 2 ? (
          <span>
            <span className="mr-1.5 inline-block h-px w-5 bg-ink-950 align-middle" />
            3-month moving average
          </span>
        ) : null}
        <span className="ml-auto">
          <Explain id="standards.weighted" ctx={ctx}>
            How this is scored
          </Explain>
        </span>
      </div>
      {recordError ? <p className="mt-2 text-xs text-signal-negative">{recordError}</p> : null}
    </section>
  );
}
