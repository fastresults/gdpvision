// Chamber 07 · Stage 04 · a wave card.
//
// One card per real piece of fielding the approved plan obliges. It states what
// the wave is for, where it honestly stands, what it will produce, and the one
// move that advances it — then lays the work out as a numbered procedure so the
// operator never has to guess which control is theirs to press next.

import { ArrowDown } from "lucide-react";
import type { ReactNode } from "react";

import { Hint } from "../kit/Hint";
import { Meter } from "../kit/Meter";
import { StatusPill, type WavePhase } from "../kit/StatusPill";
import { methodLabel } from "../kit/labels";

import { Explain } from "@/components/explain/Explain";
import type { WaveState } from "@/lib/personas/fieldwork-plan.server";

export function WaveShell({
  index,
  state,
  phase,
  done,
  target,
  meter,
  produces,
  nextMove,
  onGoToNext,
  children,
}: {
  index: number;
  state: WaveState;
  phase: WavePhase;
  done: number;
  target: number;
  meter: ReactNode;
  /** What this wave leaves behind when it is finished. */
  produces: string;
  /** The single live instruction, in plain language. */
  nextMove: string | null;
  onGoToNext?: () => void;
  children: ReactNode;
}) {
  const { wave } = state;
  const variant = wave.kind === "collection" ? "collection" : "sessions";

  return (
    <section className="border border-line-200 bg-paper-0">
      <header className="border-b border-line-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Wave {index} · {methodLabel(wave.sessionMethod ?? wave.methods[0] ?? wave.title)}
          </p>
          <StatusPill phase={phase} variant={variant} />
        </div>

        <h3 className="mt-1.5 font-serif text-xl leading-tight text-ink-950">{wave.title}</h3>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-700">{wave.purpose}</p>

        {wave.audiences.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {wave.audiences.map((a) => (
              <li
                key={a}
                className="border border-line-200 bg-paper-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-600"
              >
                {a}
              </li>
            ))}
          </ul>
        ) : null}

        <Meter
          done={done}
          target={target}
          caption={<Explain id="research.fieldwork.waves">{meter}</Explain>}
        />

        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-600">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            Produces ·
          </span>
          <span>{produces}</span>
          <Hint
            what="What this wave leaves behind once it closes."
            then="Everything filed here is readable in Evidence and searchable in the second brain."
          />
        </p>

        {nextMove ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border border-ink-950 bg-paper-50 p-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
              Your next move
            </span>
            <span className="text-[13px] text-ink-950">{nextMove}</span>
            {onGoToNext ? (
              <button type="button" className="btn-ghost ml-auto" onClick={onGoToNext}>
                Take me there <ArrowDown className="ml-1 inline h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="p-4">{children}</div>
    </section>
  );
}
