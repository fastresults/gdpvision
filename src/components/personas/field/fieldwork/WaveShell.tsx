// Chamber 07 · Stage 04 · a wave card.
//
// One card per real piece of fielding the approved plan obliges. It always
// states what the wave is for, where it stands, and the one action that moves
// it — so the desk reads as a ladder rather than a pair of boxes.

import type { ReactNode } from "react";

import { Explain } from "@/components/explain/Explain";
import type { WaveState } from "@/lib/personas/fieldwork-plan.server";

const STATUS_LABEL: Record<WaveState["status"], string> = {
  not_started: "Not started",
  fielding: "In the field",
  complete: "Complete",
};

function Bar({ done, target }: { done: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : done > 0 ? 100 : 0;
  return (
    <div className="mt-2 h-1.5 w-full bg-line-100">
      <div className="h-full bg-ink-950" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function WaveShell({
  index,
  state,
  done,
  target,
  meter,
  children,
}: {
  index: number;
  state: WaveState;
  done: number;
  target: number;
  meter: string;
  children: ReactNode;
}) {
  const { wave, status } = state;
  return (
    <section className="border border-line-200 bg-paper-0">
      <header className="border-b border-line-200 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Wave {index} · {wave.methods[0] ?? wave.title}
          </p>
          <span
            className={
              status === "complete"
                ? "font-mono text-[10px] uppercase tracking-[0.16em] text-ink-950"
                : "font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500"
            }
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
        <h3 className="mt-1 font-serif text-xl leading-tight text-ink-950">{wave.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{wave.purpose}</p>
        {wave.audiences.length > 0 ? (
          <p className="mt-1 font-mono text-[11px] text-ink-500">{wave.audiences.join(" · ")}</p>
        ) : null}
        <Bar done={done} target={target} />
        <p className="mt-1 font-mono text-[11px] tabular-nums text-ink-600">
          <Explain id="research.fieldwork.waves">{meter}</Explain>
        </p>
        {status !== "complete" ? (
          <p className="mt-2 text-[12px] text-ink-700">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
              Next ·{" "}
            </span>
            {state.next}
          </p>
        ) : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
