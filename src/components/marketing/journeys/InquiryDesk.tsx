import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChamberJourney } from "../chamberDecisionJourneys";
import { BeatLabel, DecisionDocket } from "./JourneyPrimitives";
import { decisionFrame } from "./journeyVisuals";

export function InquiryDesk({ journey, beat }: { journey: ChamberJourney; beat: number }) {
  const frame = decisionFrame(journey);
  const fields = [
    ["Country context", `Your country’s evidence · Workspace ${journey.chamber}`],
    ["Who decides", frame.authority],
    ["Illustrative time comparison", `${frame.horizon} · not measured`],
    ["What is at stake", frame.exposures.join(" · ")],
    ["What must be respected", frame.constraints.join(" · ")],
    ["Intended benefit", frame.success],
  ];
  return (
    <div className="grid h-full gap-5 overflow-auto px-4 py-5 xl:grid-cols-[170px_minmax(0,1fr)_220px] lg:items-center md:px-7">
      <div>
        <BeatLabel index={0}>The question received</BeatLabel>
        <DecisionDocket title={frame.decision} active />
      </div>
      <div className="relative">
        <div className="mb-2 flex items-center justify-between"><BeatLabel index={1}>Clarify what government needs</BeatLabel><span className="font-mono text-[10px] text-ink-500">{Math.min(beat + 1, 6)} / 6 fields</span></div>
        <ol className="grid gap-2 sm:grid-cols-2">
          {fields.map(([label, value], index) => {
            const active = index <= beat;
            return <li key={label} className={cn("border bg-paper-0 p-3 transition-all duration-500", active ? "cjj-beat border-gold-500" : "border-line-200")}>
              <div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">0{index + 1} · {label}</span>{active && <Check className="h-3.5 w-3.5 text-gold-500" />}</div>
              <p className="mt-2 min-h-10 text-[14px] leading-snug text-ink-950">{active ? value : "—"}</p>
            </li>;
          })}
        </ol>
        <div className="cjj-converge pointer-events-none absolute inset-x-8 top-1/2 h-px bg-gold-500 opacity-20" />
      </div>
      <div className={cn("transition-opacity duration-500", beat >= 5 ? "cjj-beat" : "hidden")}>
        <BeatLabel index={6}>Ready to work through</BeatLabel>
        <div className="mt-2 border border-gold-500 bg-ink-950 p-4 text-paper-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold-300">Decision to prepare</div>
          <p className="mt-3 font-display text-lg leading-snug">{frame.decision}</p>
          <div className="mt-4 flex items-center justify-between border-t border-gold-500 pt-3 text-[10px]"><span>Intended benefit</span><ChevronRight className="h-4 w-4 text-gold-500" /></div>
          <p className="mt-1 text-[12px] leading-snug opacity-80">{frame.success}</p>
        </div>
      </div>
    </div>
  );
}