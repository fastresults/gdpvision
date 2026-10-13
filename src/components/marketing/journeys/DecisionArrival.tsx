import { ArrowRight, BriefcaseBusiness, Clock3, RadioTower } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChamberJourney } from "../chamberDecisionJourneys";
import { BeatLabel, DecisionDocket, GoldRoute } from "./JourneyPrimitives";
import { decisionFrame } from "./journeyVisuals";

export function DecisionArrival({ journey, beat }: { journey: ChamberJourney; beat: number }) {
  const frame = decisionFrame(journey);
  return (
    <div className="flex h-full flex-col overflow-auto px-4 py-5 md:px-8">
      <div className="grid min-h-0 flex-1 items-center gap-5 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
        <div className="cjj-beat">
          <BeatLabel index={0}>The priority arrives</BeatLabel>
          <div className="mt-3 border border-ink-700 bg-paper-0 p-4">
            <div className="flex items-center justify-between">
              <RadioTower className="h-5 w-5 text-gold-500" />
              <span className="font-mono text-[10px] uppercase text-gold-500">{journey.profile.kind}</span>
            </div>
            <blockquote className="mt-4 font-display text-lg leading-snug text-ink-950">“{journey.question}”</blockquote>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <GoldRoute active={beat >= 1} />
            <ArrowRight className={cn("h-4 w-4 shrink-0 text-line-200", beat >= 1 && "text-gold-500")} />
          </div>
          {beat >= 1 && (
            <div className="cjj-beat mx-auto mt-3 max-w-md">
              <BeatLabel index={1}>Clarify the decision</BeatLabel>
              <DecisionDocket title={frame.decision} active />
            </div>
          )}
          {beat >= 2 && (
            <div className="cjj-beat mt-4">
              <BeatLabel index={2}>What is at stake</BeatLabel>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {frame.exposures.map((item, index) => (
                  <div key={item} className="border border-line-200 bg-paper-0 p-2">
                    <div className="flex items-center justify-between text-[10px] text-ink-950"><span>{item}</span><span className="text-gold-500">0{index + 1}</span></div>
                    <span className="mt-2 block h-1 bg-line-100"><span className="cjj-meter block h-full bg-gold-500" style={{ width: `${58 + index * 9}%` }} /></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={cn("opacity-25 transition-opacity duration-500", beat >= 3 && "cjj-beat opacity-100")}>
          <BeatLabel index={3}>Illustrative decision time</BeatLabel>
          <div className="mt-3 border border-gold-500 bg-ink-950 p-4 text-paper-0">
            <Clock3 className="h-5 w-5 text-gold-500" />
            <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-gold-300">Without connected evidence</div>
            <div className="font-display text-2xl line-through decoration-gold-500">{journey.profile.clock[0]}</div>
            <div className="my-2 h-px bg-gold-500" />
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold-300">With GDPVision</div>
            <div className="font-display text-3xl">{journey.profile.clock[1]}</div>
          </div>
        </div>
      </div>
      {beat >= 3 && <div className="cjj-beat mt-4 flex items-center gap-3 border-l-2 border-gold-500 bg-paper-0 p-3"><BriefcaseBusiness className="h-5 w-5 shrink-0 text-gold-500" /><p className="font-display text-lg text-ink-950">Decision to prepare: {frame.decision}</p></div>}
    </div>
  );
}