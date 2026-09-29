import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { CHAMBERS } from "@/lib/chambers";
import { CHAMBER_LINES } from "@/lib/business-case";
import {
  ADOPTION_STOPS,
  CHAMBER_COEFFICIENTS,
  COUNTRY_PRESETS,
  DEFAULT_INPUT,
  STANCE_MULTIPLIER,
  UPLIFT_CEILING_PCT_OF_GDP,
  FRAMING_QUESTIONS,
  adoptionLabel,
  computeValue,
  formatUsd,
  type Stance,
  type ValueInput,
} from "@/lib/calculator/model";
import { getValueCounsel } from "@/lib/calculator/counsel.functions";
import { getBriefCountries, getCountryFacts } from "@/lib/calculator/facts.functions";
import type { CountryFacts, FactGrade } from "@/lib/calculator/facts.server";
import { AdviserBox } from "@/components/brief/AdviserBox";
import { FactRail } from "@/components/brief/FactRail";
import { PrintableBrief, BRIEF_PRINT_SURFACE } from "@/components/brief/PrintableBrief";
import { HeldUp } from "@/components/brief/figures/HeldUp";
import { Peers } from "@/components/brief/figures/Peers";
import { Term, termMonths } from "@/components/brief/figures/Term";
import { Waterfall } from "@/components/brief/figures/Waterfall";
import { briefPalette } from "@/components/brief/figures/shared";
import { briefUrl, decodeBrief, encodeBrief } from "@/lib/calculator/brief-link";
import type { AdviserContext } from "@/lib/calculator/adviser.server";
import { FramingCard } from "@/components/brief/FramingCard";
import {
  EvidenceAssuranceStrip,
  EvidencePathwayModal,
  EvidenceStatus,
} from "@/components/brief/EvidenceAssurance";
import { countEvidence, type EvidenceEntry } from "@/lib/calculator/evidence";
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
import { printSurface } from "@/components/print/PrintSurface";

import { VerdictRail } from "./VerdictRail";

const ACCENT: Record<string, string> = Object.fromEntries(
  CHAMBERS.map((c) => [c.index, c.accentVar]),
);
const TITLE: Record<string, string> = Object.fromEntries(CHAMBERS.map((c) => [c.index, c.title]));

/**
 * A first-year sequence proposed from the country's own record: the Ledger
 * always first; then whichever chamber the evidence says is the weak link.
 * Adoption levels follow the order (institutionalised → piloted).
 */
function proposeSequence(facts: CountryFacts | null): {
  order: string[];
  why: Record<string, string>;
} {
  const v = (k: string) => facts?.facts.find((f) => f.key === k)?.value ?? null;
  const g = (k: string) => facts?.facts.find((f) => f.key === k)?.grade ?? "assumption";
  const scored: Array<{ index: string; score: number; why: string }> = [
    {
      index: "01",
      score: 100,
      why: "One agreed set of numbers comes first; every other chamber reads from it.",
    },
    {
      index: "06",
      score: 60 + Math.min(30, (v("follow_through") ?? 35) * 0.6),
      why: `${v("follow_through") != null ? `${Math.round(v("follow_through")!)}% of open commitments are past due` : "Follow-through is unmeasured"}; a named owner and a standing record is the cheapest recovery of value.`,
    },
    {
      index: "10",
      score: 55 + Math.min(30, (v("sectors") ?? 30) * 0.8),
      why:
        g("sectors") === "assumption"
          ? "No priority sectors are chosen yet; choosing few and planning them is the next decision."
          : `${Math.round(v("sectors") ?? 0)}% of output sits in priority sectors without an approved plan.`,
    },
    {
      index: "08",
      score: 50 + (g("latency") === "assumption" ? 20 : Math.min(30, (v("latency") ?? 6) * 4)),
      why: "Pledges decomposed to ministry-owned deliverables and scored quarterly turn intent into completed work.",
    },
    {
      index: "02",
      score: 45 + Math.min(30, (100 - (v("standards") ?? 50)) * 0.5),
      why: `${v("standards") != null ? `${Math.round(v("standards")!)}% standards coverage` : "Standards coverage unknown"}; ministers who can see their own contribution reallocate at the margin.`,
    },
    {
      index: "09",
      score: 40 + (g("government") === "assumption" ? 25 : 10),
      why:
        g("government") === "assumption"
          ? "No government record or platform PRD yet; the public site is the citizen's first contact with the state."
          : "The platform can now be fed from the record rather than typed.",
    },
    {
      index: "04",
      score: 40 + Math.min(25, ((v("top_sector") ?? 40) - 25) * 0.8),
      why: `${v("top_sector") != null ? `${Math.round(v("top_sector")!)}% of output in one sector` : "Concentration unknown"}; readiness answered before investors ask.`,
    },
    {
      index: "03",
      score: 38,
      why: "Rehearsal before commitment prices the downside while it is still avoidable.",
    },
    { index: "05", score: 30, why: "A programme that is explained survives its first bad week." },
    {
      index: "07",
      score: 25,
      why: "A rehearsal instrument for how policy lands; last because it protects rather than creates value.",
    },
  ];
  scored.sort((a, b) => b.score - a.score);
  return {
    order: scored.map((x) => x.index),
    why: Object.fromEntries(scored.map((x) => [x.index, x.why])),
  };
}

