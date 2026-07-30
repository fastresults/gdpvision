import { CalcSlider } from "@/components/calculator/CalcSlider";
import { Explain } from "@/components/explain/Explain";
import {
  COHORT_LABEL,
  formatUsdShort,
  type CohortKey,
  type ProformaInput,
} from "@/lib/proforma/model";
import type { Stance } from "@/lib/calculator/model";

const STANCES: Stance[] = ["conservative", "central", "optimistic"];
const STANCE_LABEL: Record<Stance, string> = {
  conservative: "Conservative",
  central: "Central",
  optimistic: "Optimistic",
};

function Section({
  n,
  title,
  lede,
  children,
}: {
  n: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line-200 bg-paper-0 p-5 sm:p-6">
      <header className="mb-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{n}</div>
        <h2 className="mt-2 font-serif text-[22px] leading-tight tracking-tight text-ink-950">
          {title}
        </h2>
        {lede ? <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-700">{lede}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** Every assumption behind the pro forma, in the open and adjustable. */
export function AssumptionsPanel({
  input,
  onChange,
  marketSize,
}: {
  input: ProformaInput;
  onChange: (patch: Partial<ProformaInput>) => void;
  marketSize: number;
}) {
  function patchCohort(key: CohortKey, patch: Partial<{ startMonth: number; ceiling: number; arpuMultiplier: number }>) {
    onChange({
      cohorts: input.cohorts.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    });
  }

  return (
    <div className="space-y-6">
      <Section
        n="01"
        title="How fast do sovereigns adopt?"
        lede="New states signed per month, stepped by phase. Sovereign procurement is slow first and compounding later."
      >
        <div className="divide-y divide-line-100">
          <CalcSlider
            label="Months 1–6"
            help="The founding cohort. Half a state per month means one signature every two months."
            value={input.paceMonths1to6}
            min={0}
            max={4}
            step={0.25}
            readout={`${input.paceMonths1to6.toFixed(2)} / month`}
            explainId="pf.pace"
            onChange={(v) => onChange({ paceMonths1to6: v })}
          />
          <CalcSlider
            label="Months 7–12"
            help="After the first deployment is referenceable."
            value={input.paceMonths7to12}
            min={0}
            max={4}
            step={0.25}
            readout={`${input.paceMonths7to12.toFixed(2)} / month`}
            onChange={(v) => onChange({ paceMonths7to12: v })}
          />
          <CalcSlider
            label="Years 2–3"
            value={input.paceYears2to3}
            min={0}
            max={5}
            step={0.25}
            readout={`${input.paceYears2to3.toFixed(2)} / month`}
            onChange={(v) => onChange({ paceYears2to3: v })}
          />
          <CalcSlider
            label="Years 4–5"
            value={input.paceYears4to5}
            min={0}
            max={5}
            step={0.25}
            readout={`${input.paceYears4to5.toFixed(2)} / month`}
            onChange={(v) => onChange({ paceYears4to5: v })}
          />
        </div>
        <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
          Addressable market · {marketSize} states
        </p>
      </Section>

      <Section
        n="02"
        title="What does a state pay?"
        lede="One blended licence per sovereign, plus a one-time instrumentation fee at signature."
      >
        <div className="divide-y divide-line-100">
          <CalcSlider
            label="Licence per state, per month"
            value={input.arpuUsdMonth}
            min={5_000}
            max={150_000}
            step={2_500}
            readout={formatUsdShort(input.arpuUsdMonth)}
            explainId="pf.arpu"
            onChange={(v) => onChange({ arpuUsdMonth: v })}
          />
          <CalcSlider
            label="Onboarding and instrumentation fee"
            help="Charged once, in the month of signature. Covers corpus build and chamber stand-up."
            value={input.onboardingFeeUsd}
            min={0}
            max={750_000}
            step={25_000}
            readout={formatUsdShort(input.onboardingFeeUsd)}
            onChange={(v) => onChange({ onboardingFeeUsd: v })}
          />
          <CalcSlider
            label="Annual price escalator"
            value={input.escalatorPct}
            min={0}
            max={12}
            step={0.5}
            readout={`${input.escalatorPct.toFixed(1)}%`}
            onChange={(v) => onChange({ escalatorPct: v })}
          />
          <CalcSlider
            label="Monthly churn"
            help="Treat as an availability discount on the book rather than literal cancellations."
            value={input.churnPctMonth}
            min={0}
            max={3}
            step={0.1}
            readout={`${input.churnPctMonth.toFixed(1)}%`}
            explainId="pf.active"
            onChange={(v) => onChange({ churnPctMonth: v })}
          />
          <CalcSlider
            label="Delivery gross margin"
            value={input.grossMarginPct}
            min={30}
            max={92}
            step={1}
            readout={`${input.grossMarginPct}%`}
            explainId="pf.margin"
            onChange={(v) => onChange({ grossMarginPct: v })}
          />
        </div>
      </Section>

      <Section
        n="03"
        title="How deep does a state go?"
        lede="Depth and intensity drive the correlated GDP figure through the same value engine the public calculator uses."
      >
        <div className="divide-y divide-line-100">
          <CalcSlider
            label="Chambers stood up per adopter"
            value={input.chamberDepth}
            min={1}
            max={8}
            step={1}
            readout={`${input.chamberDepth} of 8`}
            explainId="pf.uplift"
            onChange={(v) => onChange({ chamberDepth: v })}
          />
          <CalcSlider
            label="Adoption intensity within each chamber"
            help="Piloted, in use, or institutionalised. A pilot earns a fraction of what it could."
            value={input.chamberIntensityPct}
            min={10}
            max={100}
            step={5}
            readout={`${input.chamberIntensityPct}%`}
            onChange={(v) => onChange({ chamberIntensityPct: v })}
          />
        </div>

        <div className="mt-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Stance</div>
          <div className="mt-3 flex border border-line-200">
            {STANCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ stance: s })}
                aria-pressed={input.stance === s}
                className={
                  input.stance === s
                    ? "btn-primary flex-1 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.14em]"
                    : "btn-ghost flex-1 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.14em]"
                }
              >
                {STANCE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section
        n="04"
        title="Where do we sell, and when?"
        lede="The Caribbean is the real market, drawn from the corpus. Expansion cohorts are modelled on a representative economy."
      >
        <div className="space-y-5">
          {input.cohorts.map((c) => (
            <div key={c.key} className="border border-line-100 p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950">
                {COHORT_LABEL[c.key]}
              </div>
              <div className="mt-1 divide-y divide-line-100">
                <CalcSlider
                  label="Opens in month"
                  value={c.startMonth}
                  min={1}
                  max={54}
                  step={1}
                  readout={`Month ${c.startMonth}`}
                  onChange={(v) => patchCohort(c.key, { startMonth: v })}
                />
                <CalcSlider
                  label="States available"
                  value={c.ceiling}
                  min={0}
                  max={c.key === "caribbean" ? 20 : 25}
                  step={1}
                  readout={`${c.ceiling}`}
                  onChange={(v) => patchCohort(c.key, { ceiling: v })}
                />
                <CalcSlider
                  label="Price multiplier"
                  value={c.arpuMultiplier}
                  min={0.4}
                  max={2}
                  step={0.05}
                  readout={`× ${c.arpuMultiplier.toFixed(2)}`}
                  onChange={(v) => patchCohort(c.key, { arpuMultiplier: v })}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[13px] leading-relaxed text-ink-500">
          <Explain id="pf.bcr" label="Benefit–cost ratio">
            The ratio the sovereign sees
          </Explain>{" "}
          is deliberately unflattering in early periods: fees begin at signature, while GDP uplift
          ramps across three years.
        </p>
      </Section>
    </div>
  );
}
