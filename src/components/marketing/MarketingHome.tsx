import { useEffect, useState } from "react";
import { MarketingShell } from "./MarketingShell";
import { EXISTENTIAL_THREATS } from "@/lib/existential-threats";
import { MOMENT_VARIANTS } from "@/lib/moment-variants";
import { SignatureRing } from "./SignatureRing";
import { NumberTile } from "./NumberTile";
import { ChamberPanel } from "./ChamberPanel";
import { SectionHeader } from "./SectionHeader";
import { BriefingForm } from "./BriefingForm";
import { Wordmark } from "./Wordmark";
import ch01 from "@/assets/chambers/chamber-01.jpg.asset.json";
import ch02 from "@/assets/chambers/chamber-02.jpg.asset.json";
import ch03 from "@/assets/chambers/chamber-03.jpg.asset.json";
import ch04 from "@/assets/chambers/chamber-04.jpg.asset.json";
import ch05 from "@/assets/chambers/chamber-05.jpg.asset.json";
import ch06 from "@/assets/chambers/chamber-06.jpg.asset.json";
import ch07 from "@/assets/chambers/chamber-07.jpg.asset.json";
import ch08 from "@/assets/chambers/chamber-08.jpg.asset.json";

const CHAMBERS = [
  {
    index: "01",
    title: "The National Ledger",
    accentVar: "--sector-01",
    image: ch01.url,
    purpose:
      "The single source of GDP truth every other decision reads from.",
    bullets: [
      "A 12-sector ontology with a decade of history and a data-confidence grade on every series.",
      "Exposure indices — single, methodologically-documented numbers, drillable to source.",
      "Four-layer sector dossiers: economic, policy, comms, and regional.",
    ],
  },
  {
    index: "02",
    title: "Portfolio Workspaces",
    accentVar: "--sector-03",
    image: ch02.url,
    purpose:
      "Every minister sees their contribution to GDP — and the levers that raise it.",
    bullets: [
      "Sector position, dependency web, and the portfolio's share of national exposure.",
      "A shelf of the minister's scenarios, from draft through Cabinet-adopted.",
      "Play-of-the-day cards derived from live lever values.",
    ],
  },
  {
    index: "03",
    title: "The Scenario Engine",
    accentVar: "--sector-09",
    image: ch03.url,
    purpose:
      "Rehearse every GDP-moving decision before it costs a cent.",
    bullets: [
      "Sovereign Vitals — real GDP, debt-to-GDP, FX retention, primary balance, public confidence — live.",
      "Ripple propagation through the inter-sector dependency web.",
      "Goal-seek: set the target, discover the levers that reach it.",
    ],
  },
  {
    index: "04",
    title: "The FDI Transition Studio",
    accentVar: "--sector-07",
    image: ch04.url,
    purpose:
      "Replace fragile revenue with durable GDP through an assembled book of investment packages.",
    bullets: [
      "The Gap: the revenue and GDP hole under the selected wind-down glide-path, year by year.",
      "Investment package builder with capital-to-GDP conversion and time-to-impact lags.",
      "Readiness scoring across legal, land, workforce, incentives, and institutional capacity.",
    ],
  },
  {
    index: "05",
    title: "The Narrative Chamber",
    accentVar: "--sector-04",
    image: ch05.url,
    purpose:
      "Protect GDP by reaching a defensible national position inside a working day.",
    bullets: [
      "Signal Desk, Context Dossiers, and a persistent Second Brain that never starts from a blank page.",
      "Doctorate-grade strategy statements with a message architecture that carries across every channel.",
      "Human-command doctrine: the chamber drafts, principals decide, nothing releases autonomously.",
    ],
  },
  {
    index: "06",
    title: "The Cabinet Room",
    accentVar: "--sector-10",
    image: ch06.url,
    purpose:
      "Convert Cabinet time into recorded, tracked commitments that move the GDP dial.",
    bullets: [
      "Session Mode: agenda of promoted scenarios, full-bleed comparisons, decisions recorded live.",
      "National Scorecard — every ratified KPI, current pace, movement since last session.",
      "Commitments roll-up: what was adopted, who owns it, where it stands.",
    ],
  },
  {
    index: "07",
    title: "Persona Lab",
    accentVar: "--sector-06",
    image: ch07.url,
    purpose:
      "Test resonance with citizens and investors before policies, incentives, or narratives ship.",
    bullets: [
      "Synthetic personas and segments modelled from the sovereign corpus and public evidence.",
      "Studies that stress-test policy, incentive, and narrative options against real audience logic.",
      "Every finding cited, exportable, and traceable back to the Ledger.",
    ],
  },
  {
    index: "08",
    title: "The Mandate Compact",
    accentVar: "--sector-02",
    image: ch08.url,
    purpose:
      "Turn the ruling party's manifesto into a signed, ministry-by-ministry delivery plan the PM can score every quarter.",
    bullets: [
      "Ingest the manifesto and decompose it into pillars, pledges, and ministry-owned deliverables.",
      "Quarterly scorecards and a PM Report Card that grade every ministry from delivered to broken.",
      "Signed, versioned compact with a full audit trail — every revision snapshotted and diffable.",
    ],
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
  const [tail, setTail] = useState(() => EXISTENTIAL_THREATS.slice(1));
  const [index, setIndex] = useState(0);
  const [momentIndex, setMomentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
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
  const goPrev = () => setMomentIndex((i) => (i - 1 + total) % total);
  const goNext = () => setMomentIndex((i) => (i + 1) % total);
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
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 py-16 md:grid-cols-[1.15fr_1fr] md:gap-16 md:px-10 md:py-24">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500">
              GDPVision · An instrument of state
            </div>
            <div className="mt-6 h-px w-16 bg-gold-500" aria-hidden />
            <h1 className="mt-8 font-serif text-[43px] leading-[1.05] tracking-tight text-ink-950 md:text-[68px]">
              No small state should learn its own economy from someone else's
              report.
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-700 md:text-[17px]">
              GDPVision is a sovereign instrument for Presidents, Prime Ministers
              and Cabinets. It holds a nation's public and private evidence in one
              graded Ledger, and lets Cabinet rehearse a decision before it is
              taken. One isolated deployment per nation. The government owns it
              outright.
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
              className="mt-4 flex items-center gap-6 border-t border-line-200 pt-3"
            >
              <button
                type="button"
                onClick={goPrevThreat}
                aria-label="Previous threat"
                className="group flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500 transition-colors duration-200 hover:text-ink-950 focus:outline-none focus-visible:text-gold-500"
              >
                <svg width="44" height="10" viewBox="0 0 44 10" fill="none" aria-hidden className="transition-transform duration-300 group-hover:-translate-x-1">
                  <path d="M43 5H1M1 5L5 1M1 5L5 9" stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
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
                className="group flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500 transition-colors duration-200 hover:text-ink-950 focus:outline-none focus-visible:text-gold-500"
              >
                <span>Next</span>
                <svg width="44" height="10" viewBox="0 0 44 10" fill="none" aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                  <path d="M1 5H43M43 5L39 1M43 5L39 9" stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
                </svg>
              </button>
            </nav>
            <div className="mt-5 flex flex-wrap items-center gap-6">
              <a
                href="#briefing"
                className="inline-flex items-center justify-center bg-ink-950 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-paper-0 transition-colors duration-200 hover:bg-gold-500"
              >
                Request a Cabinet briefing
              </a>
              <a
                href="#loop"
                className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-500 hover:text-ink-950"
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
        <div className="mx-auto max-w-[1280px] px-6 py-24 md:px-10 md:py-32">
          <div key={moment.id} className="animate-in fade-in duration-500 motion-reduce:animate-none">
            <SectionHeader
              eyebrow="The moment"
              title={moment.title}
              lede={moment.lede}
            />
            <div className="mt-16 grid gap-12 border-t border-line-200 pt-12 md:grid-cols-3">
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
          <nav
            aria-label="Cycle through economic impact scenarios"
            className="mt-16 flex items-center justify-end gap-6 border-t border-line-200 pt-6"
          >
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous scenario"
              className="group flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500 transition-colors duration-200 hover:text-ink-950 focus:outline-none focus-visible:text-gold-500"
            >
              <svg width="44" height="10" viewBox="0 0 44 10" fill="none" aria-hidden className="transition-transform duration-300 group-hover:-translate-x-1">
                <path d="M43 5H1M1 5L5 1M1 5L5 9" stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
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
              className="group flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500 transition-colors duration-200 hover:text-ink-950 focus:outline-none focus-visible:text-gold-500"
            >
              <span>Next</span>
              <svg width="44" height="10" viewBox="0 0 44 10" fill="none" aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                <path d="M1 5H43M43 5L39 1M43 5L39 9" stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
              </svg>
            </button>
          </nav>
        </div>
      </section>


      {/* CORPUS ----------------------------------------------------------- */}
      <section id="corpus" className="border-b border-line-200">
        <div className="mx-auto max-w-[1280px] px-6 py-24 md:px-10 md:py-32">
          <SectionHeader
            eyebrow="One sovereign corpus"
            title="Public data. Private data. Held apart, read together."
            lede="No other GDP instrument governs both. Public evidence is aggregated, graded and cited for every ministry. Private Cabinet uploads sit under the same provenance discipline — visible only to those with authorised country access, never mixed into the public view."
          />
          <div className="mt-16 grid gap-8 border-t border-line-200 pt-12 md:grid-cols-3">
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

      {/* INSTRUMENT — CHAMBERS ------------------------------------------- */}
      <section id="instrument" className="border-b border-line-200 bg-paper-100/40">
        <div className="mx-auto max-w-[1280px] px-6 py-24 md:px-10 md:py-32">
          <SectionHeader
            eyebrow="The instrument"
            title="Eight chambers, each engineered to move GDP."
            lede="Not a dashboard and not a consulting deliverable. GDPVision is organised as an instrument of state — a live Ledger under eight chambers, with the Counsel above them as a voice-first advisor."
          />
          <div className="mt-16 grid gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
            {CHAMBERS.map((c) => (
              <ChamberPanel key={c.index} {...c} />
            ))}
          </div>
          <p className="mt-10 max-w-2xl font-mono text-[12px] uppercase tracking-[0.16em] text-ink-500">
            Above the chambers · The Counsel — voice-first sovereign advisor,
            2–4 sentences of cited counsel, on desk or in a moving car.
          </p>
        </div>
      </section>

      {/* SOVEREIGNTY ------------------------------------------------------ */}
      <section id="sovereignty" className="border-b border-line-200">
        <div className="mx-auto grid max-w-[1280px] items-start gap-16 px-6 py-24 md:grid-cols-[1fr_1.2fr] md:px-10 md:py-32">
          <SectionHeader
            eyebrow="Sovereignty"
            title="One isolated deployment per nation. The government owns the data outright."
          />
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
                head: "Access & audit",
                body: "MFA mandatory for all roles, hardware-key support for Principals and Stewards, immutable audit log for data changes, decisions, and exports.",
              },
              {
                head: "Public and private, separated by design",
                body: "Visibility is a first-class attribute on every row. Private Cabinet uploads never enter the public corpus, are gated by country access, and every read and write is audited.",
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
        <div className="mx-auto max-w-[1280px] px-6 py-24 md:px-10 md:py-32">
          <SectionHeader
            eyebrow="Provenance"
            title="Built by OPEN Interactive — seventeen years in the room, one working prototype already running."
            lede="OPEN Interactive originated the Caribbean Investment Summit franchise, delivered national digital infrastructure for the Government of St. Kitts & Nevis, and maintains head-of-government relationships across the OECS — the same team now delivering the world's first GDP-elevation instrument for sovereign governments."
          />
          <div className="mt-16 grid gap-8 md:grid-cols-3">
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
        </div>
      </section>

      {/* BRIEFING CTA ----------------------------------------------------- */}
      <section id="briefing">
        <div className="mx-auto max-w-[1280px] px-6 py-24 md:px-10 md:py-32">
          <div className="grid gap-12 md:grid-cols-[1fr_1.4fr] md:gap-16 items-start">
            <div>
              <SectionHeader
                eyebrow="Cabinet briefing"
                title="Request a confidential briefing."
                lede="A short, dignified enquiry from a member of a sitting government or their designated advisor. OPEN Interactive responds within one working day."
              />
              <div className="mt-10 space-y-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                <div>— Delivered in person or over secure video</div>
                <div>— Sixty minutes, no slideware</div>
                <div>— Under NDA on request</div>
              </div>
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
    </MarketingShell>
  );
}