const SEQUENCE_ADOPTION = [100, 75, 75, 50, 50, 50, 25, 25, 25, 0];

function StepHeading({ n, title, lede }: { n: string; title: string; lede?: string }) {
  return (
    <header className="mb-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Step {n}</div>
      <h2 className="mt-3 font-serif text-[26px] leading-tight tracking-tight text-ink-950 md:text-[30px]">
        {title}
      </h2>
      {lede ? (
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-700">{lede}</p>
      ) : null}
    </header>
  );
}

export function ValueCalculator({
  initialCountry,
  initialConfig,
}: { initialCountry?: string; initialConfig?: string } = {}) {
  const fetchCountries = useServerFn(getBriefCountries);
  const fetchFacts = useServerFn(getCountryFacts);
  const [presetCode, setPresetCode] = useState(initialCountry ?? "LCA");
  const [input, setInput] = useState<ValueInput>(DEFAULT_INPUT);
  const [showAdjust, setShowAdjust] = useState(false);
  // A reopen link restores the configuration once, over the proposal.
  const restoreRef = useRef(decodeBrief(initialConfig));
  const [copied, setCopied] = useState(false);
  const palette = useMemo(() => briefPalette(presetCode), [presetCode]);
  const countriesQ = useQuery({ queryKey: ["brief-countries"], queryFn: () => fetchCountries() });
  const factsQ = useQuery({
    queryKey: ["brief-facts", presetCode],
    queryFn: () => fetchFacts({ data: { code: presetCode } }),
    staleTime: 60 * 60 * 1000,
  });
  const facts = factsQ.data ?? null;
  const sequence = useMemo(() => proposeSequence(facts), [facts]);
  const [traceOpen, setTraceOpen] = useState(false);
  const traceRef = useRef<HTMLDivElement | null>(null);
  const [counsel, setCounsel] = useState<Counsel | null>(null);
  const [counselError, setCounselError] = useState<string | null>(null);
  const [counselLoading, setCounselLoading] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceKey, setEvidenceKey] = useState<string | null>(null);
  const [granted, setGranted] = useState(false);

  const askCounsel = useServerFn(getValueCounsel);
  const result = useMemo(() => computeValue(input), [input]);

  const countryName =
    facts?.name ??
    countriesQ.data?.find((c) => c.code === presetCode)?.name ??
    COUNTRY_PRESETS.find((c) => c.code === presetCode)?.name ??
    "A small open economy";

  // When the record arrives, propose every framing answer it supports and the
  // chamber sequence it implies. The visitor corrects from there.
  useEffect(() => {
    if (!facts) return;
    const restored = restoreRef.current;
    if (restored) {
      restoreRef.current = null;
      setInput(restored);
      return;
    }
    const p = facts.proposed;
    const seq = proposeSequence(facts);
    setInput((s) => ({
      ...s,
      gdpUsd:
        p.gdpUsd?.value ?? COUNTRY_PRESETS.find((c) => c.code === facts.code)?.gdpUsd ?? s.gdpUsd,
      publicSpendPct: p.publicSpendPct?.value ?? s.publicSpendPct,
      topSectorSharePct: p.topSectorSharePct?.value ?? s.topSectorSharePct,
      decisionsPerQuarter: p.decisionsPerQuarter?.value ?? s.decisionsPerQuarter,
      latencyMonths: p.latencyMonths?.value ?? s.latencyMonths,
      unmeasuredPct: p.unmeasuredPct?.value ?? s.unmeasuredPct,
      servicesOfflinePct: p.servicesOfflinePct?.value ?? s.servicesOfflinePct,
      unplannedPrioritySharePct: p.unplannedPrioritySharePct?.value ?? s.unplannedPrioritySharePct,
      chambers: Object.fromEntries(seq.order.map((idx, i) => [idx, SEQUENCE_ADOPTION[i] ?? 0])),
    }));
  }, [facts]);

  const proposedFor = (key: keyof CountryFacts["proposed"]) => {
    const p = facts?.proposed[key];
    if (!p) return null;
    const f = facts?.facts.find((x) => x.key === p.fact);
    return { value: p.value, source: f?.source ?? p.fact, grade: p.grade as FactGrade };
  };
  const regionalFor = (factKey: string) =>
    facts?.facts.find((f) => f.key === factKey)?.regional?.display ?? null;
  const REGIONAL_KEY: Record<string, string> = {
    decisionsPerQuarter: "cabinet",
    latencyMonths: "latency",
    unmeasuredPct: "standards",
    topSectorSharePct: "top_sector",
    servicesOfflinePct: "government",
    unplannedPrioritySharePct: "sectors",
  };
  const INPUT_FACT: Record<string, string> = {
    gdpUsd: "gdp",
    publicSpendPct: "public_spend",
    decisionsPerQuarter: "cabinet",
    latencyMonths: "latency",
    unmeasuredPct: "standards",
    topSectorSharePct: "top_sector",
    servicesOfflinePct: "government",
    unplannedPrioritySharePct: "sectors",
  };
  const INPUT_LABEL: Record<string, string> = {
    gdpUsd: "Nominal GDP",
    publicSpendPct: "Public expenditure",
    ...Object.fromEntries(FRAMING_QUESTIONS.map((q) => [q.key, q.question])),
  };
  const REPLACEMENT: Record<string, string> = {
    gdpUsd:
      "Latest authorised national accounts release, with reporting year and responsible statistical authority.",
    publicSpendPct:
      "Approved fiscal outturn or general-government expenditure series for the same reporting period.",
    decisionsPerQuarter:
      "Cabinet decision register, filtered to decisions that commit capital, change incentives or reallocate programmes.",
    latencyMonths:
      "Dated decision and first-progress records across a representative set of priority decisions.",
    unmeasuredPct:
      "Programme expenditure mapped to approved outcomes, indicators, baselines and reporting coverage.",
    topSectorSharePct:
      "Current national accounts value-added by sector, reconciled to the selected GDP period.",
    servicesOfflinePct:
      "Government service inventory with transaction volumes and verified end-to-end digital completion status.",
    unplannedPrioritySharePct:
      "Approved priority-sector list matched to current plans, named owners and sector shares of output.",
  };

  const evidenceEntries: EvidenceEntry[] = (() => {
    const keys = ["gdpUsd", "publicSpendPct", ...FRAMING_QUESTIONS.map((q) => q.key)] as Array<
      keyof Pick<
        ValueInput,
        | "gdpUsd"
        | "publicSpendPct"
        | "decisionsPerQuarter"
        | "latencyMonths"
        | "unmeasuredPct"
        | "topSectorSharePct"
        | "servicesOfflinePct"
        | "unplannedPrioritySharePct"
      >
    >;
    return keys.map((key) => {
      const factKey = INPUT_FACT[key];
      const fact = facts?.facts.find((item) => item.key === factKey);
      const proposal = facts?.proposed[key];
      const value = input[key];
      const baseline =
        proposal?.value ??
        (key === "gdpUsd"
          ? COUNTRY_PRESETS.find((country) => country.code === presetCode)?.gdpUsd
          : key === "publicSpendPct"
            ? COUNTRY_PRESETS.find((country) => country.code === presetCode)?.publicSpendPct
            : DEFAULT_INPUT[key]);
      const tolerance = key === "gdpUsd" ? 50_000_000 : 0.001;
      const adjusted = baseline != null && Math.abs(value - baseline) > tolerance;
      const grade = proposal?.grade ?? fact?.grade ?? "assumption";
      const state = adjusted ? "adjusted" : grade === "assumption" ? "reference" : "record";
      const question = FRAMING_QUESTIONS.find((item) => item.key === key);
      return {
        key,
        label: INPUT_LABEL[key] ?? key,
        display:
          key === "gdpUsd"
            ? formatUsd(value)
            : `${value}${question?.unit ? ` ${question.unit}` : key === "publicSpendPct" ? "% of GDP" : ""}`,
        state,
        grade,
        source: adjusted
          ? "Scenario adjustment in this browser"
          : (fact?.source ?? "regional reference value"),
        benchmark: fact?.regional?.display ?? null,
        replacement:
          REPLACEMENT[key] ??
          "Authorised administrative data with a named custodian and reporting period.",
      };
    });
  })();
  const evidenceCounts = countEvidence(evidenceEntries);
  const evidenceFor = (key: string): EvidenceEntry =>
    evidenceEntries.find((entry) => entry.key === key) ?? {
      key,
      label: INPUT_LABEL[key] ?? key,
      display: "Not available",
      state: "reference",
      grade: "assumption",
      source: "No public record available",
      replacement:
        REPLACEMENT[key] ??
        "Authorised administrative data with a named custodian and reporting period.",
    };
  const inspectEvidence = (key: string | null = null) => {
    setEvidenceKey(key);
    setEvidenceOpen(true);
  };

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
          setCounselError(
            "The Counsel service is unavailable. The calculations below are unaffected.",
          );
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
    restoreRef.current = null;
    setPresetCode(code);
    const p = COUNTRY_PRESETS.find((c) => c.code === code);
    if (!p) return;
    // Presets seed immediately; the record overrides them when it arrives.
    setInput((s) => ({
      ...s,
      gdpUsd: p.gdpUsd,
      publicSpendPct: p.publicSpendPct,
      topSectorSharePct: p.topSectorSharePct,
    }));
  }

  function applySequence() {
    setInput((s) => ({
      ...s,
      chambers: Object.fromEntries(
        sequence.order.map((idx, i) => [idx, SEQUENCE_ADOPTION[i] ?? 0]),
      ),
    }));
  }

  function onDownload() {
    if (granted) {
      printSurface(BRIEF_PRINT_SURFACE);
      return;
    }
    setLeadOpen(true);
  }

  // Keep the address bar reopenable: the configuration rides in ?cfg=.
  const cfg = encodeBrief(input);
  const [origin, setOrigin] = useState("https://gdpvision.com");
  useEffect(() => setOrigin(window.location.origin), []);
  const reopenUrl = briefUrl(origin, presetCode, input);
  useEffect(() => {
    const t = setTimeout(() => {
      const u = new URL(window.location.href);
      u.searchParams.set("country", presetCode);
      u.searchParams.set("cfg", cfg);
      window.history.replaceState(window.history.state, "", u.toString());
    }, 600);
    return () => clearTimeout(t);
  }, [cfg, presetCode]);

  async function copyReopen() {
    try {
      await navigator.clipboard.writeText(reopenUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const termView = termMonths(facts?.termMonthsRemaining);
  const adviserContext = (): AdviserContext => ({
    country: countryName,
    region: facts?.region ?? "reference",
    facts: (facts?.facts ?? []).map((f) => ({
      key: f.key,
      label: f.label,
      display: f.display.slice(0, 200),
      grade: f.grade,
      source: f.source.slice(0, 120),
      regional: f.regional?.display ?? null,
    })),
    inputs: {
      stance: input.stance,
      gdpUsd: Math.round(input.gdpUsd),
      publicSpendPct: input.publicSpendPct,
      decisionsPerQuarter: input.decisionsPerQuarter,
      latencyMonths: input.latencyMonths,
      unmeasuredPct: input.unmeasuredPct,
      topSectorSharePct: input.topSectorSharePct,
      servicesOfflinePct: input.servicesOfflinePct,
      unplannedPrioritySharePct: input.unplannedPrioritySharePct,
    },
    verdict: {
      uplift_usd: result.upliftUsd,
      pp_of_gdp: result.upliftPpOfGdp,
      ceiling_usd:
        input.gdpUsd * (UPLIFT_CEILING_PCT_OF_GDP / 100) * STANCE_MULTIPLIER[input.stance],
      raw_usd: result.rawUsd,
      return_multiple: result.returnMultiple,
      payback_months: result.paybackMonths,
      annual_cost_usd: result.annualCostUsd,
      year_one_cost_usd: result.yearOneCostUsd,
      term_months: termView,
    },
    sequence: sequence.order.map((idx) => ({
      index: idx,
      title: TITLE[idx] ?? idx,
      adoption: input.chambers[idx] ?? 0,
      usd: result.chambers.find((c) => c.index === idx)?.usd ?? 0,
      why: (sequence.why[idx] ?? "").slice(0, 400),
    })),
  });
  const factLabel = (k: string) =>
        k === "arithmetic"
      ? "the calculation"
      : k === "assumption"
        ? "an assumption"
        : (facts?.facts.find((f) => f.key === k)?.label ?? k);

  const configuration = {
    model_version: result.model_version,
    country: countryName,
    country_code: presetCode,
    reopen_url: reopenUrl,
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

  const explainCtx: CalcCtx = { input, result, countryName };

  return (
    <ExplainProvider
      value={{
        ctx: explainCtx,
        traceLabel: "Show the calculations",
        onTrace: () => {
          setTraceOpen(true);
          setTimeout(
            () => traceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
            60,
          );
        },
      }}
    >
      <EvidenceAssuranceStrip entries={evidenceEntries} onOpen={() => inspectEvidence()} />
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-10 sm:px-6 md:px-10 md:py-16 lg:grid-cols-[1fr_380px] lg:gap-14 print:hidden">
        <div className="min-w-0 space-y-14">
          {/* Step 1 */}
          <section>
            <StepHeading
              n="01"
              title="Your country."
               lede="Choose a country and GDPVision begins with the figures it already holds. Each shows its source, confidence grade, and the typical value for the region. Nothing you change here leaves your browser until you request the brief."
            />

            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                <Explain id="calc.preset" label="Country">
                  Country
                </Explain>
              </span>
              <select
                value={presetCode}
                onChange={(e) => applyPreset(e.target.value)}
                className="mt-2 w-full border border-line-200 bg-paper-0 px-4 py-3 text-[15px] text-ink-950 focus:border-ink-950 focus:outline-none"
              >
                {(countriesQ.data?.length
                  ? countriesQ.data
                  : COUNTRY_PRESETS.map((c) => ({ code: c.code, name: c.name, onboarded: false }))
                ).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                    {c.onboarded ? "" : " — reference figures"}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-8">
              <FactRail facts={facts} loading={factsQ.isLoading} />
            </div>

            <div className="mt-6 divide-y divide-line-100 border-y border-line-100">
              <CalcSlider
                label="Nominal GDP"
                explainId="calc.gdp"
                value={Math.round(input.gdpUsd / 100_000_000)}
                min={2}
                max={400}
                step={1}
                readout={formatUsd(input.gdpUsd)}
                help="In hundreds of millions of US dollars. Adjust freely — the model scales with it."
                onChange={(v) => set("gdpUsd", v * 100_000_000)}
              />
              <EvidenceStatus entry={evidenceFor("gdpUsd")} onInspect={inspectEvidence} />
              <CalcSlider
                label="Public expenditure"
                explainId="calc.publicSpend"
                value={input.publicSpendPct}
                min={10}
                max={55}
                unit="% of GDP"
                 help="General government spending. This sets the scale of the opportunities the model can assess."
                onChange={(v) => set("publicSpendPct", v)}
              />
              <EvidenceStatus entry={evidenceFor("publicSpendPct")} onInspect={inspectEvidence} />
            </div>
          </section>

          {/* Step 2 */}
          <section>
            <StepHeading
              n="02"
               title="What the evidence shows, and where assumptions remain."
               lede="Six conditions shape the size of the opportunity. Where national evidence provides an answer, the figure appears with its source and confidence grade. Where it does not, a typical regional value is used and clearly marked as an assumption. You can correct any figure."
            />
            <div className="divide-y divide-line-100 border-y border-line-100">
              {FRAMING_QUESTIONS.map((q) => (
                <FramingCard
                  key={q.key}
                  q={q}
                  value={input[q.key]}
                  proposed={proposedFor(q.key)}
                  regional={regionalFor(REGIONAL_KEY[q.key] ?? "")}
                  evidence={evidenceFor(q.key)}
                  onInspectEvidence={inspectEvidence}
                  onChange={(v) => set(q.key, v)}
                />
              ))}
            </div>
          </section>

          {/* Step 3 */}
          <section>
            <StepHeading
              n="03"
              title="Where to start."
               lede="The ten Chambers are shown in the order the evidence suggests for the first year, with the estimated value each could release. Adjust the depth of any Chamber and the result updates."
            />
            <ol className="border-y border-line-100">
              {sequence.order.map((idx, i) => {
                const c = CHAMBER_COEFFICIENTS.find((x) => x.index === idx)!;
                const contribution = result.chambers.find((x) => x.index === idx);
                const level = input.chambers[idx] ?? 0;
                return (
                  <li
                    key={idx}
                    className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-4 border-b border-line-100 py-3"
                  >
                    <span className="font-mono text-[11px] text-ink-400">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="text-[15px] text-ink-950">{TITLE[idx] ?? c.short}</span>
                        <span
                          className="font-mono text-[10px] uppercase tracking-[0.14em]"
                          style={{ color: `var(${ACCENT[idx] ?? "--ink-500"})` }}
                        >
                          {adoptionLabel(level)}
                        </span>
                      </div>
                      <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-500">
                        {sequence.why[idx]}
                      </p>
                    </div>
                    <span className="font-mono text-[12px] tabular-nums text-ink-950">
                      <Explain id={`calc.chamber.${idx}`} label={`${c.short} contribution`}>
                        {contribution && contribution.usd > 0
                          ? `+${formatUsd(contribution.usd)}`
                          : "—"}
                      </Explain>
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => setShowAdjust((v) => !v)}
              >
                {showAdjust ? "Hide the adjustments" : "Adjust each chamber"}
              </button>
              <button
                type="button"
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={applySequence}
              >
                Reset to the proposed sequence
              </button>
            </div>
            <div
              className={
                showAdjust ? "mt-6 divide-y divide-line-100 border-y border-line-100" : "hidden"
              }
            >
              {CHAMBER_COEFFICIENTS.map((c) => {
                const contribution = result.chambers.find((x) => x.index === c.index);
                return (
                  <div key={c.index}>
                    <CalcSlider
                      label={`${c.index} · ${TITLE[c.index] ?? c.short}`}
                      explainId={`calc.chamber.${c.index}`}
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
                        <Explain id={`calc.chamber.${c.index}`} label={`${c.short} contribution`}>
                          {contribution && contribution.usd > 0
                            ? `+${formatUsd(contribution.usd)}`
                            : "—"}
                        </Explain>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {showAdjust ? (
              <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                {ADOPTION_STOPS.map((s) => s.label).join(" · ")}
              </p>
            ) : null}
          </section>

          {/* Step 4 */}
          <section>
            <StepHeading
              n="04"
               title="The national picture."
               lede="Four views use the same calculations as the summary: where value is being lost, how the Chambers add to the stated maximum, what could be achieved during the remaining term, and how the same choices compare across the region."
            />
            <div className="space-y-10">
              <HeldUp input={input} facts={facts} palette={palette} n={1} />
              <Waterfall
                input={input}
                result={result}
                order={sequence.order}
                palette={palette}
                n={2}
              />
              <Term
                input={input}
                result={result}
                termMonthsRemaining={facts?.termMonthsRemaining ?? null}
                palette={palette}
                n={3}
              />
              <Peers input={input} facts={facts} palette={palette} n={4} />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line-100 pt-4">
              <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={copyReopen}>
                {copied ? "Link copied" : "Copy the reopen link"}
              </button>
              <span className="text-[12px] text-ink-500">
                The link carries this configuration and nothing else; the record is re-read when it
                is opened.
              </span>
            </div>
          </section>

          <AdviserBox
            input={input}
            context={adviserContext}
            factLabel={factLabel}
            onApply={(patch) => setInput((s) => ({ ...s, ...patch }))}
          />

          <div ref={traceRef}>
            <ArithmeticDrawer trace={result.trace} open={traceOpen} onOpenChange={setTraceOpen} />
          </div>

          <CounselPanel counsel={counsel} loading={counselLoading} error={counselError} />
        </div>

        {/* Verdict — sticky rail on desktop, in-flow on mobile */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <VerdictRail
            result={result}
            stance={input.stance}
            onStance={(s: Stance) => set("stance", s)}
            onDownload={onDownload}
            evidence={evidenceCounts}
            onEvidence={() => inspectEvidence()}
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
          setTimeout(() => printSurface(BRIEF_PRINT_SURFACE), 250);
        }}
      />

      <EvidencePathwayModal
        entries={evidenceEntries}
        selectedKey={evidenceKey}
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
      />

      <PrintableBrief
        input={input}
        result={result}
        facts={facts}
        countryName={countryName}
        counsel={counsel}
        palette={palette}
        order={sequence.order}
        why={sequence.why}
        reopenUrl={reopenUrl}
        evidenceEntries={evidenceEntries}
        evidenceCounts={evidenceCounts}
      />
    </ExplainProvider>
  );
}
