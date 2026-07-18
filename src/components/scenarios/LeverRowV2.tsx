// Premium slider row for Chamber 03 Step 3. Full-width track with tick marks,
// a baseline dot at the lever's default, live Δ chips, and an impact-share
// meter that shows how much of the current |Y1 GDP Δ| this single lever is
// responsible for. Every event handler recomputes locally so the parent can
// re-run the pure engine each frame — the fan chart bends as the user drags.

import { useRef } from "react";
import { Lock, LockOpen, RotateCcw, Info } from "lucide-react";
import type { EngineInput, EngineOutput } from "@/lib/engine/v1_macro";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

function titleize(slug: string) {
  return slug.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface LeverRowV2Extras {
  rationale?: string | null;
  unit?: string | null;
  citations?: Array<{ label: string; kind?: string; ref?: string }> | null;
}

export function LeverRowV2({
  def,
  value,
  locked,
  attribution,
  totalAbsAttribution,
  extras,
  onChange,
  onToggleLock,
  onReset,
}: {
  def: EngineInput["leverDefs"][number];
  value: number;
  locked: boolean;
  attribution?: EngineOutput["attribution"][number];
  totalAbsAttribution: number;
  extras?: LeverRowV2Extras;
  onChange: (v: number) => void;
  onToggleLock: () => void;
  onReset: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dflt = def.bounds.default ?? def.bounds.min;
  const delta = value - dflt;
  const moved = Math.abs(delta) > 0.001;
  const sector = CANONICAL_SECTORS.find((c) => c.slug === def.sector_code);
  const sectorColor = `var(${sector?.cssVar ?? "--ink-500"})`;
  const contribution = attribution?.contribution_pp ?? 0;
  const impactShare =
    totalAbsAttribution > 0 ? Math.abs(contribution) / totalAbsAttribution : 0;

  const range = def.bounds.max - def.bounds.min || 1;
  const valuePct = ((value - def.bounds.min) / range) * 100;
  const dfltPct = ((dflt - def.bounds.min) / range) * 100;
  const fillLeft = Math.min(valuePct, dfltPct);
  const fillRight = Math.max(valuePct, dfltPct);

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (locked) return;
    if (e.key === "0" || (e.key === "r" && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      onChange(dflt);
    } else if (e.key.toLowerCase() === "l") {
      e.preventDefault();
      onToggleLock();
    }
    // ArrowLeft/Right handled natively by input[type=range]; step=0.5 already.
  }

  return (
    <div
      className={
        "group border-l-2 py-3 pl-3 pr-1 transition " +
        (moved ? "border-ink-950 bg-paper-100/40" : "border-line-200")
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[13px] text-ink-950">
            {titleize(def.slug)}
            {extras?.rationale && (
              <span className="relative inline-flex" tabIndex={0}>
                <Info
                  size={11}
                  className="text-ink-500 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                />
                <span className="pointer-events-none invisible absolute left-4 top-0 z-20 w-64 border border-line-200 bg-paper-0 p-2 text-[11px] leading-relaxed text-ink-700 shadow-lg opacity-0 transition group-hover:visible group-hover:opacity-100">
                  <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
                    Why this lever
                  </span>
                  {extras.rationale}
                  {extras?.citations && extras.citations.length > 0 && (
                    <span className="mt-1.5 block border-t border-line-200 pt-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                      {extras.citations.slice(0, 4).map((c, i) => (
                        <span key={i} className="mr-1.5">
                          [{c.kind ?? "src"}] {c.label}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </span>
            )}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
            <span
              className="inline-block h-2 w-2 shrink-0"
              style={{ backgroundColor: sectorColor }}
            />
            {sector?.label ?? def.sector_code}
            {extras?.unit && <span className="text-ink-500/60">· {extras.unit}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {moved && (
            <button
              type="button"
              onClick={onReset}
              aria-label="Reset lever to default"
              className="text-ink-500 hover:text-ink-950"
              title="Reset (0)"
            >
              <RotateCcw size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleLock}
            aria-label={locked ? "Unlock lever" : "Lock lever"}
            title={locked ? "Unlock (L)" : "Lock (L)"}
            className={locked ? "text-ink-950" : "text-ink-500 hover:text-ink-950"}
          >
            {locked ? <Lock size={11} /> : <LockOpen size={11} />}
          </button>
          <span className="w-12 text-right font-mono text-xs tabular-nums text-ink-950">
            {value.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Custom-painted track underneath a real range input */}
      <div className="relative mt-3 h-4">
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 bg-line-200" />
        <div
          className="pointer-events-none absolute top-1/2 h-[3px] -translate-y-1/2"
          style={{
            left: `${fillLeft}%`,
            width: `${Math.max(0.5, fillRight - fillLeft)}%`,
            backgroundColor: sectorColor,
            opacity: moved ? 0.9 : 0.35,
          }}
        />
        {/* Baseline (default) dot */}
        <div
          className="pointer-events-none absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink-950 bg-paper-0"
          style={{ left: `${dfltPct}%` }}
          title={`Default ${dflt.toFixed(1)}`}
        />
        <input
          ref={inputRef}
          type="range"
          min={def.bounds.min}
          max={def.bounds.max}
          step={0.5}
          value={value}
          disabled={locked}
          onChange={(e) => onChange(Number(e.target.value))}
          onKeyDown={onKey}
          aria-label={`${titleize(def.slug)} — current ${value.toFixed(1)}`}
          className="lever-native-range absolute inset-0 h-full w-full cursor-grab appearance-none bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>

      {/* Tick labels */}
      <div className="mt-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">
        <span className="tabular-nums">min {def.bounds.min}</span>
        <span className="tabular-nums">default {dflt.toFixed(1)}</span>
        <span className="tabular-nums">max {def.bounds.max}</span>
      </div>

      {/* Consequence chips */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {moved ? (
          <>
            <ChipDelta label="Δ lever" value={delta} unit="" />
            <ChipDelta
              label="Δ Y1 GDP"
              value={contribution}
              unit=" pp"
              faint={Math.abs(contribution) < 0.005}
            />
          </>
        ) : (
          <span className="font-mono text-[10px] text-ink-500">at default · drag to bend the fan →</span>
        )}
      </div>

      {/* Impact-share meter */}
      {totalAbsAttribution > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
            <span>Share of total |GDP Δ|</span>
            <span className="tabular-nums">{(impactShare * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-1 h-1 w-full bg-line-200/70">
            <div
              className="h-full transition-[width] duration-150"
              style={{
                width: `${(impactShare * 100).toFixed(1)}%`,
                backgroundColor: sectorColor,
                opacity: 0.85,
              }}
            />
          </div>
        </div>
      )}
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
