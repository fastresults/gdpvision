// Chamber 07 · Ministers track — small, single-hue charts.
//
// OceanBands: for each OCEAN trait, the spread of the cast (p25–p75 box,
// min–max whisker, median tick) on a 0–100 axis, with the Ideal Profile's
// target range drawn over it in gold. StyleBands: the same for the 1–5
// decision-style dimensions. SkillBars: skills ranked by weight. SkillHeat:
// skill families × frequency, one hue light → dark. Every mark carries a
// native tooltip; values are printed beside the marks, so colour is never the
// only carrier.

import {
  OCEAN_KEYS,
  OCEAN_LABEL,
  SKILL_FAMILIES,
  SKILL_FAMILY_LABEL,
  STYLE_KEYS,
  STYLE_LABEL,
  type Aggregates,
  type Band,
  type IdealProfile,
  type SkillAggregate,
} from "@/lib/personas/portfolio/db";
import { cn } from "@/lib/utils";

function BandRow({
  label,
  band,
  target,
  min,
  max,
  lowLabel,
  highLabel,
}: {
  label: string;
  band: Band;
  target?: { low: number; high: number };
  min: number;
  max: number;
  lowLabel?: string;
  highLabel?: string;
}) {
  const x = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  const w = (a: number, b: number) => `${(Math.max(0, b - a) / (max - min)) * 100}%`;
  return (
    <div className="grid grid-cols-[140px_1fr_90px] items-center gap-3 py-1.5">
      <div className="text-xs text-ink-700">{label}</div>
      <div
        className="relative h-6"
        role="img"
        aria-label={`${label}: cast median ${band.median}, middle half ${band.p25} to ${band.p75}${target ? `; ideal ${target.low} to ${target.high}` : ""}`}
      >
        <div className="absolute inset-x-0 top-1/2 h-px bg-line-200" />
        <div
          className="absolute top-1/2 h-px bg-ink-400"
          style={{ left: x(band.min), width: w(band.min, band.max) }}
          title={`Cast range ${band.min}–${band.max}`}
        />
        <div
          className="absolute top-1/2 h-3 -translate-y-1/2 rounded-[2px] border border-ink-700 bg-paper-100"
          style={{ left: x(band.p25), width: w(band.p25, band.p75) }}
          title={`Middle half of the cast ${band.p25}–${band.p75}`}
        />
        <div
          className="absolute top-1/2 h-4 w-[2px] -translate-y-1/2 bg-ink-950"
          style={{ left: x(band.median) }}
          title={`Cast median ${band.median}`}
        />
        {target && (
          <div
            className="absolute top-0 h-[3px] rounded-[2px] bg-gold-500"
            style={{ left: x(target.low), width: w(target.low, target.high) }}
            title={`Ideal ${target.low}–${target.high}`}
          />
        )}
        {(lowLabel || highLabel) && (
          <div className="absolute inset-x-0 -bottom-2.5 flex justify-between font-mono text-[8px] uppercase tracking-[0.14em] text-ink-400">
            <span>{lowLabel}</span>
            <span>{highLabel}</span>
          </div>
        )}
      </div>
      <div className="text-right font-mono text-[11px] tabular-nums text-ink-700">
        {target ? (
          <span>
            {target.low}–{target.high}
          </span>
        ) : (
          <span>
            {band.p25}–{band.p75}
          </span>
        )}
        <span className="ml-1 text-ink-400">/ {band.median}</span>
      </div>
    </div>
  );
}

export function OceanBands({
  aggregates,
  profile,
}: {
  aggregates: Aggregates;
  profile?: IdealProfile | null;
}) {
  return (
    <figure>
      <div className="space-y-0.5">
        {OCEAN_KEYS.map((k) => (
          <BandRow
            key={k}
            label={OCEAN_LABEL[k]}
            band={aggregates.ocean[k]}
            target={profile?.personality.ocean_target[k]}
            min={0}
            max={100}
          />
        ))}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-[2px] border border-ink-700 bg-paper-100" />{" "}
          middle half of the cast
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-[2px] bg-ink-950" /> cast median
        </span>
        {profile && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[3px] w-4 rounded-[2px] bg-gold-500" /> ideal range
          </span>
        )}
        <span>
          Right column: {profile ? "ideal range / cast median" : "middle half / median"}, 0–100.
        </span>
      </figcaption>
    </figure>
  );
}

