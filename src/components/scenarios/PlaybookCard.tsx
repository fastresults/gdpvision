import { Check, Sparkles } from "lucide-react";
import { PLAYBOOKS, type Playbook } from "@/lib/scenarios/playbooks";
import type { EngineInput } from "@/lib/engine/v1_macro";

const ACCENT: Record<string, string> = {
  baseline: "--ink-500",
  "cbi-winddown": "--sector-04",
  "tourism-surge": "--sector-06",
  "agri-blue": "--sector-01",
  "fiscal-consolidation": "--sector-09",
};

export function PlaybookCard({
  defs,
  activeIds,
  onToggle,
}: {
  defs: EngineInput["leverDefs"];
  activeIds: Set<string>;
  onToggle: (p: Playbook) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {PLAYBOOKS.map((p) => (
        <PlayCardButton
          key={p.id}
          play={p}
          active={activeIds.has(p.id)}
          accent={ACCENT[p.id] ?? "--ink-500"}
          changed={countChanges(p.build(defs), defs)}
          onClick={() => onToggle(p)}
        />
      ))}
    </div>
  );
}

export function PlayCardButton({
  play,
  active,
  accent,
  changed,
  onClick,
  ai,
}: {
  play: Playbook;
  active: boolean;
  accent: string;
  changed: number;
  onClick: () => void;
  ai?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "group relative flex min-h-[104px] flex-col justify-between border p-3 text-left transition " +
        (active
          ? "border-ink-950 bg-paper-100 shadow-sm"
          : "border-line-200 hover:border-ink-950 hover:bg-paper-100/60")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="inline-block h-2 w-8 shrink-0"
          style={{ backgroundColor: `var(${accent})` }}
        />
        <div className="flex items-center gap-1.5">
          {ai && (
            <span className="inline-flex items-center gap-0.5 border border-line-200 bg-paper-0 px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-ink-500">
              <Sparkles size={8} /> ai
            </span>
          )}
          {active && (
            <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-950">
              <Check size={10} strokeWidth={2.5} /> stacked
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 min-w-0">
        <p className="truncate font-serif text-sm text-ink-950">{play.label}</p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-500">{play.blurb}</p>
      </div>
      <p className="mt-2 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
        <Sparkles size={9} />
        {changed === 0 ? "no levers moved" : `${changed} lever${changed === 1 ? "" : "s"} moved`}
      </p>
    </button>
  );
}

function countChanges(
  values: Record<string, number>,
  defs: EngineInput["leverDefs"],
): number {
  let n = 0;
  for (const d of defs) {
    const dflt = d.bounds.default ?? d.bounds.min;
    if (Math.abs((values[d.slug] ?? dflt) - dflt) > 0.001) n++;
  }
  return n;
}
