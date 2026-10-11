import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAMBER_NAMES } from "./dataDecisionScenarios";
import { CHAMBER_JOURNEYS, JOURNEY_ACTS, type ChamberJourney } from "./chamberDecisionJourneys";
import { BENEFIT_SLOTS } from "./chamberJourneyExtras";

const ACT_MS = 6000;
/** "Open the Chamber" and the benefits register get longer on screen. */
const actDuration = (act: number) => (act === 4 ? 11000 : ACT_MS);
const CHAMBER_INDICES = Object.keys(CHAMBER_NAMES);

function EvidencePlate({ journey, act }: { journey: ChamberJourney; act: number }) {
  const evidence = ["Public evidence", "Sovereign records", "Citations & grades"];

  if (act === 0) {
    return (
      <div className="cjj-question flex h-full flex-col justify-center px-6 md:px-14">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold-500">
          A decision arrives
        </div>
        <blockquote className="mt-5 max-w-5xl font-display text-3xl leading-tight text-ink-950 md:text-5xl lg:text-6xl">
          “{journey.question}”
        </blockquote>
        <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-ink-700">
          The question is not sent to a generic chatbot. It enters a governed national decision
          system built around the state’s evidence, authority and delivery machinery.
        </p>
      </div>
    );
  }

  if (act === 1) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="cjj-inquiry relative w-full max-w-4xl border border-ink-950 bg-paper-0 px-8 py-10 text-center md:px-14 md:py-14">
          <span className="absolute inset-2 border border-gold-500/40" aria-hidden="true" />
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500">
            Inquiry received · sovereign context opened
          </div>
          <div className="mx-auto my-7 h-px w-32 bg-gold-500" />
          <p className="font-display text-2xl text-ink-950 md:text-4xl">
            GDPVision frames the decision before it searches for an answer.
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-[14px] leading-relaxed text-ink-700">
            Country, time horizon, affected ministries, economic exposures, authority and evidence
            requirements are made explicit.
          </p>
        </div>
      </div>
    );
  }

  if (act === 2) {
    return (
      <div className="flex h-full flex-col justify-center px-5 md:px-10">
        <div className="grid gap-5 md:grid-cols-3">
          {evidence.map((label, index) => (
            <div
              key={label}
              className="cjj-evidence relative min-h-44 border border-line-200 bg-paper-0 p-5"
              style={{ animationDelay: `${index * 0.35}s` }}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-500">
                0{index + 1}
              </div>
              <h3 className="mt-5 font-display text-2xl text-ink-950">{label}</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-700">
                {index === 0 &&
                  "Official figures, national accounts, ministries, KPIs, capital flows and peer comparisons."}
                {index === 1 &&
                  "Sensitive state records remain inside the Sovereign Vault; only approved findings move forward."}
                {index === 2 &&
                  "Every material figure carries its source, quality and explanation into the decision."}
              </p>
              <span
                className="absolute bottom-0 left-0 h-0.5 bg-gold-500 cjj-rule"
                aria-hidden="true"
              />
            </div>
          ))}
        </div>
        <p className="mt-7 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
          The system retrieves what this decision needs — not everything it can find
        </p>
      </div>
    );
  }

  if (act === 3) {
    const radius = 168;
    return (
      <div className="flex h-full items-center justify-center overflow-hidden">
        <svg
          viewBox="0 0 760 520"
          className="cjj-ring h-full w-full max-w-5xl"
          role="img"
          aria-label={`GDPVision selects Chamber ${journey.chamber}, ${journey.method.name}`}
        >
          <defs>
            <pattern
              id="cjj-hatch"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--line-200)" />
            </pattern>
          </defs>
          <circle
            cx="380"
            cy="260"
            r="204"
            fill="none"
            stroke="var(--line-200)"
            strokeDasharray="3 7"
          />
          <circle cx="380" cy="260" r="84" fill="url(#cjj-hatch)" stroke="var(--ink-950)" />
          <text
            x="380"
            y="252"
            textAnchor="middle"
            className="fill-ink-950 font-display"
            fontSize="22"
          >
            GDPVision
          </text>
          <text
            x="380"
            y="276"
            textAnchor="middle"
            className="fill-ink-500 font-mono"
            fontSize="9"
            letterSpacing="2"
          >
            SECOND BRAIN
          </text>
          {CHAMBER_INDICES.map((index, i) => {
            const angle = -Math.PI / 2 + (i * Math.PI * 2) / CHAMBER_INDICES.length;
            const x = 380 + Math.cos(angle) * radius;
            const y = 260 + Math.sin(angle) * radius;
            const active = index === journey.chamber;
            return (
              <g key={index} className={cn("cjj-orbit-node", active && "cjj-orbit-active")}>
                <line
                  x1="380"
                  y1="260"
                  x2={x}
                  y2={y}
                  stroke={active ? "var(--gold-500)" : "var(--line-200)"}
                  strokeWidth={active ? 2 : 1}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={active ? 38 : 28}
                  fill="var(--paper-0)"
                  stroke={active ? "var(--gold-500)" : "var(--ink-700)"}
                  strokeWidth={active ? 2 : 1}
                />
                <text
                  x={x}
                  y={y + 5}
                  textAnchor="middle"
                  className={active ? "fill-gold-500 font-mono" : "fill-ink-700 font-mono"}
                  fontSize={active ? 15 : 12}
                >
                  {index}
                </text>
              </g>
            );
          })}
          <text
            x="380"
            y="500"
            textAnchor="middle"
            className="fill-ink-950 font-display"
            fontSize="24"
          >
            Chamber {journey.chamber} · {journey.method.name}
          </text>
        </svg>
      </div>
    );
  }

  if (act === 4) {
    const [usual, withGdp] = journey.profile.clock;
    return (
      <div className="h-full overflow-auto px-4 py-5 md:px-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
              Chamber {journey.chamber} · inside the decision · {journey.profile.kind}
            </div>
            <h3 className="mt-1 font-display text-2xl text-ink-950 md:text-3xl">
              {journey.method.name}
            </h3>
          </div>
          <div
            className="cjj-clock border border-line-200 bg-paper-0 px-3 py-2 text-right"
            aria-label={`Illustrative decision time: usually ${usual}, with GDPVision ${withGdp}`}
          >
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
              Time to decision · illustrative
            </div>
            <div className="mt-1 font-display text-lg text-ink-950">
              <span className="text-ink-500 line-through decoration-gold-500">{usual}</span>
              <span className="mx-2 text-gold-500">→</span>
              <span>{withGdp}</span>
            </div>
          </div>
        </div>

        <ol className="relative mt-5 grid gap-3 md:grid-cols-5">
          <span
            aria-hidden
            className="cjj-rail pointer-events-none absolute left-0 top-[18px] hidden h-px bg-gold-500 md:block"
          />
          {journey.stageDetail.map((detail, index) => (
            <li
              key={detail.stage}
              className="cjj-method-stage relative flex flex-col border border-ink-700 bg-paper-0 p-3"
              style={{ animationDelay: `${0.4 + index * 1.4}s` }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-500 bg-paper-0 font-mono text-[11px] text-gold-500">
                0{index + 1}
              </span>
              <strong className="mt-2 block text-[13px] leading-snug text-ink-950">
                {detail.stage}
              </strong>
              <dl className="mt-2 space-y-2 text-[12px] leading-snug">
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                    In
                  </dt>
                  <dd className="text-ink-700">{detail.input}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-gold-500">
                    Out
                  </dt>
                  <dd className="text-ink-950">{detail.output}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>

        <div className="cjj-output mt-5 border border-gold-500 bg-ink-950 px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold-500">
            {journey.method.output} · the decision Cabinet can now take
          </div>
          <p className="mt-1 font-display text-xl text-paper-0 md:text-2xl">
            {journey.profile.decision}
          </p>
        </div>
      </div>
    );
  }

  const benefits = Object.values(journey.benefits);
  return (
    <div className="h-full overflow-auto px-5 py-6 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold-500">
          Executive dividend register · {journey.title}
        </div>
        <h3 className="mt-2 font-display text-3xl text-ink-950 md:text-4xl">
          What this changes for the Prime Minister
        </h3>
        <ol className="mt-6 grid gap-px border border-line-200 bg-line-200 md:grid-cols-5">
          {benefits.map((benefit, index) => {
            const slot = BENEFIT_SLOTS[index];
            return (
              <li
                key={slot.label}
                className="cjj-benefit flex min-h-56 flex-col bg-paper-0 p-4"
                style={{ animationDelay: `${index * 0.45}s` }}
              >
                <span className="font-mono text-[11px] font-semibold text-gold-500">
                  0{index + 1} · {slot.label}
                </span>
                <strong className="mt-3 block font-display text-lg leading-tight text-ink-950">
                  {slot.headline}
                </strong>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-700">{benefit}</p>
                <p className="mt-auto border-t border-dashed border-line-200 pt-2 text-[11px] italic leading-snug text-ink-500">
                  {slot.before}
                </p>
              </li>
            );
          })}
        </ol>
        <p
          className="cjj-benefit mt-7 border-l-2 border-gold-500 pl-4 font-display text-xl italic text-ink-950 md:text-2xl"
          style={{ animationDelay: "2.5s" }}
        >
          Faster, defensible decisions — protected growth. {journey.outcome}
        </p>
      </div>
    </div>
  );
}

export function ChamberDecisionJourneys() {
  const openingIndex = CHAMBER_JOURNEYS.findIndex(
    (journey) => journey.title === "72-hour tourism shock",
  );
  const [journeyIndex, setJourneyIndex] = useState(openingIndex < 0 ? 0 : openingIndex);
  const [chamber, setChamber] = useState("03");
  const [act, setAct] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [cycle, setCycle] = useState(0);
  const [reduce, setReduce] = useState(false);
  const journey = CHAMBER_JOURNEYS[journeyIndex];
  const chamberJourneys = useMemo(
    () => CHAMBER_JOURNEYS.filter((item) => item.chamber === chamber),
    [chamber],
  );

  useEffect(() => setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  useEffect(() => {
    if (!playing || reduce || act >= JOURNEY_ACTS.length - 1) return;
    const timer = window.setTimeout(() => setAct((current) => current + 1), ACT_MS);
    return () => window.clearTimeout(timer);
  }, [act, playing, reduce, cycle]);

  const chooseJourney = (next: ChamberJourney) => {
    const index = CHAMBER_JOURNEYS.findIndex((item) => item.id === next.id);
    if (index < 0) return;
    setJourneyIndex(index);
    setChamber(next.chamber);
    setAct(0);
    setPlaying(!reduce);
    setCycle((value) => value + 1);
  };
  const goToAct = (next: number) => {
    setAct(Math.max(0, Math.min(JOURNEY_ACTS.length - 1, next)));
    setCycle((value) => value + 1);
  };

  return (
    <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 border-b border-line-200 pb-4 lg:max-h-full lg:w-[300px] lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r lg:pb-4 lg:pr-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-500">
          Featured for this briefing
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible">
          {CHAMBER_JOURNEYS.filter((item) => item.featured).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => chooseJourney(item)}
              aria-pressed={item.id === journey.id}
              className={cn(
                "card-choice min-w-44 px-3 py-2 text-left lg:min-w-0",
                item.id === journey.id && "card-choice-active",
              )}
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] opacity-70">
                {item.chamber} · {item.method.name}
              </span>
              <span className="mt-1 block text-[12px] leading-snug">{item.title}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Choose a Chamber
        </div>
        <div
          className="mt-2 flex gap-1 overflow-x-auto pb-2 lg:grid lg:grid-cols-5"
          role="tablist"
          aria-label="Chamber journeys"
        >
          {CHAMBER_INDICES.map((index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={chamber === index}
              aria-label={`Chamber ${index}, ${CHAMBER_NAMES[index]}`}
              onClick={() => setChamber(index)}
              className={cn(
                "card-choice h-9 min-w-11 px-2 font-mono text-[11px]",
                chamber === index && "card-choice-active",
              )}
            >
              {index}
            </button>
          ))}
        </div>
        <div className="mt-2 space-y-2" aria-live="polite">
          <div className="text-[12px] font-semibold text-ink-950">{CHAMBER_NAMES[chamber]}</div>
          {chamberJourneys.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => chooseJourney(item)}
              aria-pressed={item.id === journey.id}
              className={cn(
                "card-choice w-full px-3 py-2 text-left",
                item.id === journey.id && "card-choice-active",
              )}
            >
              <span className="block font-mono text-[9px] uppercase tracking-[0.14em] opacity-70">
                {item.title}
              </span>
              <span className="mt-1 block text-[12px] leading-snug">{item.question}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-[620px] min-w-0 flex-1 flex-col lg:min-h-0">
        <div className="shrink-0 border-l-2 border-gold-500 pl-3" aria-live="polite">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Chamber {journey.chamber} · {journey.method.name} · {JOURNEY_ACTS[act]}
          </div>
          <h2 className="mt-1 font-display text-xl text-ink-950 md:text-2xl">{journey.question}</h2>
        </div>

        <div
          className="mt-3 flex shrink-0 gap-1 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Presentation acts"
        >
          {JOURNEY_ACTS.map((label, index) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={act === index}
              onClick={() => goToAct(index)}
              className={cn(
                "card-choice min-w-[132px] flex-1 px-2 py-2 text-left",
                act === index && "card-choice-active",
              )}
            >
              <span className="font-mono text-[9px] opacity-60">0{index + 1}</span>
              <span className="mt-1 block text-[11px] leading-tight">{label}</span>
            </button>
          ))}
        </div>

        <div
          key={`${journey.id}-${act}-${cycle}`}
          className="cjj mt-3 min-h-[430px] flex-1 overflow-hidden border border-line-200 bg-paper-50"
        >
          <EvidencePlate journey={journey} act={act} />
        </div>

        <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => goToAct(act - 1)}
              disabled={act === 0}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setCycle((value) => value + 1);
                setPlaying(!reduce);
              }}
            >
              <RotateCcw className="h-4 w-4" /> Replay
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => goToAct(act + 1)}
              disabled={act === JOURNEY_ACTS.length - 1}
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPlaying((value) => !value)}
              disabled={reduce || act === JOURNEY_ACTS.length - 1}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="btn-accent"
              onClick={() => goToAct(JOURNEY_ACTS.length - 1)}
            >
              <Sparkles className="h-4 w-4" /> Benefits
            </button>
          </div>
        </div>
        <p className="sr-only">
          Act {act + 1} of {JOURNEY_ACTS.length}: {JOURNEY_ACTS[act]}.{" "}
          {act === 4
            ? journey.method.stages.join(". ")
            : act === 5
              ? Object.values(journey.benefits).join(" ")
              : journey.question}
        </p>
      </section>
    </div>
  );
}
