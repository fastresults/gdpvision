type Attribution = { lever_slug: string; contribution_pp: number };

export function AttributionStack({ items }: { items: Attribution[] }) {
  const filtered = items.filter((a) => Math.abs(a.contribution_pp) > 0.001);
  if (filtered.length === 0) {
    return (
      <p className="border border-line-200 p-6 text-center text-xs text-ink-500">
        No lever is contributing to GDP change yet.
      </p>
    );
  }
  const total = filtered.reduce((a, b) => a + Math.abs(b.contribution_pp), 0);
  const sorted = [...filtered].sort(
    (a, b) => Math.abs(b.contribution_pp) - Math.abs(a.contribution_pp),
  );

  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden border border-line-200">
        {sorted.map((a, i) => {
          const w = (Math.abs(a.contribution_pp) / total) * 100;
          const positive = a.contribution_pp >= 0;
          return (
            <div
              key={a.lever_slug}
              title={`${a.lever_slug} · ${positive ? "+" : ""}${a.contribution_pp.toFixed(2)} pp`}
              className="h-full border-r border-line-200 last:border-r-0"
              style={{
                width: `${w}%`,
                backgroundColor: positive
                  ? `var(--sector-0${(i % 6) + 1})`
                  : "var(--sector-04)",
                opacity: positive ? 0.85 : 0.6,
              }}
            />
          );
        })}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {sorted.map((a, i) => {
          const positive = a.contribution_pp >= 0;
          return (
            <li
              key={a.lever_slug}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5"
                  style={{
                    backgroundColor: positive
                      ? `var(--sector-0${(i % 6) + 1})`
                      : "var(--sector-04)",
                    opacity: positive ? 0.85 : 0.6,
                  }}
                />
                <span className="truncate text-ink-700">{a.lever_slug}</span>
              </span>
              <span className="font-mono tabular-nums text-ink-950">
                {positive ? "+" : ""}
                {a.contribution_pp.toFixed(2)} pp
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
