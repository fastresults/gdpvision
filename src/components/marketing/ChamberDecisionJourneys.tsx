import { useEffect, useMemo, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAMBER_NAMES } from "./dataDecisionScenarios";
import { CHAMBER_JOURNEYS, JOURNEY_ACTS, type ChamberJourney } from "./chamberDecisionJourneys";
import { ChamberDossier } from "./journeys/ChamberDossier";
import { ChamberRouter } from "./journeys/ChamberRouter";
import { DecisionArrival } from "./journeys/DecisionArrival";
import { EvidenceAssembly } from "./journeys/EvidenceAssembly";
import { ExecutiveDividend } from "./journeys/ExecutiveDividend";
import { InquiryDesk } from "./journeys/InquiryDesk";
import { visualAudit } from "./journeys/journeyVisuals";

const BEAT_MS = [3600, 3000, 3300, 3200, 2500, 3200] as const;
const CHAMBER_INDICES = Object.keys(CHAMBER_NAMES);

function beatCount(act: number, journey: ChamberJourney) {
  return [4, 6, 5, 5, journey.stageDetail.length * 6, 6][act] ?? 1;
}

function EvidencePlate({
  journey,
  act,
  beat,
}: {
  journey: ChamberJourney;
  act: number;
  beat: number;
}) {
  if (act === 0) return <DecisionArrival journey={journey} beat={beat} />;
  if (act === 1) return <InquiryDesk journey={journey} beat={beat} />;
  if (act === 2) return <EvidenceAssembly journey={journey} beat={beat} />;

  if (act === 3) return <ChamberRouter journey={journey} beat={beat} />;
  if (act === 4) return <ChamberDossier journey={journey} beat={beat} />;

  return <ExecutiveDividend journey={journey} beat={beat} />;
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
  const [cycle, setCycle] = useState(0);
  const [reduce, setReduce] = useState(false);
  const journey = CHAMBER_JOURNEYS[journeyIndex];
  const chamberJourneys = useMemo(
    () => CHAMBER_JOURNEYS.filter((item) => item.chamber === chamber),
    [chamber],
  );
  const audit = useMemo(() => CHAMBER_JOURNEYS.every((item) => visualAudit(item).complete), []);

  useEffect(() => setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  useEffect(() => {
    if (!playing || reduce) return;
    const count = beatCount(act, journey);
    const timer = window.setTimeout(
      () => {
        if (beat < count - 1) setBeat((b) => b + 1);
        else if (act < JOURNEY_ACTS.length - 1) {
          setBeat(0);
          setAct((current) => current + 1);
        }
        else {
          setBeat(0);
          setAct(0);
        }
      },
      BEAT_MS[act],
    );
    return () => window.clearTimeout(timer);
  }, [act, beat, playing, reduce, cycle, journey]);

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
  const beatsHere = beatCount(act, journey);
  const stepForward = () => {
    if (beat < beatsHere - 1) setBeat((b) => b + 1);
    else goToAct(act + 1);
  };
  const stepBack = () => {
    if (beat > 0) setBeat((b) => b - 1);
    else goToAct(act - 1, Math.max(0, beatCount(act - 1, journey) - 1));
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
          data-held={!playing || undefined}
          onClick={() => !reduce && setPlaying((value) => !value)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (!reduce) setPlaying((value) => !value);
            }
          }}
          aria-label={playing ? "Pause decision theatre" : "Resume decision theatre"}
          className="hover-intent cjj mt-3 min-h-[430px] flex-1 cursor-pointer overflow-hidden border border-line-200 bg-paper-50"
        >
          <EvidencePlate journey={journey} act={act} beat={reduce ? beatCount(act, journey) - 1 : beat} />
          {!playing && !reduce && <span className="pointer-events-none absolute right-3 top-3 border border-gold-500 bg-ink-950 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-gold-300">Paused · click to resume</span>}
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
              disabled={reduce}
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
        {!audit && <p className="sr-only">One or more journeys has incomplete visual content.</p>}
      </section>
    </div>
  );
}
