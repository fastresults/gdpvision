import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { PlaybackStrip } from "./journeys/PlaybackStrip";
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

const BEAT_MS = [4200, 3800, 4200, 4800, 3800, 4200] as const;
const CHAMBER_INDICES = Object.keys(CHAMBER_NAMES).sort((a, b) => Number(a) - Number(b));

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
    const timer = window.setTimeout(() => {
      if (beat < count - 1) setBeat((b) => b + 1);
      else if (act < JOURNEY_ACTS.length - 1) {
        setBeat(0);
        setAct((current) => current + 1);
      } else {
        setBeat(0);
        setAct(0);
      }
    }, BEAT_MS[act]);
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
    setBeat(
      Math.max(
        0,
        Math.min(
          beatCount(Math.max(0, Math.min(JOURNEY_ACTS.length - 1, next)), journey) - 1,
          nextBeat,
        ),
      ),
    );
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
      <aside className="max-h-[260px] w-full shrink-0 overflow-y-auto border-b border-line-200 pb-4 lg:max-h-full lg:w-[300px] lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r lg:pb-4 lg:pr-4">
        <div className="text-[14px] font-semibold text-ink-950">Explore a national priority</div>
        <button
          type="button"
          className="btn-ghost mt-2 w-full justify-start text-left text-[12px]"
          onClick={() => chooseJourney(CHAMBER_JOURNEYS[openingIndex < 0 ? 0 : openingIndex])}
        >
          <ArrowUpRight className="h-4 w-4 shrink-0" /> Start with the tourism example
        </button>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Choose a workspace · Chamber 01–10
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
              onClick={() => {
                const next = CHAMBER_JOURNEYS.find((item) => item.chamber === index);
                if (next) chooseJourney(next);
              }}
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
              <span className="block text-[12px] font-semibold opacity-80">{item.title}</span>
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
          aria-label="Decision stages"
        >
          {JOURNEY_ACTS.map((label, index) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={act === index}
              onClick={() => {
                goToAct(index);
                setPlaying(false);
              }}
              className={cn(
                "card-choice min-w-[112px] flex-1 px-2 py-2 text-left transition-none",
                act === index && "card-choice-active",
              )}
            >
              <span className="font-mono text-[10px] opacity-60">0{index + 1}</span>
              <span className="mt-1 block text-[11px] leading-tight">{label}</span>
            </button>
          ))}
        </div>

        <div
          key={`${journey.id}-${act}`}
          data-held={!playing || undefined}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button, a, summary, details")) return;
            if (!reduce) setPlaying((value) => !value);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (!reduce) setPlaying((value) => !value);
            }
          }}
          aria-label={playing ? "Pause decision journey" : "Resume decision journey"}
          className="hover-intent cjj relative mt-3 min-h-[430px] flex-1 cursor-pointer overflow-hidden border border-line-200 bg-paper-50"
        >
          <EvidencePlate
            journey={journey}
            act={act}
            beat={reduce ? beatCount(act, journey) - 1 : beat}
          />
        </div>

        <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line-200 pt-2">
          <PlaybackStrip
            playing={playing}
            reduced={reduce}
            first={act === 0 && beat === 0}
            last={act === JOURNEY_ACTS.length - 1 && beat === beatsHere - 1}
            progress={`${act + 1} / ${JOURNEY_ACTS.length} · Step ${beat + 1} / ${beatsHere}`}
            onPrevious={() => {
              setPlaying(false);
              stepBack();
            }}
            onNext={() => {
              setPlaying(false);
              stepForward();
            }}
            onReplay={() => {
              goToAct(0);
              setPlaying(!reduce);
            }}
            onToggle={() => setPlaying((value) => !value)}
          />
          <button
            type="button"
            className="btn-ghost text-[12px]"
            onClick={() => {
              goToAct(JOURNEY_ACTS.length - 1, beatCount(JOURNEY_ACTS.length - 1, journey) - 1);
              setPlaying(false);
            }}
          >
            Government value <ArrowUpRight className="h-4 w-4" />
          </button>
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
