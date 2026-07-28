import type { KpiCell } from "@/lib/executive/types";
import { TONE_TEXT } from "./tone";

/** Three numbers, identical slot positions on every chamber card. */
export function KpiTriple({ kpis, size = "md" }: { kpis: KpiCell[]; size?: "md" | "sm" }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {kpis.slice(0, 3).map((k, i) => (
        <div key={`${k.label}-${i}`} className="min-w-0">
          <div
            data-numeric
            className={`truncate font-serif leading-none ${size === "md" ? "text-[26px]" : "text-[19px]"} ${
              TONE_TEXT[k.tone ?? "neutral"]
            }`}
            title={k.value ?? "not yet on record"}
          >
            {k.value ?? <span className="text-ink-300">—</span>}
          </div>
          <div className="mt-1.5 truncate font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
            {k.label}
          </div>
        </div>
      ))}
    </div>
  );
}
