import { PLAYBOOKS } from "@/lib/scenarios/playbooks";
import type { EngineInput } from "@/lib/engine/v1_macro";

export function PlaybookChips({
  defs,
  activeId,
  onPick,
}: {
  defs: EngineInput["leverDefs"];
  activeId: string | null;
  onPick: (id: string, levers: Record<string, number>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PLAYBOOKS.map((p) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            title={p.blurb}
            onClick={() => onPick(p.id, p.build(defs))}
            className={
              "border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] transition " +
              (active
                ? "border-ink-950 bg-ink-950 text-paper-0"
                : "border-line-200 text-ink-700 hover:border-ink-950 hover:text-ink-950")
            }
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
