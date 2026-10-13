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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            Chamber {journey.chamber} · work through the decision · {journey.profile.kind}
          </div>
          <h3 className="font-display text-2xl text-ink-950">{journey.method.name}</h3>
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

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[180px_minmax(0,1fr)_240px]">
        {/* Information used */}
        <div className="border border-line-200 bg-paper-0 p-3">
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
        <div key={active} className="cjj-beat border border-ink-700 bg-paper-0 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold-500 font-mono text-[12px] text-gold-500">
              0{active + 1}
            </span>
            <strong className="font-display text-xl leading-tight text-ink-950">
              {current.stage}
            </strong>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1" aria-label="Decision checks">
            {["Question", "Evidence", "Action", "Finding", "Check", "Approval"].map((label, i) => <span key={label} className={cn("border px-1 py-1 text-center font-mono text-[10px] uppercase", i <= stageBeat ? "border-gold-500 text-ink-950" : "border-line-200 text-ink-500")}>{label}</span>)}
          </div>
          <dl className="mt-3 divide-y divide-line-100 text-[13px]">
            {[
              ["What needs deciding", step.ask],
              ["Evidence used", current.input],
              ["What we do", stageOperation(journey, active)],
              ["What this shows", stageFinding(journey, current, active)],
              ["What must be checked", step.safeguard],
              ["Who reviews or approves", step.signoff],
            ].map(([k, v], i) => i <= stageBeat && (
              <div
                key={k}
                className="cjj-beat grid grid-cols-[100px_minmax(0,1fr)] gap-3 py-2"
                style={{ animationDelay: `${0.15 + i * 0.18}s` }}
              >
                <dt
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.16em]",
                    k === "What must be checked" ? "text-gold-500" : "text-ink-500",
                  )}
                >
                  {k}
                </dt>
                <dd className="leading-snug text-ink-950">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Record for decision */}
        <div className="relative border border-line-200 bg-paper-50 p-3">
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
