import type { StandardCard } from "@/lib/standards/audit.functions";
import { cn } from "@/lib/utils";

import { type StandardsPerspective, useStandardsPerspective } from "./StandardsPerspective";

export function StandardsRow({
  standards,
  active,
  onSelect,
}: {
  standards: StandardCard[];
  active: string | null;
  onSelect: (code: string | null) => void;
}) {
  if (standards.length === 0) return null;
  const sorted = [...standards].sort((a, b) => b.weightedPct - a.weightedPct);
  return (
    <section className="mb-8" aria-labelledby="standards-ranking-title">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
            Comparative readiness
          </p>
          <h2 id="standards-ranking-title" className="mt-1 font-display text-xl text-ink-950">
            Standards ranking
          </h2>
        </div>
        <p className="text-xs text-ink-500">Impact-weighted · select to filter</p>
      </div>
      <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((standard, index) => (
          <StandardBullet
            key={standard.code}
            standard={standard}
            rank={index + 1}
            active={active === standard.code}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function StandardBullet({
  standard,
  rank,
  active,
  onSelect,
}: {
  standard: StandardCard;
  rank: number;
  active: boolean;
  onSelect: (code: string | null) => void;
}) {
  const perspective: StandardsPerspective = {
    id: `standard-${standard.code}`,
    title: standard.name,
    summary: `${standard.weightedPct.toFixed(1)}% impact-weighted readiness, ranked ${rank} of the standards assessed.`,
    direction:
      "Monthly direction is shown in the national momentum chart; this ranking reflects the current audit only.",
    exposure: `${standard.total - standard.met} of ${standard.total} requirements remain below fully collected status.`,
    action:
      standard.weightedPct < 50
        ? "Treat this standard as a priority workstream and open its requirements below."
        : "Protect current reporting cadence while closing the remaining requirements.",
    caution:
      "Standards with different requirement counts remain comparable here because the score is normalised by possible impact weight.",
  };
  const bind = useStandardsPerspective(perspective);
  return (
    <div {...bind} className="outline-none">
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onSelect(active ? null : standard.code)}
        className={cn(
          "btn-secondary grid w-full grid-cols-[24px_minmax(0,1fr)_48px] items-center gap-2 px-2 py-2 text-left",
          active && "border-ink-950 shadow-[inset_3px_0_0_var(--gold-500)]",
        )}
      >
        <span className="font-mono text-[10px] tabular-nums text-ink-400">
          {String(rank).padStart(2, "0")}
        </span>
        <span className="min-w-0">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-xs text-ink-950">{standard.name}</span>
            <span className="font-mono text-[9px] text-ink-500">
              {standard.met}/{standard.total}
            </span>
          </span>
          <span className="mt-1 block h-1 w-full overflow-hidden bg-line-100">
            <span
              className="block h-full bg-gradient-to-r from-gold-300 to-gold-500 transition-[width] duration-700 motion-reduce:transition-none"
              style={{ width: `${standard.weightedPct}%` }}
            />
          </span>
        </span>
        <span className="text-right font-mono text-xs tabular-nums text-ink-950">
          {standard.weightedPct.toFixed(1)}%
        </span>
      </button>
    </div>
  );
}
