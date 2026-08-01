// Chamber 07 · Field desk · honest progress.
//
// A track that still reads as a track at zero, a fill, a target tick, and a
// caption that never pretends. Nothing here rounds a fact away.

import { cn } from "@/lib/utils";

export function Meter({
  done,
  target,
  caption,
  className,
}: {
  done: number;
  target: number;
  caption: React.ReactNode;
  className?: string;
}) {
  const pct = target > 0 ? Math.min(100, (done / target) * 100) : done > 0 ? 100 : 0;
  const met = target > 0 && done >= target;

  return (
    <div className={cn("mt-3", className)}>
      <div
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={target > 0 ? target : Math.max(done, 1)}
        className="relative h-2 w-full border border-line-200 bg-paper-100"
      >
        <div
          className={cn(
            "h-full transition-[width] duration-500 ease-out",
            met ? "bg-ink-950" : "bg-ink-700",
          )}
          style={{ width: `${pct}%` }}
        />
        {target > 0 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 right-0 h-3 w-px bg-ink-950"
            title={`Target ${target}`}
          />
        ) : null}
      </div>
      <p className="mt-1.5 font-mono text-[11px] tabular-nums text-ink-600">{caption}</p>
    </div>
  );
}
