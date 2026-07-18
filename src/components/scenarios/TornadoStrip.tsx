// Sensitivity tornado. Consumes a pre-computed sweep set produced by the parent
// (a Promise.all fan-out over the top attributed levers). Pure presentation.

export type TornadoRow = {
  slug: string;
  low: number; // year-1 P50 at lever_low
  high: number; // year-1 P50 at lever_high
  base: number; // year-1 P50 at current settings
};

export function TornadoStrip({ rows }: { rows: TornadoRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="border border-line-200 p-6 text-center text-xs text-ink-500">
        Sensitivity unavailable — no active levers to sweep.
      </p>
    );
  }
  const min = Math.min(...rows.flatMap((r) => [r.low, r.high, r.base]));
  const max = Math.max(...rows.flatMap((r) => [r.low, r.high, r.base]));
  const range = max - min || 1;
  const pos = (v: number) => ((v - min) / range) * 100;
  const basePos = rows[0] ? pos(rows[0].base) : 50;

  return (
    <div>
      <ul className="divide-y divide-line-200 border-t border-line-200">
        {rows.map((r) => {
          const l = Math.min(r.low, r.high);
          const h = Math.max(r.low, r.high);
          return (
            <li
              key={r.slug}
              className="grid grid-cols-[180px_1fr_96px] items-center gap-3 py-3"
            >
              <span className="truncate text-xs text-ink-700">{r.slug}</span>
              <div className="relative h-3 border-l border-r border-line-200 bg-paper-100">
                <div
                  className="absolute inset-y-0 w-px bg-ink-500/50"
                  style={{ left: `${basePos}%` }}
                />
                <div
                  className="absolute inset-y-0"
                  style={{
                    left: `${pos(l)}%`,
                    width: `${Math.max(1, pos(h) - pos(l))}%`,
                    backgroundColor: "var(--sector-09)",
                    opacity: 0.7,
                  }}
                />
              </div>
              <span
                className="text-right font-mono text-[11px] tabular-nums text-ink-950"
                data-numeric
              >
                {l.toFixed(2)}…{h.toFixed(2)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-500">
        Range of Year-1 P50 GDP when the lever is swept across ±50% of its bounds.
      </p>
    </div>
  );
}
