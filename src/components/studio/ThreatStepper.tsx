import { cn } from "@/lib/utils";
import { ExplainHover } from "./ExplainHover";
import { EXPLAIN } from "./explain-copy";

const STEPS = [
  { n: 1, label: "Name the threat", key: "threat", copyKey: "step_compose" },
  { n: 2, label: "Rebuild strategy", key: "strategy", copyKey: "step_strategy" },
  { n: 3, label: "Stress-test & commit", key: "stress", copyKey: "step_stress" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export function ThreatStepper({
  active,
  onSelect,
  disabled,
}: {
  active: StepKey;
  onSelect?: (k: StepKey) => void;
  disabled?: Partial<Record<StepKey, boolean>>;
}) {
  return (
    <ol className="flex items-center gap-0 border-y border-line-200">
      {STEPS.map((s, i) => {
        const isActive = s.key === active;
        const isDisabled = disabled?.[s.key];
        return (
          <li key={s.key} className={cn("flex-1", i > 0 && "border-l border-line-200")}>
        return (
          <li key={s.key} className={cn("flex-1", i > 0 && "border-l border-line-200")}>
            <ExplainHover copy={EXPLAIN[s.copyKey]} side="bottom">
              <button
                type="button"
                onClick={() => !isDisabled && onSelect?.(s.key)}
                disabled={isDisabled}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                  isActive ? "bg-paper-100" : "hover:bg-paper-100",
                  isDisabled && "cursor-not-allowed opacity-40",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center border font-mono text-[11px]",
                    isActive ? "border-ink-950 bg-ink-950 text-paper-0" : "border-line-200 text-ink-500",
                  )}
                >
                  {s.n}
                </span>
                <span className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    Act {s.n}
                  </p>
                  <p className={cn("text-sm", isActive ? "text-ink-950" : "text-ink-700")}>
                    {s.label}
                  </p>
                </span>
              </button>
            </ExplainHover>
          </li>
        );
      })}
    </ol>
  );
}
