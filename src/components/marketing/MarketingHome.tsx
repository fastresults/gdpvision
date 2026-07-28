import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { MarketingShell } from "./MarketingShell";

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
import { MOMENT_VARIANTS } from "@/lib/moment-variants";
import { SignatureRing } from "./SignatureRing";
import { NumberTile } from "./NumberTile";
import { ChamberPanel } from "./ChamberPanel";
import { SectionHeader } from "./SectionHeader";
import { BriefingForm } from "./BriefingForm";
import { Wordmark } from "./Wordmark";
import { Illustration } from "./Illustration";
import { FloatingBackToTop } from "./FloatingBackToTop";
import illMoment from "@/assets/illustrations/section-moment.jpg.asset.json";
import illCorpus from "@/assets/illustrations/section-corpus.jpg.asset.json";
import illLoop from "@/assets/illustrations/section-loop.jpg.asset.json";
import illCounsel from "@/assets/illustrations/section-counsel.jpg.asset.json";
import illSovereignty from "@/assets/illustrations/section-sovereignty.jpg.asset.json";
import illProvenance from "@/assets/illustrations/section-provenance.jpg.asset.json";
import illBriefing from "@/assets/illustrations/section-briefing.jpg.asset.json";
import { CHAMBERS } from "@/lib/chambers";

const FEATURE_LABELS: Record<string, string> = {
  "04": "04 →  Where the revenue cliff is priced",
  "08": "08 →  Where the manifesto becomes a delivery plan",
};

const FEATURED_CHAMBERS = CHAMBERS.filter((c) => c.index === "04" || c.index === "08").map((c) => ({
  ...c,
  featureLabel: FEATURE_LABELS[c.index],
}));

const GRID_CHAMBERS = CHAMBERS.filter((c) => c.index !== "04" && c.index !== "08");

