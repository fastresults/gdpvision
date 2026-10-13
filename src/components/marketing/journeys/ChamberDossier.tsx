import { Explain } from "@/components/explain/Explain";
import "@/lib/explain/journeys-entries";
import { cn } from "@/lib/utils";
import type { ChamberJourney } from "../chamberDecisionJourneys";
import { STAGE_PLAYBOOK, evidenceChips } from "./journeyRouting";
import { stageFinding, stageOperation } from "./journeyVisuals";

/** Act 5 — "Open the Chamber": evidence tray → workbench → decision file. */
export function ChamberDossier({ journey, beat }: { journey: ChamberJourney; beat: number }) {
  const stages = journey.stageDetail;
  const play = STAGE_PLAYBOOK[journey.chamber];
  const chips = evidenceChips(journey);
  const active = Math.min(Math.floor(beat / 6), stages.length - 1);
  const stageBeat = beat % 6;
  const done = beat >= stages.length * 6 - 1;
  const [usual, withGdp] = journey.profile.clock;
  const inCountry = chips.filter((c) => c.inCountry).length;
  const current = stages[active];
  const step = play[active];

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto px-4 py-4 md:px-6">
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            Working stage {active + 1} of 5 · {journey.profile.kind}
          </div>
          <h3 className="font-display text-2xl text-ink-950">{current.stage}</h3>
          <div className="mt-0.5 text-[11px] text-ink-500">
            Evidence used: {chips.length} sources · {inCountry} kept in country
          </div>
        </div>
        <div className="shrink-0 border border-line-200 bg-paper-0 px-3 py-1.5 text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            <Explain id="journeys.clock">Illustrative decision time</Explain>
          </div>
          <div className="font-display text-base text-ink-950">
            <span className="text-ink-500 line-through decoration-gold-500">{usual}</span>
            <span className="mx-1.5 text-gold-500">→</span>
            {withGdp}
          </div>
        </div>
      </div>

      {/* Stage rail */}
      <ol className="grid grid-cols-5 gap-1" aria-label="Chamber stages">
        {stages.map((s, i) => (
          <li
            key={s.stage}
            className={cn(
              "border px-2 py-1.5 transition-colors duration-500",
              i === active
                ? "border-gold-500 bg-ink-950 text-paper-0"
                : i < active
                  ? "border-ink-700 bg-paper-0 text-ink-950"
                  : "border-line-200 bg-paper-0 text-ink-500",
            )}
          >
            <span className={cn("font-mono text-[10px]", i <= active && "text-gold-500")}>
              {i < active ? "✓" : `0${i + 1}`}
            </span>
            <span className="block text-[12px] leading-snug">{s.stage}</span>
          </li>
        ))}
      </ol>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[150px_minmax(0,1fr)_200px]">
        {/* Information used */}
        <div className="p-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Information used
          </div>
          <ul className="mt-2 space-y-1.5">
            {chips.map((c, i) => {
              const lit = stageBeat >= 1 && (i % stages.length === active || (active === 0 && i === 0));
              return (
                <li
                  key={c.id}
                  className={cn(
                    "flex flex-col border px-2 py-1 text-[11px] transition-all duration-500",
                    lit
                      ? "translate-x-1 border-gold-500 text-ink-950"
                      : "border-line-200 text-ink-700",
                  )}
                >
                  <span className="leading-snug">{c.label}</span>
                  <span className="font-mono text-[10px] text-ink-500">
                    {c.inCountry ? "IN-COUNTRY" : "PUBLIC"} · {c.grade}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Workbench */}
        <div key={active} className="cjj-beat min-w-0 p-2">
          <div className="text-[12px] font-semibold text-gold-500">Decision to prepare</div>
          <p className="mt-1 text-[15px] leading-snug text-ink-950">{step.ask}</p>
          <p className="mt-2 text-[13px] text-ink-700">{stageOperation(journey, active)}</p>
          {stageBeat >= 3 && <div className="cjj-beat mt-3 border-l-2 border-gold-500 pl-3"><span className="text-[12px] font-semibold text-ink-500">Finding</span><p className="mt-1 text-[15px] leading-snug text-ink-950">{stageFinding(journey, current, active)}</p></div>}
          <div className="mt-3 grid grid-cols-3 gap-1" aria-label="Decision checks">
            {["Question", "Evidence", "Action", "Finding", "Check", "Approval"].map((label, i) => <span key={label} className={cn("border px-1 py-1 text-center font-mono text-[10px] uppercase", i <= stageBeat ? "border-gold-500 text-ink-950" : "border-line-200 text-ink-500")}>{label}</span>)}
          </div>
          <dl className="mt-3 space-y-3 text-[14px]">
            {stageBeat >= 1 && <div><dt className="text-[12px] font-semibold text-ink-500">Evidence used</dt><dd className="mt-1 leading-snug text-ink-950">{current.input}</dd></div>}
            {stageBeat >= 4 && <div className="cjj-beat border-t border-line-200 pt-3"><dt className="text-[12px] font-semibold text-gold-500">Required check</dt><dd className="mt-1 leading-snug text-ink-950">{step.safeguard}</dd></div>}
            {stageBeat >= 5 && <div className="cjj-beat"><dt className="text-[12px] font-semibold text-ink-500">Who reviews or approves</dt><dd className="mt-1 leading-snug text-ink-950">{step.signoff}</dd></div>}
          </dl>
          <details className="mt-4 border-t border-line-200 pt-2" onClick={(event) => event.stopPropagation()}>
            <summary className="cursor-pointer text-[12px] font-semibold text-ink-700">Full stage details</summary>
            <dl className="mt-2 space-y-2 text-[13px] text-ink-700"><div><dt className="font-semibold">Finding to establish</dt><dd>{stageFinding(journey, current, active)}</dd></div><div><dt className="font-semibold">Checks and review</dt><dd>{step.safeguard} · {step.signoff}</dd></div></dl>
          </details>
        </div>

        {/* Record for decision */}
        <div className="relative border-l border-line-200 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Record for decision
          </div>
          <ol className="mt-2 space-y-2">
            {stages.slice(0, active + (stageBeat >= 3 ? 1 : 0)).map((s, i) => (
              <li
                key={s.stage}
                className="cjj-beat border-l border-gold-500 pl-2 text-[11px] leading-snug"
              >
                <span className="font-mono text-[10px] text-gold-500">0{i + 1}</span>{" "}
                <span className="text-ink-950">{s.output}</span>
              </li>
            ))}
          </ol>
          {done && (
            <div className="cjj-beat mt-3 border-t border-dashed border-line-200 pt-2 text-[11px] text-ink-700">
              <div>
                <strong className="text-ink-950">Owner:</strong> {play[4].signoff}
              </div>
              <div>
                <strong className="text-ink-950">Review:</strong> agree a date and record progress
              </div>
              <div className="cjj-seal mt-2 inline-block rotate-[-4deg] border-2 border-gold-500 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-gold-500">
                Decision ready
              </div>
            </div>
          )}
        </div>
      </div>

      {done && (
        <div className="cjj-beat grid items-center gap-2 border border-gold-500 bg-ink-950 px-5 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold-500">
              {journey.method.output} · prepared for government review
            </div>
            <p className="font-display text-lg text-paper-0 md:text-xl">
              {journey.profile.decision}
            </p>
          </div>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-gold-300">
            Next → Value for government
          </span>
        </div>
      )}
    </div>
  );
}
