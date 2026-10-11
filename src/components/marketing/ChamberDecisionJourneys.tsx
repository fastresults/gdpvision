import { useHoverIntent } from "@/hooks/useHoverIntent";
import { useEffect, useMemo, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAMBER_NAMES } from "./dataDecisionScenarios";
import { CHAMBER_JOURNEYS, JOURNEY_ACTS, type ChamberJourney } from "./chamberDecisionJourneys";
import { BENEFIT_SLOTS } from "./chamberJourneyExtras";
import { ChamberDossier } from "./journeys/ChamberDossier";
import { ChamberRouter } from "./journeys/ChamberRouter";

const ACT_MS = 6000;
/** Acts with internal beats: Select the Chamber (3 beats), Open the Chamber (5 stages). */
const BEATS: Record<number, { count: number; ms: number }> = {
  3: { count: 3, ms: 3200 },
  4: { count: 5, ms: 3000 },
};
const CHAMBER_INDICES = Object.keys(CHAMBER_NAMES);

function EvidencePlate({
  journey,
  act,
  beat,
}: {
  journey: ChamberJourney;
  act: number;
  beat: number;
}) {
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

  if (act === 3) return <ChamberRouter journey={journey} beat={beat} />;
  if (act === 4) return <ChamberDossier journey={journey} beat={beat} />;

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
  const [beat, setBeat] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hoverHold, setHoverHold] = useState(false);
  const { hover: holdHover } = useHoverIntent<true>(
    useCallback(() => setHoverHold(true), []),
    useCallback(() => setHoverHold(false), []),
  );
  const [cycle, setCycle] = useState(0);
  const [reduce, setReduce] = useState(false);
  const journey = CHAMBER_JOURNEYS[journeyIndex];
  const chamberJourneys = useMemo(
    () => CHAMBER_JOURNEYS.filter((item) => item.chamber === chamber),
    [chamber],
  );

  useEffect(() => setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  useEffect(() => {
    if (!playing || hoverHold || reduce || act >= JOURNEY_ACTS.length - 1) return;
    const beats = BEATS[act];
    const timer = window.setTimeout(
      () => {
        if (beats && beat < beats.count - 1) setBeat((b) => b + 1);
        else {
          setBeat(0);
          setAct((current) => current + 1);
        }
      },
      beats ? beats.ms : ACT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [act, beat, playing, hoverHold, reduce, cycle]);

  const chooseJourney = (next: ChamberJourney) => {
    const index = CHAMBER_JOURNEYS.findIndex((item) => item.id === next.id);
    if (index < 0) return;
    setJourneyIndex(index);
    setChamber(next.chamber);
    setAct(0);
    setBeat(0);
    setPlaying(!reduce);
    setCycle((value) => value + 1);
  };
  const goToAct = (next: number, nextBeat = 0) => {
    setAct(Math.max(0, Math.min(JOURNEY_ACTS.length - 1, next)));
    setBeat(nextBeat);
    setCycle((value) => value + 1);
  };
  const beatsHere = reduce ? 1 : (BEATS[act]?.count ?? 1);
  const stepForward = () => {
    if (beat < beatsHere - 1) setBeat((b) => b + 1);
    else goToAct(act + 1);
  };
  const stepBack = () => {
    if (beat > 0) setBeat((b) => b - 1);
    else goToAct(act - 1, reduce ? 0 : Math.max(0, (BEATS[act - 1]?.count ?? 1) - 1));
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
          {...holdHover(true)}
          data-held={hoverHold || undefined}
          className="hover-intent cjj mt-3 min-h-[430px] flex-1 overflow-hidden border border-line-200 bg-paper-50"
        >
          <EvidencePlate journey={journey} act={act} beat={reduce ? 9 : beat} />
        </div>

        <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={stepBack}
              disabled={act === 0 && beat === 0}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setBeat(0);
                setCycle((value) => value + 1);
                setPlaying(!reduce);
              }}
            >
              <RotateCcw className="h-4 w-4" /> Replay
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={stepForward}
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