const LOOP_STEPS = [
  {
    step: "01",
    head: "Rehearse",
    body: "Pull the lever in the Scenario Engine. Watch it propagate through the inter-sector dependency web. The compensation ledger shows what the gain costs elsewhere — nothing is free, and the instrument says so.",
  },
  {
    step: "02",
    head: "Decide",
    body: "The scenario is promoted to the Cabinet Room. Session Mode puts two options side by side, on the same assumptions, and the decision is recorded live with an owner attached.",
  },
  {
    step: "03",
    head: "Track",
    body: "The commitment enters the cockpit. What was adopted, who owns it, where it stands — visible between sessions, not reconstructed after them.",
  },
  {
    step: "04",
    head: "Score",
    body: "The Mandate Compact grades it against what the government promised. Quarterly scorecards, a PM Report Card, and a signed compact whose every revision is snapshotted and diffable.",
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
  const [tail, setTail] = useState(() => EXISTENTIAL_THREATS.slice(1));

  const [index, setIndex] = useState(0);
  const [momentIndex, setMomentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [momentStopped, setMomentStopped] = useState(false);
  useEffect(() => {
    if (momentStopped) return;
    const id = setInterval(() => {
      setMomentIndex((i) => (i + 1) % MOMENT_VARIANTS.length);
    }, 4000);
    return () => clearInterval(id);
  }, [momentStopped]);
  useEffect(() => {
    setTail(shuffleTail());
    setMomentIndex(1 + Math.floor(Math.random() * (MOMENT_VARIANTS.length - 1)));
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
  const moment = MOMENT_VARIANTS[momentIndex];
  const total = MOMENT_VARIANTS.length;
  const threatTotal = EXISTENTIAL_THREATS.length;
  const goPrev = () => {
    setMomentStopped(true);
    setMomentIndex((i) => (i - 1 + total) % total);
  };
  const goNext = () => {
    setMomentStopped(true);
    setMomentIndex((i) => (i + 1) % total);
  };
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
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-12 sm:px-6 sm:py-16 md:grid-cols-[1.15fr_1fr] md:gap-16 md:px-10 md:py-24">
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500">
              GDPVision · An instrument of state
            </div>
            <div className="mt-6 h-px w-16 bg-gold-500" aria-hidden />
            <h1 className="mt-6 font-serif text-[32px] leading-[1.08] tracking-tight text-ink-950 sm:mt-8 sm:text-[43px] sm:leading-[1.05] md:text-[68px]">
              No small state should learn its own economy from someone else's report.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-700 sm:mt-6 md:text-[17px]">
              GDPVision is a sovereign instrument for Presidents, Prime Ministers and Cabinets. It
              holds a nation's public and private evidence in one graded Ledger, and lets Cabinet
              rehearse a decision before it is taken. One isolated deployment per nation. The
              government owns it outright.
            </p>

            <div
              aria-live="polite"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocusCapture={() => setPaused(true)}
              onBlurCapture={() => setPaused(false)}
              className="mt-8"
            >
              <div
                key={current.id}
                className="animate-in fade-in duration-500 motion-reduce:animate-none"
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500">
                  The questions on the Cabinet table · {current.title}
                </div>
                <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-ink-700 md:text-[21px]">
                  {current.body}
                </p>
                <div className="mt-5 max-w-xl border-t border-gold-500 pt-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold-500">
                    The instrument's answer
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
                See how a decision moves through the instrument ↓
              </a>
            </div>
          </div>
          <div className="relative flex items-center justify-center">
            <SignatureRing size={480} />
          </div>

        </div>
      </section>

      {/* PROBLEM ---------------------------------------------------------- */}
      <section id="problem" className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-32">
          <div
            key={moment.id}
            className="animate-in fade-in duration-500 motion-reduce:animate-none"
          >
            <div className="grid items-center gap-6 md:grid-cols-[320px_minmax(0,1fr)] md:gap-12 lg:grid-cols-[384px_minmax(0,1fr)]">
              <Illustration
                key={moment.id}
                src={moment.illustration ?? illMoment.url}
                alt={moment.title}
                variant="spot"
                className="mx-auto shrink-0 !w-[232px] md:mx-0 md:!w-[320px] lg:!w-[384px]"
              />
              <div className="min-w-0">
                <SectionHeader
                  eyebrow="The moment · Eight regional exposures, graded and cited"
                  title={moment.title}
                  lede={moment.lede}
                />
              </div>
            </div>

            <div className="mt-10 grid gap-10 border-t border-line-200 pt-10 sm:mt-16 sm:gap-12 sm:pt-12 md:grid-cols-3">
              {moment.stats.map((s, i) => (
                <NumberTile
                  key={i}
                  value={s.value}
                  unit={s.unit}
                  label={s.label}
                  grade={s.grade}
                  citation={s.citation}
                />
              ))}
            </div>
          </div>
          <p className="mt-12 max-w-2xl text-[15px] leading-relaxed text-ink-700">
            Every figure on this page carries a confidence grade and a source. Inside the
            instrument, so does every figure your Cabinet sees.
          </p>

          <nav
            aria-label="Cycle through economic impact scenarios"
            className="mt-10 flex items-center justify-end gap-5 border-t border-line-200 pt-4 sm:mt-16 sm:gap-6 sm:pt-6"
          >
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous scenario"
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
              {String(momentIndex + 1).padStart(2, "0")}
              <span className="mx-2 text-ink-300">/</span>
              {String(total).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next scenario"
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
        </div>
      </section>

      {/* CORPUS ----------------------------------------------------------- */}
      <section id="corpus" className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-32">
          <div className="grid items-end gap-8 md:grid-cols-[1.3fr_1fr] md:gap-10">
            <SectionHeader
              eyebrow="One sovereign corpus"
              title="Public data. Private data. Held apart, read together."
              lede="Public evidence is aggregated, graded and cited for every ministry. Private Cabinet uploads sit under the same provenance discipline — visible only to those with authorised country access, never mixed into the public view."
            />
            <div className="flex justify-center md:justify-end">
              <Illustration src={illCorpus.url} variant="spot" className="md:hidden" />
              <Illustration src={illCorpus.url} variant="aside" className="hidden md:block" />
            </div>
          </div>
          <div className="mt-10 grid gap-8 border-t border-line-200 pt-10 sm:mt-16 sm:pt-12 md:grid-cols-3">

            {[
              {
                head: "Public corpus",
                body: "Deep-researched, sourced, graded and citation-backed data every ministry in the country sees — continuously refreshed by the instrument's own agents.",
              },
              {
                head: "Private corpus",
                body: "Cabinet-only uploads — contracts, memos, MoUs, closes, briefings — held under the same provenance discipline. Marked private at ingest, never surfaced to the public view.",
              },
              {
                head: "One decision surface",
                body: "Every chart, scenario, dossier and briefing reads from both. Visibility is a first-class attribute on every row, and every read and write is audited.",
              },
            ].map((p) => (
              <div key={p.head} className="border-t border-line-200 pt-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold-500">
                  {p.head}
                </div>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-700">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THE LOOP --------------------------------------------------------- */}
      <section id="loop" className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-32">
          <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
            <SectionHeader
              eyebrow="How a decision moves"
              title="A decision is rehearsed, taken, tracked, and scored."
              lede="Most systems show a government what already happened. GDPVision carries a decision through its whole life — from the question on the Cabinet table to the quarter it is graded in."
            />
            <Illustration
              src={illLoop.url}
              variant="spot"
              className="mx-auto md:mx-0 md:justify-self-end"
            />
          </div>
          <div className="mt-10 grid gap-8 border-t border-line-200 pt-10 sm:mt-16 sm:pt-12 md:grid-cols-2 lg:grid-cols-4">

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
            At every step the instrument drafts and prices. Principals decide. Nothing releases
            autonomously.
          </p>
        </div>
      </section>

      {/* INSTRUMENT — CHAMBERS ------------------------------------------- */}
      <section id="instrument" className="border-b border-line-200 bg-paper-100/40">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-32">

          <SectionHeader
            eyebrow="The instrument"
            title="Eight chambers, each engineered to move GDP."
            lede="Not a dashboard and not a consulting deliverable. GDPVision is organised as an instrument of state — a live Ledger beneath eight chambers, with the Counsel above them."
          />
          <div className="mt-10 grid gap-x-10 gap-y-10 border-t border-line-200 pt-10 sm:mt-16 sm:pt-12 md:grid-cols-2">
            {FEATURED_CHAMBERS.map((c) => (
              <div key={c.index}>
                <div className="mb-4 font-mono text-[12px] uppercase tracking-[0.18em] text-gold-500">
                  {c.featureLabel}
                </div>
                <ChamberPanel
                  index={c.index}
                  title={c.title}
                  purpose={c.purpose}
                  bullets={c.bullets}
                  accentVar={c.accentVar}
                  image={c.image}
                />
              </div>
            ))}
          </div>
          <div className="mt-10 grid gap-x-8 gap-y-6 sm:mt-16 md:grid-cols-2 lg:grid-cols-3">
            {GRID_CHAMBERS.map((c) => (
              <ChamberPanel key={c.index} {...c} />
            ))}
          </div>
        </div>
      </section>

      {/* THE COUNSEL ------------------------------------------------------ */}
      <section id="counsel" className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] items-start gap-10 px-5 py-14 sm:px-6 sm:py-16 md:grid-cols-[1fr_0.8fr] md:gap-12 md:px-10 md:py-24">
          <div>
            <SectionHeader
              eyebrow="Above the chambers"
              title="The Counsel."
              lede="A voice-first sovereign advisor. Two to four sentences of cited counsel, drawn from the Ledger, at a desk or in a moving car. It answers the question a principal actually asks between engagements — and it cites where the answer came from."
            />
          </div>
          <div className="grid gap-6 border-t border-line-200 pt-8 md:mt-2">
            {[
              { head: "Voice-first", body: "Asked aloud between engagements. No screen required." },
              {
                head: "Two to four sentences",
                body: "The length of an answer a principal can act on, not a report.",
              },
              {
                head: "Always cited",
                body: "Every claim carries its source and confidence grade from the Ledger.",
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
            <Illustration src={illCounsel.url} variant="spot" className="mt-2" />
          </div>
        </div>
      </section>

      {/* SOVEREIGNTY ------------------------------------------------------ */}
      <section id="sovereignty" className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] items-start gap-10 px-5 py-14 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.2fr] md:gap-16 md:px-10 md:py-32">
          <div>
            <SectionHeader
              eyebrow="Sovereignty"
              title="One isolated deployment per nation. The government owns the data outright."
              lede="Before anything else is discussed, this is usually the question. It is answered in the architecture rather than the contract."
            />
            <Illustration src={illSovereignty.url} variant="spot" className="mt-12" />
          </div>
          <div className="grid gap-8 border-t border-line-200 pt-10">
            {[
              {
                head: "Sovereign instance",
                body: "Separate database, storage, and encryption keys. No cross-instance queries exist in the architecture. Peer benchmarking uses public datasets only.",
              },
              {
                head: "Data ownership",
                body: "Contractually and technically, the government owns its instance data. Full export and verified deletion on termination. Hosting region selected with the government, including EU data-residency options.",
              },
              {
                head: "Public and private, separated by design",
                body: "Visibility is a first-class attribute on every row. Private Cabinet uploads never enter the public corpus, are gated by country access, and every read and write is audited.",
              },
              {
                head: "Access & audit",
                body: "MFA mandatory for all roles, hardware-key support for Principals and Stewards, immutable audit log for data changes, decisions, and exports.",
              },
              {
                head: "No trackers, ever",
                body: "No third-party analytics or trackers inside government instances. Error telemetry is first-party and instance-consented.",
              },
            ].map((p) => (
              <div key={p.head} className="border-b border-line-200 pb-8 last:border-b-0">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                  {p.head}
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-700 max-w-2xl">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROVENANCE ------------------------------------------------------- */}
      <section id="provenance" className="border-b border-line-200 bg-paper-100/40">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-6 sm:py-20 md:px-10 md:py-32">

          <SectionHeader
            eyebrow="Provenance"
            title="Built by OPEN Interactive — seventeen years in the room, one working prototype already running."
            lede="OPEN Interactive originated the Caribbean Investment Summit franchise in 2009, delivered national digital infrastructure for the Government of St. Kitts & Nevis, and has maintained head-of-government relationships across the OECS for seventeen years. GDPVision is built by the people already in the room."
          />
          <Illustration src={illProvenance.url} variant="rule" className="mt-10" />
          <div className="mt-10 grid gap-8 sm:mt-16 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                year: "2009 →",
                head: "Caribbean Investment Summit",
                body: "The region's premier FDI deal-flow franchise, now the summit channel for the investment packages GDPVision produces.",
              },
              {
                year: "2018 →",
                head: "National infrastructure, St. Kitts & Nevis",
                body: "Delivered digital government infrastructure at national scale under confidential engagement with the Office of the Prime Minister.",
              },
              {
                year: "2026",
                head: "SEDE — the Saint Lucia prototype",
                body: "A working sovereign decision engine: live macro model, voice console, dossier corpus, ingest pipeline. GDPVision v1 absorbs SEDE as its interaction-proven core.",
              },
              {
                year: "Today",
                head: "Built in the region, for the region",
                body: "GDPVision is designed against the exposures Caribbean and small-island states actually carry — revenue concentration, climate shock, external repricing, and a data cadence that arrives too late to govern from. Not a global product adapted downward.",
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
              Read the business case →
            </Link>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-700">
              A decision paper for Cabinet Secretaries, ministries of finance and procurement — the
              stakes, the tier-one test, the options appraisal and the recommended path.
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
                eyebrow="Cabinet briefing"
                title="Request a confidential briefing."
                lede="A short, dignified enquiry from a member of a sitting government or their designated advisor. OPEN Interactive responds within one working day."
              />
              <div className="mt-10 flex items-start justify-between gap-8">
                <div className="space-y-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                  <div>— Delivered in person or over secure video</div>
                  <div>— Sixty minutes, no slideware</div>
                  <div>— Under NDA on request</div>
                  <div>— Nothing is recorded</div>
                </div>
                <Illustration
                  src={illBriefing.url}
                  variant="spot"
                  className="hidden shrink-0 md:block"
                />
              </div>
              <p className="mt-8 max-w-md text-[15px] leading-relaxed text-ink-700">
                Briefings are prepared against your nation's own public data. You will see your
                economy in the instrument, not a generic demonstration.
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
