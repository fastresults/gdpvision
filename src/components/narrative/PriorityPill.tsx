import { cn } from "@/lib/utils";
import { PRIORITY_META, priorityFor, type PriorityLevel } from "@/lib/narrative-priority";
import type { SignalRecommendation } from "@/lib/narrative-chamber.functions";

export function PriorityPill({
  signal,
  size = "sm",
}: {
  signal: { recommendation: SignalRecommendation | null; severity: number | null; reach: number | null };
  size?: "sm" | "md";
}) {
  const meta = priorityFor(signal);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap border font-mono uppercase tracking-[0.16em]",
        meta.pillClass,
        size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-[1px] text-[10px]",
      )}
      title={meta.caption}
    >
      {meta.label}
    </span>
  );
}

export function PriorityChip({
  level,
  count,
  active,
  onClick,
}: {
  level: PriorityLevel;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const meta = PRIORITY_META[level];
  return (
    <button
      onClick={onClick}
      className={cn(
        "border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition",
        active ? meta.pillClass : "border-line-200 bg-paper-0 text-ink-600 hover:border-ink-950",
      )}
      title={meta.caption}
    >
      P{level} · {count}
    </button>
  );
}
