import { useHoverIntent } from "@/hooks/useHoverIntent";
import { useEffect, useState, useCallback } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { MarketingShell } from "./MarketingShell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Cross-page hash arrivals (e.g. /business-case → "/#sovereignty") land here
 * before the target section has painted. Scroll to it once it exists.
 */
function useHashScroll() {
  const hash = useRouterState({ select: (s) => s.location.hash });
  useEffect(() => {
    if (!hash || typeof window === "undefined") return;
    let tries = 0;
    const tick = () => {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (tries++ < 20) window.setTimeout(tick, 50);
    };
    tick();
  }, [hash]);
}

import { EXISTENTIAL_THREATS } from "@/lib/existential-threats";
import { ExposureCarousel } from "./ExposureCarousel";
import { SignatureRing } from "./SignatureRing";
import { DataDecisionFlowDialog } from "./DataDecisionFlowDialog";

import { ChamberPanel } from "./ChamberPanel";
import { IndexBand } from "./IndexBand";
import { SectionHeader } from "./SectionHeader";
import { BriefingForm } from "./BriefingForm";
import { Wordmark } from "./Wordmark";
import { Illustration } from "./Illustration";
import { SovereignCustodySeal } from "./SovereignCustodySeal";
import { NationalCustodyRelay } from "./NationalCustodyRelay";
import { FloatingBackToTop } from "./FloatingBackToTop";

import { HomepageSecondBrain } from "./HomepageSecondBrain";
import illCounsel from "@/assets/illustrations/counsel-evidence-to-answer.jpg.asset.json";
import illProvenance from "@/assets/illustrations/section-provenance.jpg.asset.json";
import illBriefing from "@/assets/illustrations/section-briefing.jpg.asset.json";
import { CHAMBERS } from "@/lib/chambers";
import { getBriefCountries, getCountryFacts } from "@/lib/calculator/facts.functions";
import { computeValue, formatUsd } from "@/lib/calculator/model";
import { proposedInputForCountry } from "@/lib/calculator/proposal";
import "@/lib/explain/calculator-entries";

const LOOP_STEPS = [
  {
    step: "01",
    head: "Understand",
    body: "Bring the national data into one sourced view. See what is known, what is out of date, and which gaps could change the decision.",
  },
  {
    step: "02",
    head: "Rehearse",
    body: "Test the choice against GDP, jobs, ministries, the room in the budget, and public confidence before committing public money or political capital.",
  },
  {
    step: "03",
    head: "Decide",
    body: "Compare credible options using the same assumptions. Record what Cabinet decided, any conditions, and who is responsible.",
  },
  {
    step: "04",
    head: "Deliver",
    body: "Turn the decision into a plan owned by the responsible ministry. Keep milestones, data, risks, and required action visible between Cabinet sessions.",
  },
  {
    step: "05",
    head: "Account",
    body: "Measure delivery against the government’s mandate and approved targets. Keep every change and result linked to the decision that created it.",
  },
];

function shuffleTail() {
  const tail = EXISTENTIAL_THREATS.slice(1);
  for (let i = tail.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tail[i], tail[j]] = [tail[j], tail[i]];
  }
  return tail;
}

