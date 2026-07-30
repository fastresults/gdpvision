import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { CHAMBERS } from "@/lib/chambers";
import { CHAMBER_LINES } from "@/lib/business-case";
import {
  ADOPTION_STOPS,
  CHAMBER_COEFFICIENTS,
  COUNTRY_PRESETS,
  DEFAULT_INPUT,
  FRAMING_QUESTIONS,
  adoptionLabel,
  computeValue,
  formatUsd,
  type Stance,
  type ValueInput,
} from "@/lib/calculator/model";
import { getValueCounsel } from "@/lib/calculator/counsel.functions";
import type { Counsel } from "@/lib/calculator/counsel.server";
import { Explain } from "@/components/explain/Explain";
import { ExplainProvider } from "@/components/explain/ExplainProvider";
// Registers every calculator rationale with the explain registry.
import type { CalcCtx } from "@/lib/explain/calculator-entries";
import "@/lib/explain/calculator-entries";

import { ArithmeticDrawer } from "./ArithmeticDrawer";
import { CalcSlider } from "./CalcSlider";
import { CounselPanel } from "./CounselPanel";
import { LeadDialog } from "./LeadDialog";
import { PrintableValueCase } from "./PrintableValueCase";
import { VerdictRail } from "./VerdictRail";

const ACCENT: Record<string, string> = Object.fromEntries(
  CHAMBERS.map((c) => [c.index, c.accentVar]),
);
const TITLE: Record<string, string> = Object.fromEntries(CHAMBERS.map((c) => [c.index, c.title]));

