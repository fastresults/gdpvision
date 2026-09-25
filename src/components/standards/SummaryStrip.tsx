import { Explain } from "@/components/explain/Explain";
import type { SnapshotPoint } from "@/lib/standards/audit.functions";
import type { AuditRow, AuditSummary, ReqStatus } from "@/lib/standards/scoring";
import type { StandardsSummaryCtx } from "@/lib/explain/standards-entries";
import { cn } from "@/lib/utils";

import { MICRO, STATUS_META } from "./labels";

const COUNT_ORDER: ReqStatus[] = ["collected", "partial", "stale", "planned", "missing"];

function Sparkline({ points }: { points: SnapshotPoint[] }) {
  const W = 132;
  const H = 32;
  const pad = 3;
  if (points.length === 0) return null;
  const vals = points.map((p) => p.weightedPct);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (i: number) =>
    points.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v: number) => (hi === lo ? H / 2 : H - pad - ((v - lo) / span) * (H - pad * 2));
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.weightedPct).toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Weighted index by month: ${points.map((p) => `${p.period} ${p.weightedPct.toFixed(1)}%`).join(", ")}`}
      className="overflow-visible"
    >
      {points.length > 1 && (
        <path d={d} fill="none" stroke="var(--gold-500)" strokeWidth={1.5} strokeLinejoin="round" />
      )}
      <circle cx={x(points.length - 1)} cy={y(last.weightedPct)} r={2.25} fill="var(--gold-500)" />
    </svg>
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
}: {
  summary: AuditSummary;
  rows: AuditRow[];
  snapshots: SnapshotPoint[];
  currentMonth: string;
  canRecord: boolean;
  recording: boolean;
  recordError: string | null;
  onRecord: () => void;
}) {
  const ctx: StandardsSummaryCtx = {
    total: summary.total,
    counts: summary.counts,
    coveragePct: summary.coveragePct,
    weightedPct: summary.weightedPct,
    rows: rows.map((r) => ({ impact: r.impact, status: r.status })),
  };
  // "vs last month": the live index against the latest snapshot of an earlier month.
  const prior = [...snapshots].reverse().find((s) => s.period < currentMonth) ?? null;
  const delta = prior ? Math.round((summary.weightedPct - prior.weightedPct) * 10) / 10 : null;

  return (
    <section className="mb-8 grid gap-6 border-y border-line-200 py-5 lg:grid-cols-[auto_auto_1fr_auto] lg:items-end lg:gap-10">
      <div>
        <div className={MICRO}>Coverage</div>
        <div className="mt-1 font-display text-4xl tabular-nums text-ink-950">
          <Explain id="standards.coverage" ctx={ctx}>
            {summary.coveragePct.toFixed(1)}%
          </Explain>
        </div>
        <div className="mt-1 text-xs text-ink-500">
          {summary.counts.collected} of {summary.total} requirements collected
        </div>
      </div>

      <div>
        <div className={MICRO}>Impact-weighted index</div>
        <div className="mt-1 font-display text-4xl tabular-nums text-ink-950">
          <Explain id="standards.weighted" ctx={ctx}>
            {summary.weightedPct.toFixed(1)}%
          </Explain>
        </div>
        <div className="mt-1 text-xs text-ink-500">
          Partial credit for partial and out-of-date items
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-3">
        {COUNT_ORDER.map((s) => (
          <div key={s} className={cn("border-l-2 pl-2.5", STATUS_META[s].border)}>
            <dt className={MICRO}>{STATUS_META[s].label}</dt>
            <dd className={cn("mt-0.5 text-lg tabular-nums", STATUS_META[s].text)}>
              {summary.counts[s]}
            </dd>
          </div>
        ))}
      </dl>

      <div className="min-w-[180px]">
        <div className={MICRO}>Weighted index, monthly</div>
        {snapshots.length === 0 ? (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-ink-500">Trend starts at the next monthly close.</p>
            {canRecord && (
              <button
                type="button"
                className="btn-ghost -ml-2 px-2 py-1 text-xs"
                disabled={recording}
                onClick={onRecord}
              >
                {recording ? "Recording…" : "Record this month now"}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-2 flex items-end gap-3">
            <Sparkline points={snapshots} />
            <div className="text-xs tabular-nums">
              {delta == null ? (
                <span className="text-ink-500">
                  First month recorded: {snapshots[snapshots.length - 1].period}
                </span>
              ) : (
                <span
                  className={
                    delta > 0
                      ? "text-signal-positive"
                      : delta < 0
                        ? "text-signal-negative"
                        : "text-ink-500"
                  }
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)} pts
                  <span className="block text-ink-500">vs {prior!.period}</span>
                </span>
              )}
            </div>
          </div>
        )}
        {recordError && <p className="mt-1 text-xs text-signal-negative">{recordError}</p>}
      </div>
    </section>
  );
}
