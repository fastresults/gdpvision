import { Download, Loader2 } from "lucide-react";

import { ChamberWaterfall } from "./ChamberWaterfall";
import { STANCE_LABEL, formatUsd, type Stance, type ValueResult } from "@/lib/calculator/model";

const STANCES: Stance[] = ["conservative", "central", "optimistic"];

/**
 * The verdict. Sticky on desktop, a persistent sheet on mobile. It never
 * leaves the screen while the sliders move — the number is the argument.
 */
export function VerdictRail({
  result,
  stance,
  onStance,
  onDownload,
  busy,
}: {
  result: ValueResult;
  stance: Stance;
  onStance: (s: Stance) => void;
  onDownload: () => void;
  busy?: boolean;
}) {
  const peak = Math.max(...result.path.map((p) => p.usd), 1);

  return (
    <div className="border border-line-200 bg-paper-0">
      <div className="border-b border-line-200 px-5 py-5 sm:px-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Modelled uplift · year three
        </div>
        <div className="mt-3 font-serif text-[38px] leading-[1] tracking-tight text-ink-950 tabular-nums md:text-[46px]">
          {formatUsd(result.upliftUsd)}
        </div>
        <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-700">
          {result.upliftPpOfGdp.toFixed(2)} pp of GDP
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-line-200 border-b border-line-200 text-center">
        <div className="px-2 py-4">
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">Return</dt>
          <dd className="mt-2 font-serif text-[20px] text-ink-950 tabular-nums">
            {result.returnMultiple >= 1 ? `${result.returnMultiple.toFixed(1)}×` : "—"}
          </dd>
        </div>
        <div className="px-2 py-4">
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">Payback</dt>
          <dd className="mt-2 font-serif text-[20px] text-ink-950 tabular-nums">
            {result.paybackMonths === null || result.paybackMonths >= 120
              ? "—"
              : `${Math.round(result.paybackMonths)} mo`}
          </dd>
        </div>
        <div className="px-2 py-4">
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">Cost / yr</dt>
          <dd className="mt-2 font-serif text-[20px] text-ink-950 tabular-nums">
            {formatUsd(result.annualCostUsd)}
          </dd>
        </div>
      </dl>

      <div className="border-b border-line-200 px-5 py-5 sm:px-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Three-year path
        </div>
        <div className="mt-4 flex items-end gap-2" aria-hidden>
          {result.path.map((p) => (
            <div key={p.year} className="flex-1">
              <div
                className="w-full bg-ink-700"
                style={{ height: `${Math.max((p.usd / peak) * 56, 2)}px` }}
              />
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
                Y{p.year}
              </div>
              <div className="font-mono text-[10.5px] tabular-nums text-ink-700">
                {formatUsd(p.usd)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-line-200 px-5 py-5 sm:px-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          By chamber
        </div>
        <div className="mt-4">
          <ChamberWaterfall chambers={result.chambers} />
        </div>
      </div>

      <div className="border-b border-line-200 px-5 py-5 sm:px-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Stance</div>
        <div className="mt-3 flex border border-line-200">
          {STANCES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStance(s)}
              aria-pressed={stance === s}
              className={
                stance === s
                  ? "btn-primary flex-1 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.14em]"
                  : "btn-ghost flex-1 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.14em]"
              }
            >
              {STANCE_LABEL[s]}
            </button>
          ))}
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-ink-500">
          A decision-framing model, not a forecast. Every coefficient is stated, bounded, and capped
          at 1.2 per cent of GDP. Open the arithmetic to inspect all of it.
        </p>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <button
          type="button"
          onClick={onDownload}
          disabled={busy}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Download the justification
        </button>
      </div>
    </div>
  );
}