export function StyleBands({ aggregates }: { aggregates: Aggregates }) {
  return (
    <div className="space-y-2">
      {STYLE_KEYS.map((k) => (
        <BandRow
          key={k}
          label={STYLE_LABEL[k].label}
          band={aggregates.style[k]}
          min={1}
          max={5}
          lowLabel={STYLE_LABEL[k].low}
          highLabel={STYLE_LABEL[k].high}
        />
      ))}
    </div>
  );
}

export function SkillBars({
  skills,
  personas,
  highlight,
  onPick,
  limit = 20,
}: {
  skills: SkillAggregate[];
  personas: number;
  highlight?: Set<string>;
  onPick?: (code: string) => void;
  limit?: number;
}) {
  const max = Math.max(0.0001, ...skills.map((s) => s.weight));
  return (
    <ol className="space-y-1">
      {skills.slice(0, limit).map((s, i) => (
        <li key={s.code}>
          <button
            type="button"
            onClick={() => onPick?.(s.code)}
            className="btn-ghost grid w-full grid-cols-[22px_minmax(0,220px)_1fr_120px] items-center gap-3 px-1 py-1 text-left"
            title={`${s.label}: held by ${s.count} of ${personas}, mean proficiency ${s.mean_proficiency} of 5, weight ${s.weight}`}
          >
            <span className="font-mono text-[10px] tabular-nums text-ink-400">{i + 1}</span>
            <span
              className={cn(
                "truncate text-xs",
                highlight?.has(s.code) ? "text-ink-950" : "text-ink-700",
              )}
            >
              {s.label}
            </span>
            <span className="relative h-2.5">
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-r-[4px]",
                  highlight?.has(s.code) ? "bg-gold-500" : "bg-ink-700",
                )}
                style={{ width: `${(s.weight / max) * 100}%` }}
              />
            </span>
            <span className="text-right font-mono text-[10px] tabular-nums text-ink-500">
              {s.count}/{personas} · {s.mean_proficiency.toFixed(1)}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Families down, skills across, cell shade = share of the cast holding the skill. */
export function SkillHeat({
  aggregates,
  skillLabels,
  onPick,
}: {
  aggregates: Aggregates;
  skillLabels: Map<string, { label: string; family: string }>;
  onPick?: (code: string) => void;
}) {
  const byFamily = SKILL_FAMILIES.map((f) => ({
    family: f,
    cells: [...skillLabels.entries()]
      .filter(([, v]) => v.family === f)
      .map(([code, v]) => ({
        code,
        label: v.label,
        agg: aggregates.skills.find((s) => s.code === code),
      })),
  }));
  const shade = (freq: number) => {
    if (freq <= 0) return "var(--paper-50)";
    // One hue (ink), light → dark, mixed into the paper surface.
    const pct = Math.round(12 + freq * 80);
    return `color-mix(in oklab, var(--ink-950) ${pct}%, var(--paper-0))`;
  };
  return (
    <div className="space-y-2">
      {byFamily.map((row) => (
        <div key={row.family} className="grid grid-cols-[160px_1fr] items-start gap-3">
          <div className="pt-0.5 text-[11px] text-ink-700">{SKILL_FAMILY_LABEL[row.family]}</div>
          <div className="flex flex-wrap gap-[2px]">
            {row.cells.map((c) => {
              const f = c.agg?.frequency ?? 0;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => onPick?.(c.code)}
                  className="h-5 w-5 rounded-[2px] border border-line-200 focus:outline-2 focus:outline-gold-500"
                  style={{ background: shade(f) }}
                  title={`${c.label}: ${c.agg ? `${c.agg.count} of ${aggregates.personas} (${Math.round(f * 100)}%), mean proficiency ${c.agg.mean_proficiency}` : "no persona holds this"}`}
                  aria-label={`${c.label}, ${Math.round(f * 100)} percent of the cast`}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 pl-[172px] text-[10px] text-ink-500">
        <span>0%</span>
        <span
          className="h-2 w-28 rounded-[2px] border border-line-200"
          style={{
            background:
              "linear-gradient(to right, var(--paper-50), color-mix(in oklab, var(--ink-950) 92%, var(--paper-0)))",
          }}
        />
        <span>100% of the cast holds the skill</span>
      </div>
    </div>
  );
}
