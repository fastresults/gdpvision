import { Lock, LockOpen, RotateCcw } from "lucide-react";
import type { EngineInput, EngineOutput } from "@/lib/engine/v1_macro";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

function titleize(slug: string) {
  return slug.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LeverRow({
  def,
  value,
  locked,
  attribution,
  onChange,
  onToggleLock,
  onReset,
}: {
  def: EngineInput["leverDefs"][number];
  value: number;
  locked: boolean;
  attribution?: EngineOutput["attribution"][number];
  onChange: (v: number) => void;
  onToggleLock: () => void;
  onReset: () => void;
}) {
  const dflt = def.bounds.default ?? def.bounds.min;
  const delta = value - dflt;
  const moved = Math.abs(delta) > 0.001;
  const sector = CANONICAL_SECTORS.find((c) => c.slug === def.sector_code);
  const contribution = attribution?.contribution_pp ?? 0;

  return (
    <div
      className={
        "border-l-2 py-2.5 pl-3 pr-1 transition " +
        (moved ? "border-ink-950 bg-paper-100/40" : "border-line-200")
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink-950">{titleize(def.slug)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
            <span
              className="inline-block h-2 w-2 shrink-0"
              style={{ backgroundColor: `var(${sector?.cssVar ?? "--ink-500"})` }}
            />
            {sector?.label ?? def.sector_code}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {moved && (
            <button
              type="button"
              onClick={onReset}
              aria-label="Reset lever"
              className="text-ink-500 hover:text-ink-950"
            >
              <RotateCcw size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleLock}
            aria-label={locked ? "Unlock lever" : "Lock lever"}
            className={locked ? "text-ink-950" : "text-ink-500 hover:text-ink-950"}
          >
            {locked ? <Lock size={11} /> : <LockOpen size={11} />}
          </button>
          <span className="w-10 text-right font-mono text-xs tabular-nums text-ink-950">
            {value.toFixed(1)}
          </span>
        </div>
      </div>

      <input
        type="range"
        min={def.bounds.min}
        max={def.bounds.max}
        step={0.5}
        value={value}
        disabled={locked}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full disabled:opacity-40"
      />

      <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">
        <span className="tabular-nums">min {def.bounds.min}</span>
        <span className="tabular-nums">default {dflt.toFixed(1)}</span>
        <span className="tabular-nums">max {def.bounds.max}</span>
      </div>

      {/* Consequence chip */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
          if you move this →
        </span>
        {moved ? (
          <>
            <ChipDelta label="lever" value={delta} unit="" />
            <ChipDelta
              label="Y1 GDP"
              value={contribution}
              unit=" pp"
              faint={Math.abs(contribution) < 0.005}
            />
          </>
        ) : (
          <span className="font-mono text-[10px] text-ink-500">at default · no change</span>
        )}
      </div>
    </div>
  );
}

function ChipDelta({
  label,
  value,
  unit,
  faint,
}: {
  label: string;
  value: number;
  unit: string;
  faint?: boolean;
}) {
  const positive = value > 0;
  return (
    <span className="inline-flex items-baseline gap-1 font-mono text-[10px] tabular-nums">
      <span className="text-ink-500">{label}</span>
      <span
        style={{
          color: faint
            ? "var(--ink-500)"
            : positive
              ? "var(--sector-06)"
              : "var(--sector-04)",
        }}
      >
        {positive ? "+" : ""}
        {value.toFixed(2)}
        {unit}
      </span>
    </span>
  );
}
