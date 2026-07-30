import { Explain } from "@/components/explain/Explain";
import { cn } from "@/lib/utils";

/**
 * The calculator's only input primitive. 44px touch target, engraved rail,
 * value read out in the same mono voice as the rest of the paper.
 */
export function CalcSlider({
  label,
  help,
  value,
  min,
  max,
  step = 1,
  unit,
  readout,
  accent,
  explainId,
  onChange,
  className,
}: {
  label: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Overrides the default numeric readout. */
  readout?: string;
  /** CSS custom property name, e.g. "--sector-01". */
  accent?: string;
  /** Rationale registry key — adds the interrogation affordance to the label. */
  explainId?: string;
  onChange: (v: number) => void;
  className?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className={cn("py-3", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <label className="text-[15px] leading-snug text-ink-950">
          {accent ? (
            <span
              aria-hidden
              className="mr-2 inline-block h-2 w-2 translate-y-[-1px] rounded-full align-middle"
              style={{ backgroundColor: `var(${accent})` }}
            />
          ) : null}
          {explainId ? (
            <Explain id={explainId} label={label}>
              {label}
            </Explain>
          ) : (
            label
          )}
        </label>
        <span className="shrink-0 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-700">
          {readout ?? `${value}${unit ? ` ${unit}` : ""}`}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-11 w-full cursor-pointer appearance-none bg-transparent accent-ink-950 [&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:bg-line-200 [&::-webkit-slider-thumb]:mt-[-9px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-ink-950 [&::-webkit-slider-thumb]:bg-paper-0 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-ink-950 [&::-moz-range-thumb]:bg-paper-0 [&::-moz-range-track]:h-[3px] [&::-moz-range-track]:bg-line-200"
        style={
          accent
            ? ({ ["--tw-accent" as string]: `var(${accent})`, accentColor: `var(${accent})` } as React.CSSProperties)
            : undefined
        }
      />

      <div className="mt-[-4px] h-px w-full bg-line-100" aria-hidden>
        <div
          className="h-px"
          style={{ width: `${pct}%`, backgroundColor: accent ? `var(${accent})` : "var(--ink-700)" }}
        />
      </div>

      {help ? <p className="mt-3 text-[13px] leading-relaxed text-ink-500">{help}</p> : null}
    </div>
  );
}
