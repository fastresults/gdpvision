import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export interface StatCell {
  label: string;
  value: string;
  delta?: number; // in pp
  sub?: string;
}

export function StatStrip({
  cells,
  pending,
}: {
  cells: StatCell[];
  pending?: boolean;
}) {
  return (
    <div
      className={
        "grid grid-cols-2 gap-px border border-line-200 bg-line-200 md:grid-cols-4 " +
        (pending ? "animate-pulse" : "")
      }
    >

      {cells.map((c, i) => (
        <div key={i} className="min-w-0 bg-paper-0 px-3 py-4 sm:px-4">
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.22em] text-ink-500">
            {c.label}
          </p>
          <p
            className="mt-2 whitespace-nowrap font-serif text-[26px] leading-none text-ink-950 tabular-nums lg:text-[30px]"
            data-numeric
          >
            {c.value}
          </p>

          <div className="mt-2 flex min-h-[16px] items-center gap-2 text-[10px]">
            {typeof c.delta === "number" && Math.abs(c.delta) > 0.001 ? (
              <span
                className="inline-flex items-center gap-1 font-mono tabular-nums"
                style={{
                  color:
                    c.delta > 0 ? "var(--sector-06)" : "var(--sector-04)",
                }}
              >
                {c.delta > 0 ? (
                  <ArrowUpRight size={11} />
                ) : (
                  <ArrowDownRight size={11} />
                )}
                {c.delta > 0 ? "+" : ""}
                {c.delta.toFixed(2)} pp
              </span>
            ) : typeof c.delta === "number" ? (
              <span className="inline-flex items-center gap-1 font-mono text-ink-500">
                <Minus size={11} /> baseline
              </span>
            ) : null}
            {c.sub && (
              <span className="truncate font-mono text-[10px] text-ink-500">
                {c.sub}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
