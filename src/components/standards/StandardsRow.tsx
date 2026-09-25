import type { StandardCard } from "@/lib/standards/audit.functions";
import { cn } from "@/lib/utils";

/** The standards as compact outline cards. Clicking one filters the table; clicking again clears it. */
export function StandardsRow({
  standards,
  active,
  onSelect,
}: {
  standards: StandardCard[];
  active: string | null;
  onSelect: (code: string | null) => void;
}) {
  if (standards.length === 0) return null;
  return (
    <div className="mb-8 grid gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
      {standards.map((s) => {
        const pct = s.total ? Math.round((s.met / s.total) * 100) : 0;
        const on = active === s.code;
        return (
          <button
            key={s.code}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(on ? null : s.code)}
            className={cn(
              "card-choice flex flex-col px-3 py-2.5 text-left",
              on && "border-ink-950 shadow-[inset_3px_0_0_var(--gold-500)]",
            )}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
              {s.body}
            </span>
            <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-950">
              {s.name}
            </span>
            <span className="mt-auto pt-2">
              <span className="block h-0.5 w-full bg-line-100">
                <span className="block h-0.5 bg-gold-500" style={{ width: `${pct}%` }} />
              </span>
              <span className="mt-1 block text-xs tabular-nums text-ink-700">
                {s.met}/{s.total} collected
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
