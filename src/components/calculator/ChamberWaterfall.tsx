import { CHAMBERS } from "@/lib/chambers";
import { formatUsd, type ChamberContribution } from "@/lib/calculator/model";

const ACCENT: Record<string, string> = Object.fromEntries(
  CHAMBERS.map((c) => [c.index, c.accentVar]),
);

/**
 * Attribution of the verdict across the eight chambers. Horizontal on desktop,
 * a stacked list on mobile — the same numbers either way.
 */
export function ChamberWaterfall({ chambers }: { chambers: ChamberContribution[] }) {
  const active = chambers.filter((c) => c.usd > 0).sort((a, b) => b.usd - a.usd);

  if (active.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-ink-500">
        No chamber is adopted. The verdict is nil by construction.
      </p>
    );
  }

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden border border-line-200" role="img" aria-label="Contribution by chamber">
        {active.map((c) => (
          <div
            key={c.index}
            style={{ width: `${Math.max(c.share * 100, 0.5)}%`, backgroundColor: `var(${ACCENT[c.index] ?? "--sector-01"})` }}
            title={`${c.index} · ${c.short} — ${formatUsd(c.usd)}`}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {active.map((c) => (
          <li key={c.index} className="flex items-baseline gap-3">
            <span
              aria-hidden
              className="mt-[6px] h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: `var(${ACCENT[c.index] ?? "--sector-01"})` }}
            />
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-700">
              <span className="font-mono text-[11px] tracking-[0.12em] text-ink-500">{c.index}</span>{" "}
              {c.short}
            </span>
            <span className="shrink-0 font-mono text-[12px] tabular-nums text-ink-950">
              {formatUsd(c.usd)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