export function MarketingHome() {
  useHashScroll();
  const fetchCountries = useServerFn(getBriefCountries);
  const fetchFacts = useServerFn(getCountryFacts);
  const [estimateCountry, setEstimateCountry] = useState("LCA");
  const estimateCountriesQ = useQuery({
    queryKey: ["brief-countries"],
    queryFn: () => fetchCountries(),
  });
  const estimateFactsQ = useQuery({
    queryKey: ["brief-facts", estimateCountry],
    queryFn: () => fetchFacts({ data: { code: estimateCountry } }),
    staleTime: 60 * 60 * 1000,
  });
  const estimateFacts = estimateFactsQ.data ?? null;
  const estimateInput = proposedInputForCountry(estimateCountry, estimateFacts);
  const estimateResult = computeValue(estimateInput);
  const estimateCountryName =
    estimateFacts?.name ??
    estimateCountriesQ.data?.find((country) => country.code === estimateCountry)?.name ??
    "St Lucia";
  const [tail, setTail] = useState(() => EXISTENTIAL_THREATS.slice(1));

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const { hover: heroHover } = useHoverIntent<true>(
    useCallback(() => setPaused(true), []),
    useCallback(() => setPaused(false), []),
  );
  useEffect(() => {
    setTail(shuffleTail());
  }, []);
  useEffect(() => {
    if (paused || stopped) return;
    const id = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % EXISTENTIAL_THREATS.length;
        if (next === 0) setTail(shuffleTail());
        return next;
      });
    }, 10000);
    return () => clearInterval(id);
  }, [paused, stopped]);

  const current = index === 0 ? EXISTENTIAL_THREATS[0] : tail[index - 1];
  const threatTotal = EXISTENTIAL_THREATS.length;
  const goPrevThreat = () => {
    setStopped(true);
    setIndex((i) => (i - 1 + threatTotal) % threatTotal);
  };
  const goNextThreat = () => {
    setStopped(true);
    setIndex((i) => {
      const next = (i + 1) % threatTotal;
      if (next === 0) setTail(shuffleTail());
      return next;
    });
  };

  return (
    <MarketingShell>
      {/* HERO ------------------------------------------------------------- */}
      <section id="top" className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-12 sm:px-6 sm:py-16 md:grid-cols-[1.15fr_1fr] md:gap-16 md:px-10 md:py-16">
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500">
              GDPVision · A national decision system under government control
            </div>
            <div className="mt-6 h-px w-16 bg-gold-500" aria-hidden />
            <h1 className="mt-6 font-serif text-[42px] leading-[1.08] tracking-tight text-ink-950 sm:mt-8 sm:text-[56px] sm:leading-[1.05] md:text-[88px]">
              Sovereign Intelligence for Emerging Economies
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-700 sm:mt-6 md:text-[17px]">
              GDPVision gives Presidents, Prime Ministers and Cabinets one trusted picture of the
              country’s data. Rehearse means comparing credible choices before committing, then
              following the chosen course through delivery. Each country operates in a separate,
              government-controlled environment.
            </p>

            <div
              aria-live="polite"
              {...heroHover(true)}
              onFocusCapture={() => setPaused(true)}
              onBlurCapture={() => setPaused(false)}
              className="mt-8"
            >
              <div
                key={current.id}
                className="animate-in fade-in duration-500 motion-reduce:animate-none"
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500">
                  A question on the Cabinet table · {current.title}
                </div>
                <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-ink-700 md:text-[21px]">
                  {current.body}
                </p>
                <div className="mt-5 max-w-xl border-t border-gold-500 pt-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold-500">
                    How GDPVision prepares the decision
                  </div>
                  <p className="mt-3 text-[17px] leading-relaxed text-ink-950 md:text-[21px]">
                    {current.response}
                  </p>
                </div>
              </div>
            </div>

            <nav
              aria-label="Cycle through threats"
              className="mt-4 flex items-center gap-5 border-t border-line-200 pt-1 sm:gap-6 sm:pt-3"
            >
              <button
                type="button"
                onClick={goPrevThreat}
                aria-label="Previous threat"
                className="group -mx-2 flex min-h-[44px] items-center gap-3 px-2 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500 transition-colors duration-200 hover:text-ink-950 focus:outline-none focus-visible:text-gold-500"
              >
                <svg
                  width="44"
                  height="10"
                  viewBox="0 0 44 10"
                  fill="none"
                  aria-hidden
                  className="w-[28px] shrink-0 transition-transform duration-300 group-hover:-translate-x-1 sm:w-[44px]"
                >
                  <path
                    d="M43 5H1M1 5L5 1M1 5L5 9"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="square"
                  />
                </svg>
                <span>Prev</span>
              </button>
              <span className="font-mono text-[11px] tabular-nums tracking-[0.22em] text-ink-950">
                {String(index + 1).padStart(2, "0")}
                <span className="mx-2 text-ink-300">/</span>
                {String(threatTotal).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={goNextThreat}
                aria-label="Next threat"
                className="group -mx-2 flex min-h-[44px] items-center gap-3 px-2 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500 transition-colors duration-200 hover:text-ink-950 focus:outline-none focus-visible:text-gold-500"
              >
                <span>Next</span>
                <svg
                  width="44"
                  height="10"
                  viewBox="0 0 44 10"
                  fill="none"
                  aria-hidden
                  className="w-[28px] shrink-0 transition-transform duration-300 group-hover:translate-x-1 sm:w-[44px]"
                >
                  <path
                    d="M1 5H43M43 5L39 1M43 5L39 9"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="square"
                  />
                </svg>
              </button>
            </nav>
            <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
              <a
                href="#briefing"
                className="inline-flex min-h-[48px] items-center justify-center bg-ink-950 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-paper-0 transition-colors duration-200 hover:bg-gold-500"
              >
                Request a Cabinet briefing
              </a>
              <a
                href="#loop"
                className="inline-flex min-h-[44px] items-center font-mono text-[12px] uppercase tracking-[0.18em] text-ink-500 hover:text-ink-950"
              >
                See how a Cabinet decision moves ↓
              </a>
            </div>
          </div>
          <div className="relative flex flex-col items-center justify-center md:self-start">
            <div className="mt-14 flex w-full justify-center md:mt-[86px]">
              <SignatureRing size={520} />
            </div>
            <div className="mt-14 flex w-full justify-center md:-mt-24">
              <DataDecisionFlowDialog />
            </div>
          </div>
        </div>
      </section>

      {/* MEASURES --------------------------------------------------------- */}
      <IndexBand />

      {/* PROBLEM ---------------------------------------------------------- */}
      <section id="problem" className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-32">
          <ExposureCarousel />
        </div>
      </section>

      {/* INSTRUMENT — CHAMBERS ------------------------------------------- */}
      <section id="instrument" className="border-b border-line-200 bg-paper-100/40">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-32">
          <SectionHeader
            eyebrow="Ten connected workspaces. One national purpose."
            title="Govern with confidence. Turn national priorities into economic progress."
            lede="GDPVision’s ten Chambers are connected digital workspaces for the work of government—from understanding the economy to shaping policy, attracting investment and delivering results. Each brings your country’s data and decision tools together, helping Cabinet and ministries act as one, direct resources where they matter and build the conditions for lasting GDP growth—with government in control."
          />
          <div className="relative mt-10 overflow-hidden border border-charcoal bg-charcoal px-5 py-6 shadow-sm sm:px-8 sm:py-8">
            <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gold-500" />
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] md:items-center md:gap-12">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-300">
                  Country value estimate
                </p>
                <h3 className="mt-3 max-w-2xl font-serif text-[27px] leading-tight text-paper-0 sm:text-[34px]">
                  See what each Chamber could deliver in your country.
                </h3>
                <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-300 sm:text-[15px]">
                  Choose a country to update all ten year-three estimates below. Public records are
                  used where available; reference assumptions are clearly marked.
                </p>
              </div>
              <div>
                <label
                  id="chamber-estimate-country-label"
                  htmlFor="chamber-estimate-country"
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-300"
                >
                  Select country
                </label>
                <Select value={estimateCountry} onValueChange={setEstimateCountry}>
                  <SelectTrigger
                    id="chamber-estimate-country"
                    aria-labelledby="chamber-estimate-country-label"
                    className="mt-2 h-auto min-h-20 w-full rounded-none border border-paper-0 bg-paper-0 px-4 py-4 font-serif text-[38px] leading-tight text-ink-950 shadow-sm focus:border-gold-500 focus:outline-none focus:ring-0"
                  >
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[340px] rounded-none border-line-200 bg-paper-0 text-ink-950">
                    {(estimateCountriesQ.data ?? [{ code: "LCA", name: "St Lucia" }]).map(
                      (country) => (
                        <SelectItem
                          key={country.code}
                          value={country.code}
                          className="rounded-none py-2 pl-3 pr-9 font-serif text-[15px] text-ink-900 focus:bg-gold-500/10 focus:text-ink-950"
                        >
                          {country.name}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-300">
                  All ten Chamber values update together
                </p>
                <div
                  key={estimateCountry}
                  aria-live="polite"
                  className="mt-5 min-h-[92px] animate-in fade-in slide-in-from-top-2 border-y border-ink-500/40 py-4 duration-500 motion-reduce:animate-none"
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-300">
                    Estimated value · year three
                  </div>
                  {estimateFactsQ.isLoading ? (
                    <div className="mt-2 h-8 w-28 animate-pulse bg-ink-500/30 motion-reduce:animate-none" />
                  ) : (
                    <>
                      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="font-serif text-[25px] leading-none text-paper-0">
                          +{formatUsd(estimateResult.upliftUsd)}
                        </span>
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-300">
                          All ten Chambers · combined
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-ink-300">
                        {estimateCountryName} · central public estimate
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10 grid gap-x-8 gap-y-6 border-t border-line-200 pt-10 sm:mt-16 sm:pt-12 md:grid-cols-2 lg:grid-cols-3">
            {CHAMBERS.map((c) => (
              <ChamberPanel key={c.index} {...c} />
            ))}
          </div>
        </div>
      </section>

      {/* CORPUS ----------------------------------------------------------- */}
      <section id="corpus" className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-32">
          <div className="grid items-center gap-x-10 gap-y-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="order-2 min-w-0 lg:order-1">
              <HomepageSecondBrain />
            </div>
            <div className="contents lg:order-2 lg:block">
            <div className="order-1">
            <SectionHeader
              eyebrow="Second Brain 2.0 · One trusted national record"
              title="Give Cabinet one trusted view of the data."
              lede="At GDPVision’s core is Second Brain 2.0: a connected national data library. It brings public sources and authorised government records together so Cabinet can shape policy, assess investment and guide delivery with greater confidence. Important claims keep their source, date and confidence grade."
            />
            </div>
          <div className="order-3 grid min-w-0 gap-5 lg:mt-8">
            {[
              {
                head: "Public data",
                body: "National, regional, and international sources are organised by ministry. Each is dated, cited, and graded for confidence.",
              },
              {
                head: "Government data",
                body: "Authorised contracts, memoranda, agreements, and briefings follow the same checking standard. Only approved country users can see them.",
              },
              {
                head: "One clear view for a decision",
                body: "Briefings and scenarios can use both records without confusing public data with restricted information. Every access and change can be reviewed.",
              },
            ].map((p) => (
              <div key={p.head} className="border-t border-line-200 pt-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold-500">
                  {p.head}
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-700">{p.body}</p>
              </div>
            ))}
          <Link
            to="/record"
            className="btn-ghost !justify-start !px-0 font-mono text-[11px] uppercase tracking-[0.12em]"
          >
            How the national record works, with a live example →
          </Link>
          </div>
          </div>
          </div>
        </div>
      </section>

      {/* THE LOOP --------------------------------------------------------- */}
      <section id="loop" className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-32">
          <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
            <SectionHeader
              eyebrow="From question to accountable delivery"
              title="Move every decision from trusted data to accountable delivery."
              lede="Most systems report what has already happened. GDPVision helps government move a live decision from the data placed before Cabinet to the result a ministry must deliver."
            />
            <NationalCustodyRelay />
          </div>
          <div className="mt-10 grid gap-8 border-t border-line-200 pt-10 sm:mt-16 sm:pt-12 md:grid-cols-2 lg:grid-cols-5">
            {LOOP_STEPS.map((s) => (
              <div key={s.step} className="border-t border-line-200 pt-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold-500">
                  {s.step} · {s.head}
                </div>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-700">{s.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-12 max-w-2xl font-serif text-[21px] leading-snug text-ink-950">
            GDPVision prepares the data and tests the options. Authorised officials decide,
            approve, and remain accountable. Nothing is released autonomously.
          </p>
        </div>
      </section>

      {/* THE ENGAGEMENT -------------------------------------------------- */}
      <section id="engagement" className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-28">
          <SectionHeader
            eyebrow="The first engagement"
            title="Start with one urgent decision. Build a capability government keeps."
            lede="The engagement starts with a decision already demanding Cabinet attention. We prepare the data, test credible choices, identify what must improve, and establish a method government can continue to use."
          />
          <div className="mt-10 grid gap-8 border-t border-line-200 pt-10 sm:mt-14 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                head: "Review the data",
                body: "A confidential review of the national data, how reliable it is, and which gaps could alter the decision.",
              },
              {
                step: "02",
                head: "Rehearse the choice",
                body: "A country-specific comparison of credible options, likely consequences, assumptions, and practical limits on delivery.",
              },
              {
                step: "03",
                head: "Prepare the brief",
                body: "A prioritised decision brief showing what Cabinet can decide now and what must be resolved first.",
              },
              {
                step: "04",
                head: "Establish the capability",
                body: "A government-controlled working environment and decision method that remain available to authorised teams.",
              },
            ].map((item) => (
              <div key={item.step} className="border-t border-line-200 pt-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold-500">
                  {item.step} · {item.head}
                </div>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-700">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-3xl font-serif text-[21px] leading-snug text-ink-950">
            This is not a report handed over at the end of an assignment. It is a practical way for
            government to keep using its own data, officials, and authority to make decisions.
          </p>
        </div>
      </section>

      {/* THE COUNSEL ------------------------------------------------------ */}
      <section id="counsel" className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] items-center gap-8 px-5 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12 md:px-10">
          <div className="min-w-0">
            <SectionHeader
              eyebrow="Counsel between engagements"
              title="Give national leaders a sourced answer when they need it."
              lede="The Counsel gives a President, Prime Minister, or authorised adviser a concise answer drawn from the national data record. It is designed for questions asked between meetings and keeps the source behind every important claim."
            />
          <div className="mt-8 grid gap-6 border-t border-line-200 pt-6 sm:grid-cols-3">
            {[
              {
                head: "Voice-first",
                body: "Ask aloud when reading a report or navigating a schedule. No dashboard required.",
              },
              {
                head: "Two to four sentences",
                body: "A concise answer for an immediate executive judgement, not another report.",
              },
              {
                head: "Always cited",
                body: "Important claims retain their source and confidence grade from the national data record.",
              },
            ].map((p) => (
              <div key={p.head} className="flex items-start gap-5">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold-500">
                    {p.head}
                  </div>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-700">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
          </div>
          <Illustration src={illCounsel.url} variant="aside" className="justify-self-end max-w-[232px] sm:max-w-[288px] lg:max-w-[400px] xl:max-w-[400px]" />
        </div>
      </section>

      {/* SOVEREIGNTY ------------------------------------------------------ */}
      <section id="sovereignty" className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] items-start gap-10 px-5 py-14 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.2fr] md:gap-16 md:px-10 md:py-32">
          <div>
            <SectionHeader
              eyebrow="Sovereignty"
              title="National data remains under national control."
              lede="Government decides where its information stays, who may see it, and what may leave. Those rules are built into both the system and the engagement."
            />
            <SovereignCustodySeal />
          </div>
          <div className="grid gap-8 border-t border-line-200 pt-10">
            {[
              {
                head: "A separate system for each country",
                body: "Each country operates in its own protected environment. Regional comparisons use approved public data, never another government’s restricted records.",
              },
              {
                head: "Data ownership",
                body: "Government agrees where its data is held, who may export it, how long it is kept, and when it must be deleted. Those terms are reflected in the deployed system.",
              },
              {
                head: "Public and private, separated by design",
                body: "Restricted government records are kept separate from public data. Every access and important change is recorded for review.",
              },
              {
                head: "Controlled access and a full record",
                body: "Officials see only what their role permits. Strong sign-in, approval controls, and permanent activity records support the government’s own rules.",
              },
              {
                head: "Works with the government’s record",
                body: "The first engagement strengthens existing data and ways of working. Government does not need to replace every current system before value can be demonstrated.",
              },
            ].map((p) => (
              <div key={p.head} className="border-b border-line-200 pb-8 last:border-b-0">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                  {p.head}
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-700 max-w-2xl">{p.body}</p>
              </div>
            ))}
            <Link
              to="/vault"
              className="border-l-2 border-gold-500 pl-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950 hover:text-ink-700"
            >
              The Sovereign Vault: in-country hardware for the records that must never leave →
            </Link>
          </div>
        </div>
      </section>

      {/* PROVENANCE ------------------------------------------------------- */}
      <section id="provenance" className="border-b border-line-200 bg-paper-100/40">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-32">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
            <div className="min-w-0">
              <SectionHeader
                eyebrow="Experience and proof"
                title="Proven regional experience supports a system government can verify."
                lede="OPEN Interactive brings experience in Caribbean investment, national digital infrastructure, and work with heads of government. GDPVision turns that experience into a working national decision system whose claims can be checked at source."
              />
            </div>
            <Illustration
              src={illProvenance.url}
              variant="aside"
              className="justify-self-end max-w-[232px] sm:max-w-[288px] lg:max-w-[400px] xl:max-w-[400px]"
            />
          </div>
          <div className="mt-10 grid gap-8 sm:mt-16 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                year: "2009 →",
                head: "Caribbean Investment Summit",
                body: "A leading regional forum connecting investment opportunities with capital, now a route to market for packages prepared through GDPVision.",
              },
              {
                year: "2018 →",
                head: "National infrastructure, St. Kitts & Nevis",
                body: "Delivered digital government infrastructure at national scale under confidential engagement with the Office of the Prime Minister.",
              },
              {
                year: "2026",
                head: "SEDE — the Saint Lucia prototype",
                body: "A working government-controlled system combining economic modelling, sourced advice, national data, and secure document intake.",
              },
              {
                year: "Today",
                head: "Built in the region, for the region",
                body: "Designed around the exposures Caribbean and small-island states actually carry: concentrated revenue, climate shock, external repricing, and data that too often arrives after the decision.",
              },
            ].map((p) => (
              <div key={p.head} className="border-t border-line-200 pt-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold-500">
                  {p.year}
                </div>
                <h3 className="mt-4 font-serif text-[21px] leading-tight text-ink-950">{p.head}</h3>
                <p className="mt-3 text-[14px] leading-relaxed text-ink-700">{p.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 border-t border-line-200 pt-8">
            <Link
              to="/business-case"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950 hover:text-ink-700"
            >
              See the procurement case →
            </Link>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-700">
              A decision paper for Cabinet Secretaries, ministries of finance, and procurement
              teams: the stakes, the required standard, the available options, and the recommended
              path.
            </p>
          </div>
        </div>
      </section>

      {/* BRIEFING CTA ----------------------------------------------------- */}
      <section id="briefing">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-32">
          <div className="grid gap-10 md:grid-cols-[1fr_1.4fr] md:gap-16 items-start">
            <div>
              <SectionHeader
                eyebrow="A confidential first conversation"
                title="Bring one national decision. Leave with a clear next step."
                lede="Bring one priority decision. We will prepare a country-specific view of the supporting data, the gaps that could change the answer, and a practical route forward."
              />
              <div className="mt-10 flex items-start justify-between gap-8">
                <div className="space-y-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                  <div>— Your priority decision, framed clearly</div>
                  <div>— The data and material gaps</div>
                  <div>— A live test using national data</div>
                  <div>— A practical next-step recommendation</div>
                </div>
                <Illustration
                  src={illBriefing.url}
                  variant="spot"
                  className="hidden shrink-0 md:block"
                />
              </div>
              <p className="mt-8 max-w-md text-[15px] leading-relaxed text-ink-700">
                Prepared from your nation’s public data and the context you authorise. The
                conversation is confidential, country-specific, and designed to produce a useful
                next decision—not a generic product demonstration.
              </p>
            </div>
            <BriefingForm />
          </div>
        </div>
      </section>

      {/* Hidden — kiosk still lives under /kiosk for existing installations */}
      <div className="sr-only">
        <Wordmark />
        <a href="/kiosk">Kiosk</a>
      </div>
      <FloatingBackToTop />
    </MarketingShell>
  );
}
