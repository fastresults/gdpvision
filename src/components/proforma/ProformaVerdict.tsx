import { Explain } from "@/components/explain/Explain";
import {
  formatCount,
  formatUsdShort,
  type ProformaResult,
} from "@/lib/proforma/model";

/** The verdict. Sticky on desktop — the two numbers that carry the argument. */
export function ProformaVerdict({ result }: { result: ProformaResult }) {
  const t = result.totals;

  return (
    <div className="border border-line-200 bg-paper-0">
      <div className="border-b border-line-200 px-5 py-5 sm:px-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Agency · exit ARR at month sixty
        </div>
        <div className="mt-3 font-serif text-[38px] leading-[1] tracking-tight text-ink-950 tabular-nums md:text-[44px]">
          <Explain id="pf.arr" label="Exit ARR">
            {formatUsdShort(t.exitArrUsd)}
          </Explain>
        </div>
        <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-700">
          <Explain id="pf.revenue" label="Cumulative revenue">
            {formatUsdShort(t.revenueUsd)} cumulative over five years
          </Explain>
        </div>
      </div>

      <div className="border-b border-line-200 bg-paper-50 px-5 py-5 sm:px-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Sovereign · correlated GDP uplift
        </div>
        <div className="mt-3 font-serif text-[30px] leading-[1] tracking-tight text-ink-950 tabular-nums md:text-[34px]">
          <Explain id="pf.uplift" label="Correlated GDP uplift">
            {formatUsdShort(t.upliftUsd)}
          </Explain>
        </div>
        <div className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-700">
          {formatUsdShort(t.upliftRunRateAtEndUsd)} per year, running at month sixty
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-line-200 border-b border-line-200 text-center">
        <div className="px-2 py-4">
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">Live</dt>
          <dd className="mt-2 font-serif text-[20px] text-ink-950 tabular-nums">
            <Explain id="pf.active" label="Live deployments">
              {formatCount(t.activeAtEnd)}
            </Explain>
          </dd>
        </div>
        <div className="px-2 py-4">
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">
            Benefit
          </dt>
          <dd className="mt-2 font-serif text-[20px] text-ink-950 tabular-nums">
            <Explain id="pf.bcr" label="Benefit–cost ratio">
              {t.benefitCostRatio > 0 ? `${t.benefitCostRatio.toFixed(1)}×` : "—"}
            </Explain>
          </dd>
        </div>
        <div className="px-2 py-4">
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">
            Gross profit
          </dt>
          <dd className="mt-2 font-serif text-[20px] text-ink-950 tabular-nums">
            <Explain id="pf.margin" label="Gross profit">
              {formatUsdShort(t.grossProfitUsd)}
            </Explain>
          </dd>
        </div>
      </dl>

      <div className="px-5 py-5 sm:px-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Milestones
        </div>
        <ul className="mt-3 divide-y divide-line-100">
          {result.milestones.map((m) => (
            <li key={m.key} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="text-[13px] text-ink-700">{m.label}</span>
              <span className="text-right font-mono text-[11px] tabular-nums text-ink-950">
                {formatUsdShort(m.arrUsd)} ARR
                <span className="block text-[10px] text-ink-500">
                  {formatCount(m.activeCountries)} live ·{" "}
                  {m.benefitCostRatio > 0 ? `${m.benefitCostRatio.toFixed(1)}×` : "—"}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12px] leading-relaxed text-ink-500">
          A planning instrument, not a forecast. The sovereign side runs on the same value engine as
          the public calculator, capped at 1.2 per cent of GDP per state.
        </p>
      </div>
    </div>
  );
}
