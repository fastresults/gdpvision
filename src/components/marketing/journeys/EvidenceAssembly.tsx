import { Check, GitCompareArrows, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChamberJourney } from "../chamberDecisionJourneys";
import { ApprovalGate, BeatLabel, EvidenceDocument, GoldRoute } from "./JourneyPrimitives";
import { evidenceChips } from "./journeyRouting";

export function EvidenceAssembly({ journey, beat }: { journey: ChamberJourney; beat: number }) {
  const chips = evidenceChips(journey);
  const publicEvidence = chips.filter((chip) => !chip.inCountry);
  const privateEvidence = chips.filter((chip) => chip.inCountry);
  return (
    <div className="flex h-full flex-col overflow-auto px-4 py-5 md:px-7">
      <div className="grid flex-1 items-stretch gap-2 lg:grid-cols-[1fr_34px_1fr_34px_1fr_34px_1fr]">
        <section className="p-3">
          <BeatLabel index={0}>Gather relevant sources</BeatLabel>
          <div className="mt-3 space-y-2">
            {publicEvidence.map((chip, index) => (
              <EvidenceDocument
                key={chip.id}
                label={chip.label}
                active={beat >= 0 && index <= beat}
              />
            ))}
          </div>
        </section>
        <div className="hidden items-center lg:flex">
          <GoldRoute active={beat >= 1} />
        </div>
        <section
          className={cn(
            "border p-3",
            beat >= 1 ? "cjj-beat border-gold-500 bg-paper-0" : "border-line-200 bg-paper-50",
          )}
        >
          <BeatLabel index={1}>Use protected records safely</BeatLabel>
          <div className="mt-3 space-y-2">
            <div className="mb-2 font-mono text-[10px] uppercase text-gold-500">
              Government-controlled data
            </div>
            {privateEvidence.length ? (
              privateEvidence.map((chip) => (
                <EvidenceDocument
                  key={chip.id}
                  label={chip.label}
                  privateRecord
                  active={beat >= 1}
                />
              ))
            ) : (
              <EvidenceDocument label="No protected record required" privateRecord />
            )}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-500">
            Records remain in country. Approved findings move forward.
          </p>
        </section>
        <div className="hidden items-center lg:flex">
          <GoldRoute active={beat >= 2} />
        </div>
        <section
          className={cn(
            "border p-3",
            beat >= 2 ? "cjj-beat border-gold-500 bg-paper-0" : "border-line-200 bg-paper-50",
          )}
        >
          <BeatLabel index={2}>Check figures agree</BeatLabel>
          <GitCompareArrows className="mx-auto mt-6 h-8 w-8 text-gold-500" />
          <div className="mt-4 space-y-2">
            {["Compare dates", "Check definitions", "Flag missing evidence"].map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-2 border-b border-line-100 pb-1 text-[12px] text-ink-950"
              >
                <Check
                  className={cn(
                    "h-3 w-3",
                    beat > 2 || index === 0 ? "text-gold-500" : "text-line-200",
                  )}
                />
                {item}
              </div>
            ))}
          </div>
        </section>
        <div className="hidden items-center lg:flex">
          <GoldRoute active={beat >= 3} />
        </div>
        <section
          className={cn(
            "border p-3",
            beat >= 3 ? "cjj-beat border-gold-500 bg-paper-0" : "border-line-200 bg-paper-50",
          )}
        >
          <BeatLabel index={3}>Check sources and permission</BeatLabel>
          <ShieldCheck className="mx-auto mt-5 h-8 w-8 text-gold-500" />
          <div className="mt-3 grid grid-cols-3 gap-1 text-center font-mono text-[10px] uppercase text-ink-500">
            <span>Source</span>
            <span>Date</span>
            <span>Grade*</span>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-1 text-center font-display text-lg text-ink-950">
            <span>✓</span>
            <span>✓</span>
            <span>A–B</span>
          </div>
          <div className="mt-4">
            <ApprovalGate open={beat >= 4} />
          </div>
          <p className="mt-2 text-[10px] leading-snug text-ink-500">
            * Evidence grades are illustrative in this presentation.
          </p>
        </section>
      </div>
      {beat >= 4 && (
        <div className="cjj-beat mt-3 grid grid-cols-3 gap-px border border-line-200 bg-line-200 text-center">
          <div className="bg-paper-0 p-2">
            <strong className="font-display text-xl text-ink-950">{publicEvidence.length}</strong>
            <span className="block text-[11px] text-ink-500">public sources</span>
          </div>
          <div className="bg-paper-0 p-2">
            <strong className="font-display text-xl text-ink-950">{privateEvidence.length}</strong>
            <span className="block text-[11px] text-ink-500">kept in country</span>
          </div>
          <div className="bg-paper-0 p-2">
            <strong className="font-display text-xl text-gold-500">✓</strong>
            <span className="block text-[11px] text-ink-500">illustrative checks only</span>
          </div>
        </div>
      )}
    </div>
  );
}
