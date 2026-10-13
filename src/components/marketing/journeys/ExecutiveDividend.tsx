import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { BENEFIT_SLOTS } from "../chamberJourneyExtras";
import type { ChamberJourney } from "../chamberDecisionJourneys";
import { BeatLabel } from "./JourneyPrimitives";
import { decisionFrame } from "./journeyVisuals";

export function ExecutiveDividend({ journey, beat }: { journey: ChamberJourney; beat: number }) {
  const benefits = Object.values(journey.benefits);
  const frame = decisionFrame(journey);
  return (
    <div className="h-full overflow-auto px-4 py-5 md:px-7">
      <div className="flex items-end justify-between gap-4">
        <div><BeatLabel index={0}>Value for government</BeatLabel><h3 className="mt-1 font-display text-2xl text-ink-950 md:text-3xl">What government can now act on</h3></div>
        <span className="hidden font-mono text-[11px] text-ink-500 md:block">Before → With GDPVision</span>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {benefits.map((benefit, index) => {
          const slot = BENEFIT_SLOTS[index];
          const active = index <= beat;
          return <li key={slot.label} className={cn("relative min-h-48 overflow-hidden border bg-paper-0 p-3 transition-all duration-500", active ? "cjj-benefit border-gold-500" : "border-line-200")}>
            <div className="flex items-center justify-between"><span className="text-[12px] font-semibold text-gold-500">0{index + 1} · {slot.label}</span>{active && <Check className="h-3.5 w-3.5 text-gold-500" />}</div>
            <div className="mt-3 border-l border-line-200 pl-2"><div className="font-mono text-[11px] text-ink-500">Before</div><p className="mt-1 text-[12px] italic leading-snug text-ink-500">{slot.before.replace(/^Before:\s*/i, "")}</p></div>
            <ArrowRight className={cn("my-2 h-4 w-4 text-line-200", active && "cjj-shift text-gold-500")} />
            <div className={cn("border-l pl-2", active ? "border-gold-500" : "border-line-200")}><div className="font-mono text-[11px] text-gold-500">With GDPVision</div><strong className="mt-1 block font-display text-base leading-tight text-ink-950">{slot.headline}</strong><p className="mt-1 text-[12px] leading-snug text-ink-700">{benefit}</p></div>
          </li>;
        })}
      </ol>
      {beat >= 5 && <div className="cjj-beat mt-4 grid border border-gold-500 bg-ink-950 text-paper-0 md:grid-cols-[1.3fr_1fr]">
        <div className="p-4"><div className="font-mono text-[11px] tracking-[0.16em] text-gold-300">Decision brief prepared</div><p className="mt-2 font-display text-xl">{frame.decision}</p><p className="mt-2 text-[12px] leading-snug opacity-80">Ready for review: sources, checks and delivery responsibility are set out clearly.</p></div>
        <div className="border-t border-gold-500 p-4 md:border-l md:border-t-0"><ShieldCheck className="h-5 w-5 text-gold-500" /><div className="mt-2 font-mono text-[11px] text-gold-300">How this supports economic progress</div><p className="mt-2 text-[12px] leading-relaxed">Clearer evidence → informed choices → accountable delivery → stronger conditions for growth.</p></div>
      </div>}
    </div>
  );
}