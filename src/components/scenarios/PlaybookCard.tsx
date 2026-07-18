import { Check, Sparkles } from "lucide-react";
import { PLAYBOOKS } from "@/lib/scenarios/playbooks";
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
  activeId,
  onPick,
}: {
  defs: EngineInput["leverDefs"];
  activeId: string | null;
  onPick: (id: string, levers: Record<string, number>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {PLAYBOOKS.map((p) => {
        const active = p.id === activeId;
        const changed = countChanges(p.build(defs), defs);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id, p.build(defs))}
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
                style={{ backgroundColor: `var(${ACCENT[p.id] ?? "--ink-500"})` }}
              />
              {active && (
                <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-950">
                  <Check size={10} strokeWidth={2.5} /> selected
                </span>
              )}
            </div>
            <div className="mt-2 min-w-0">
              <p className="truncate font-serif text-sm text-ink-950">{p.label}</p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-500">
                {p.blurb}
              </p>
            </div>
            <p className="mt-2 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
              <Sparkles size={9} />
              {changed === 0 ? "no levers moved" : `${changed} lever${changed === 1 ? "" : "s"} moved`}
            </p>
          </button>
        );
      })}
    </div>
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
