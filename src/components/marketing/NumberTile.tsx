import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Grade = "A" | "B" | "C" | "D";

interface NumberTileProps {
  value: number;
  /** Rendered exactly as given after the numeral. */
  unit?: string;
  /** Optional prefix, e.g. "US$". */
  prefix?: string;
  label: string;
  /** Data confidence grade per PRD FR-NL-04. */
  grade: Grade;
  citation?: string;
  /** Digits after decimal for the count-up. */
  decimals?: number;
  className?: string;
}

// Large Fraunces numeral over small IBM Plex Mono metadata — the product's
// typographic signature (PRD §10.4). Counts up on first in-view.
export function NumberTile({
  value,
  unit,
  prefix,
  label,
  grade,
  citation,
  decimals = 0,
  className,
}: NumberTileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            countUp(value, decimals, setDisplay);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, decimals]);

  return (
    <div ref={ref} className={cn("flex flex-col gap-3", className)} data-numeric>
      <div className="flex items-baseline gap-2 leading-none">
        {prefix ? (
          <span className="font-mono text-sm text-ink-500 self-start pt-3">{prefix}</span>
        ) : null}
        <span className="font-serif text-[54px] md:text-[68px] tracking-tight text-ink-950 leading-none">
          {formatNumber(display, decimals)}
        </span>
        {unit ? (
          <span className="font-mono text-sm text-ink-500 self-end pb-2">{unit}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">
        <GradeBadge grade={grade} />
        <span>{label}</span>
      </div>
      {citation ? (
        <p className="font-mono text-[11px] leading-relaxed text-ink-500">
          {citation}
        </p>
      ) : null}
    </div>
  );
}

function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center border border-line-200 px-1.5 text-[10px] font-medium text-ink-700"
      aria-label={`Data confidence grade ${grade}`}
      title={`Data confidence grade ${grade}`}
    >
      {grade}
    </span>
  );
}

function formatNumber(n: number, decimals: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function countUp(target: number, decimals: number, set: (n: number) => void) {
  const start = performance.now();
  const duration = 900;
  const from = 0;
  const step = (t: number) => {
    const p = Math.min(1, (t - start) / duration);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - p, 3);
    const v = from + (target - from) * eased;
    set(Number(v.toFixed(decimals)));
    if (p < 1) requestAnimationFrame(step);
    else set(target);
  };
  requestAnimationFrame(step);
}
