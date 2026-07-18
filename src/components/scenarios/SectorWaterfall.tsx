import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

type Impact = { sector_code: string; share_pct_end: number; delta_pp: number };

export function SectorWaterfall({ impacts }: { impacts: Impact[] }) {
  const rows = [...impacts]
    .filter((i) => Math.abs(i.delta_pp) > 0.001)
    .sort((a, b) => Math.abs(b.delta_pp) - Math.abs(a.delta_pp))
    .slice(0, 10);

  if (rows.length === 0) {
    return (
      <p className="border border-line-200 p-6 text-center text-xs text-ink-500">
        No sector movement at current lever settings.
      </p>
    );
  }

  const max = Math.max(...rows.map((r) => Math.abs(r.delta_pp)));
  return (
    <ul className="divide-y divide-line-200 border-t border-line-200">
      {rows.map((r) => {
        const meta = CANONICAL_SECTORS.find((c) => c.slug === r.sector_code);
        const pct = (Math.abs(r.delta_pp) / max) * 50; // %-of-half-track
        const positive = r.delta_pp > 0;
        return (
          <li
            key={r.sector_code}
            className="grid grid-cols-[180px_1fr_72px] items-center gap-3 py-3"
          >
            <span className="flex items-center gap-2 text-sm text-ink-950">
              <span
                className="inline-block h-3 w-1"
                style={{ backgroundColor: `var(${meta?.cssVar ?? "--ink-500"})` }}
              />
              <span className="truncate">{meta?.label ?? r.sector_code}</span>
            </span>
            <div className="relative h-4 border-l border-r border-line-200 bg-paper-100">
              <div className="absolute inset-y-0 left-1/2 w-px bg-ink-500/50" />
              <div
                className="absolute inset-y-0"
                style={{
                  left: positive ? "50%" : `${50 - pct}%`,
                  width: `${pct}%`,
                  backgroundColor: positive
                    ? "var(--sector-06)"
                    : "var(--sector-04)",
                  opacity: 0.7,
                }}
              />
            </div>
            <span
              className="text-right font-mono text-xs tabular-nums text-ink-950"
              data-numeric
            >
              {positive ? "+" : ""}
              {r.delta_pp.toFixed(2)} pp
            </span>
          </li>
        );
      })}
    </ul>
  );
}
