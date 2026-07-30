import { COHORT_LABEL, formatCount, formatUsdShort, type ProformaResult } from "@/lib/proforma/model";

function Bars({
  rows,
  valueOf,
  labelOf,
  caption,
}: {
  rows: Array<Record<string, never>> | ProformaResult["years"];
  valueOf: (r: ProformaResult["years"][number]) => number;
  labelOf: (r: ProformaResult["years"][number]) => string;
  caption: string;
}) {
  const list = rows as ProformaResult["years"];
  const peak = Math.max(...list.map(valueOf), 1);
  return (
    <div>
      <div className="flex items-end gap-2" aria-hidden>
        {list.map((r) => (
          <div key={r.index} className="flex-1">
            <div
              className="w-full bg-ink-700"
              style={{ height: `${Math.max((valueOf(r) / peak) * 92, 2)}px` }}
            />
            <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-500">
              {labelOf(r)}
            </div>
            <div className="font-mono text-[10.5px] tabular-nums text-ink-700">
              {formatUsdShort(valueOf(r))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{caption}</p>
    </div>
  );
}

function PeriodTable({
  rows,
  heading,
}: {
  rows: ProformaResult["years"];
  heading: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <caption className="sr-only">{heading}</caption>
        <thead>
          <tr className="border-b border-line-200 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">
            <th className="py-2 pr-3 font-normal">Period</th>
            <th className="py-2 pr-3 text-right font-normal">New</th>
            <th className="py-2 pr-3 text-right font-normal">Live</th>
            <th className="py-2 pr-3 text-right font-normal">Revenue</th>
            <th className="py-2 pr-3 text-right font-normal">Cumulative</th>
            <th className="py-2 pr-3 text-right font-normal">ARR</th>
            <th className="py-2 pr-3 text-right font-normal">GDP uplift</th>
            <th className="py-2 text-right font-normal">Benefit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.index} className="border-b border-line-100 text-[13px] text-ink-950">
              <td className="py-2 pr-3 whitespace-nowrap">{r.label}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.newCountries}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatCount(r.activeCountries)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatUsdShort(r.revenueUsd)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-ink-700">
                {formatUsdShort(r.cumulativeRevenueUsd)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatUsdShort(r.arrUsd)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatUsdShort(r.upliftUsd)}</td>
              <td className="py-2 text-right tabular-nums text-ink-700">
                {r.benefitCostRatio > 0 ? `${r.benefitCostRatio.toFixed(1)}×` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Yearly and quarterly board, plus the per-state adoption ledger. */
export function ProformaBoard({ result }: { result: ProformaResult }) {
  return (
    <div className="space-y-6">
      <section className="border border-line-200 bg-paper-0 p-5 sm:p-6">
        <h2 className="font-serif text-[22px] leading-tight tracking-tight text-ink-950">
          The shape of the book
        </h2>
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <Bars
            rows={result.years}
            valueOf={(r) => r.revenueUsd}
            labelOf={(r) => `Y${r.index}`}
            caption="Agency revenue, per year"
          />
          <Bars
            rows={result.years}
            valueOf={(r) => r.upliftUsd}
            labelOf={(r) => `Y${r.index}`}
            caption="Correlated sovereign GDP uplift, per year"
          />
        </div>
      </section>

      <section className="border border-line-200 bg-paper-0 p-5 sm:p-6">
        <h2 className="font-serif text-[22px] leading-tight tracking-tight text-ink-950">By year</h2>
        <div className="mt-4">
          <PeriodTable rows={result.years} heading="Annual pro forma" />
        </div>
      </section>

      <section className="border border-line-200 bg-paper-0 p-5 sm:p-6">
        <h2 className="font-serif text-[22px] leading-tight tracking-tight text-ink-950">
          By quarter
        </h2>
        <div className="mt-4">
          <PeriodTable rows={result.quarters} heading="Quarterly pro forma" />
        </div>
      </section>

      <section className="border border-line-200 bg-paper-0 p-5 sm:p-6">
        <h2 className="font-serif text-[22px] leading-tight tracking-tight text-ink-950">
          Adoption ledger
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-700">
          Which sovereigns the pace signs, when, and what each one is modelled to be worth at full
          strength. States below the line are addressable but unsigned inside the horizon.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line-200 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">
                <th className="py-2 pr-3 font-normal">State</th>
                <th className="py-2 pr-3 font-normal">Cohort</th>
                <th className="py-2 pr-3 text-right font-normal">GDP</th>
                <th className="py-2 pr-3 text-right font-normal">Signs</th>
                <th className="py-2 pr-3 text-right font-normal">Annual uplift</th>
                <th className="py-2 text-right font-normal">pp of GDP</th>
              </tr>
            </thead>
            <tbody>
              {result.perCountry.map((c) => (
                <tr
                  key={c.code}
                  className={
                    c.signedMonth === null
                      ? "border-b border-line-100 text-[13px] text-ink-500"
                      : "border-b border-line-100 text-[13px] text-ink-950"
                  }
                >
                  <td className="py-2 pr-3">{c.name}</td>
                  <td className="py-2 pr-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
                    {COHORT_LABEL[c.cohort]}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatUsdShort(c.gdpUsd)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {c.signedMonth === null ? "—" : `Month ${c.signedMonth}`}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatUsdShort(c.fullAnnualUpliftUsd)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{c.upliftPpOfGdp.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