function StepHeading({ n, title, lede }: { n: string; title: string; lede?: string }) {
  return (
    <header className="mb-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        Step {n}
      </div>
      <h2 className="mt-3 font-serif text-[26px] leading-tight tracking-tight text-ink-950 md:text-[30px]">
        {title}
      </h2>
      {lede ? <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-700">{lede}</p> : null}
    </header>
  );
}

export function ValueCalculator() {
  const [presetCode, setPresetCode] = useState("LCA");
  const [input, setInput] = useState<ValueInput>(DEFAULT_INPUT);
  const [traceOpen, setTraceOpen] = useState(false);
  const traceRef = useRef<HTMLDivElement | null>(null);
  const [counsel, setCounsel] = useState<Counsel | null>(null);
  const [counselError, setCounselError] = useState<string | null>(null);
  const [counselLoading, setCounselLoading] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [granted, setGranted] = useState(false);

  const askCounsel = useServerFn(getValueCounsel);
  const result = useMemo(() => computeValue(input), [input]);

  const countryName =
    COUNTRY_PRESETS.find((c) => c.code === presetCode)?.name ?? "A small open economy";

  // Debounced counsel — the arithmetic never waits on it.
  const requestRef = useRef(0);
  const signature = JSON.stringify({
    c: countryName,
    g: Math.round(input.gdpUsd),
    s: input.stance,
    q: input.decisionsPerQuarter,
    l: input.latencyMonths,
    u: input.unmeasuredPct,
    t: input.topSectorSharePct,
    ch: input.chambers,
  });

  useEffect(() => {
    const id = ++requestRef.current;
    const timer = setTimeout(async () => {
      setCounselLoading(true);
      setCounselError(null);
      try {
        const res = await askCounsel({
          data: {
            country: countryName,
            gdpUsd: input.gdpUsd,
            stance: input.stance,
            upliftUsd: result.upliftUsd,
            upliftPpOfGdp: result.upliftPpOfGdp,
            returnMultiple: result.returnMultiple,
            paybackMonths: result.paybackMonths,
            latencyMonths: input.latencyMonths,
            unmeasuredPct: input.unmeasuredPct,
            topSectorSharePct: input.topSectorSharePct,
            decisionsPerQuarter: input.decisionsPerQuarter,
            highestLeverage: result.highestLeverageIndex
              ? `${result.highestLeverageIndex} · ${TITLE[result.highestLeverageIndex] ?? ""}`
              : null,
            chambers: result.chambers.map((c) => ({
              index: c.index,
              short: c.short,
              adoption: c.adoption,
              usd: Math.round(c.usd),
              mechanism: c.mechanism,
            })),
          },
        });
        if (id !== requestRef.current) return;
        if (res.ok) setCounsel(res.counsel);
        else setCounselError(res.error);
      } catch {
        if (id === requestRef.current) {
          setCounselError("The counsel service is unavailable. The arithmetic below is unaffected.");
        }
      } finally {
        if (id === requestRef.current) setCounselLoading(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  function set<K extends keyof ValueInput>(key: K, value: ValueInput[K]) {
    setInput((s) => ({ ...s, [key]: value }));
  }

  function setChamber(index: string, value: number) {
    setInput((s) => ({ ...s, chambers: { ...s.chambers, [index]: value } }));
  }

  function applyPreset(code: string) {
    setPresetCode(code);
    const p = COUNTRY_PRESETS.find((c) => c.code === code);
    if (!p) return;
    setInput((s) => ({
      ...s,
      gdpUsd: p.gdpUsd,
      publicSpendPct: p.publicSpendPct,
      topSectorSharePct: p.topSectorSharePct,
    }));
  }

  function onDownload() {
    if (granted) {
      window.print();
      return;
    }
    setLeadOpen(true);
  }

  const configuration = {
    model_version: result.model_version,
    country: countryName,
    input,
    verdict: {
      uplift_year_3_usd: Math.round(result.upliftUsd),
      uplift_pp_of_gdp: Number(result.upliftPpOfGdp.toFixed(3)),
      return_multiple: Number(result.returnMultiple.toFixed(2)),
      payback_months: result.paybackMonths,
      annual_cost_usd: result.annualCostUsd,
    },
    chambers: result.chambers.map((c) => ({
      index: c.index,
      adoption: c.adoption,
      usd: Math.round(c.usd),
    })),
  };

  return (
    <>
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-10 sm:px-6 md:px-10 md:py-16 lg:grid-cols-[1fr_380px] lg:gap-14 print:hidden">
        <div className="min-w-0 space-y-14">
          {/* Step 1 */}
          <section>
            <StepHeading
              n="01"
              title="Your economy."
              lede="Start from a reference economy or set the figures yourself. Nothing here leaves your browser until you ask for the document."
            />

            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                Reference economy
              </span>
              <select
                value={presetCode}
                onChange={(e) => applyPreset(e.target.value)}
                className="mt-2 w-full border border-line-200 bg-paper-0 px-4 py-3 text-[15px] text-ink-950 focus:border-ink-950 focus:outline-none"
              >
                {COUNTRY_PRESETS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-6 divide-y divide-line-100 border-y border-line-100">
              <CalcSlider
                label="Nominal GDP"
                value={Math.round(input.gdpUsd / 100_000_000)}
                min={2}
                max={400}
                step={1}
                readout={formatUsd(input.gdpUsd)}
                help="In hundreds of millions of US dollars. Adjust freely — the model scales with it."
                onChange={(v) => set("gdpUsd", v * 100_000_000)}
              />
              <CalcSlider
                label="Public expenditure"
                value={input.publicSpendPct}
                min={10}
                max={55}
                unit="% of GDP"
                help="General government spending. This sets the size of every pool the instrument can act on."
                onChange={(v) => set("publicSpendPct", v)}
              />
            </div>
          </section>

          {/* Step 2 */}
          <section>
            <StepHeading
              n="02"
              title="Four questions, answered from memory."
              lede="These set the size of the addressable loss. A Principal can answer all four without opening a file."
            />
            <div className="divide-y divide-line-100 border-y border-line-100">
              {FRAMING_QUESTIONS.map((q) => (
                <CalcSlider
                  key={q.key}
                  label={q.question}
                  help={q.help}
                  value={input[q.key]}
                  min={q.min}
                  max={q.max}
                  step={q.step}
                  unit={q.unit}
                  onChange={(v) => set(q.key, v)}
                />
              ))}
            </div>
          </section>

          {/* Step 3 */}
          <section>
            <StepHeading
              n="03"
              title="How far each chamber is stood up."
              lede="Not adopted, piloted, in service, embedded, institutionalised. Each slider shows what it is worth on its own."
            />
            <div className="divide-y divide-line-100 border-y border-line-100">
              {CHAMBER_COEFFICIENTS.map((c) => {
                const contribution = result.chambers.find((x) => x.index === c.index);
                return (
                  <div key={c.index}>
                    <CalcSlider
                      label={`${c.index} · ${TITLE[c.index] ?? c.short}`}
                      value={input.chambers[c.index] ?? 0}
                      min={0}
                      max={100}
                      step={25}
                      accent={ACCENT[c.index]}
                      readout={adoptionLabel(input.chambers[c.index] ?? 0)}
                      onChange={(v) => setChamber(c.index, v)}
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-3 pb-4">
                      <p className="max-w-xl text-[13px] leading-relaxed text-ink-500">
                        {c.mechanism}. {CHAMBER_LINES[c.index]?.split(".")[0]}.
                      </p>
                      <span className="font-mono text-[12px] tabular-nums text-ink-950">
                        {contribution && contribution.usd > 0 ? `+${formatUsd(contribution.usd)}` : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
              {ADOPTION_STOPS.map((s) => s.label).join(" · ")}
            </p>
          </section>

          <ArithmeticDrawer trace={result.trace} />

          <CounselPanel counsel={counsel} loading={counselLoading} error={counselError} />
        </div>

        {/* Verdict — sticky rail on desktop, in-flow on mobile */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <VerdictRail
            result={result}
            stance={input.stance}
            onStance={(s: Stance) => set("stance", s)}
            onDownload={onDownload}
          />
        </aside>
      </div>

      <LeadDialog
        open={leadOpen}
        onClose={() => setLeadOpen(false)}
        country={countryName}
        configuration={configuration}
        onGranted={() => {
          setGranted(true);
          setTimeout(() => window.print(), 250);
        }}
      />

      <PrintableValueCase
        input={input}
        result={result}
        countryName={countryName}
        counsel={counsel}
      />
    </>
  );
}
