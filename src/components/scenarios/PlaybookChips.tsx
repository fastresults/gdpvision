import { useState } from "react";
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
  const [hoverId, setHoverId] = useState<string | null>(null);
  const shownId = hoverId ?? activeId;
  const shown = PLAYBOOKS.find((p) => p.id === shownId);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {PLAYBOOKS.map((p) => {
          const active = p.id === activeId;
          return (
            <button
              key={p.id}
              onClick={() => onPick(p.id, p.build(defs))}
              onMouseEnter={() => setHoverId(p.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(p.id)}
              onBlur={() => setHoverId(null)}
              className={
                "truncate border px-2.5 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.15em] transition " +
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
      <p className="mt-2 min-h-[2.25rem] text-[11px] leading-snug text-ink-500">
        {shown?.blurb ?? "Hover a playbook to preview its intent."}
      </p>
    </div>
  );
}
