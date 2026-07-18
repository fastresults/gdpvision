import { Check } from "lucide-react";

export interface Step {
  id: number;
  label: string;
  hint: string;
}

export function StepProgress({
  steps,
  current,
  furthest,
  onJump,
}: {
  steps: Step[];
  current: number;
  furthest: number;
  onJump: (n: number) => void;
}) {
  return (
    <ol className="flex flex-col gap-1">
      {steps.map((s) => {
        const done = s.id < furthest;
        const active = s.id === current;
        const reachable = s.id <= furthest;
        return (
          <li key={s.id}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onJump(s.id)}
              className={
                "group flex w-full items-start gap-3 rounded-none border-l-2 px-3 py-2.5 text-left transition " +
                (active
                  ? "border-ink-950 bg-paper-100"
                  : reachable
                    ? "border-line-200 hover:border-ink-500 hover:bg-paper-100/60"
                    : "cursor-not-allowed border-line-200 opacity-50")
              }
              aria-current={active ? "step" : undefined}
            >
              <span
                className={
                  "mt-0.5 grid h-6 w-6 shrink-0 place-items-center border font-mono text-[10px] tabular-nums " +
                  (done
                    ? "border-ink-950 bg-ink-950 text-paper-0"
                    : active
                      ? "border-ink-950 text-ink-950"
                      : "border-line-200 text-ink-500")
                }
              >
                {done ? <Check size={12} strokeWidth={2.5} /> : s.id}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={
                    "block font-mono text-[10px] uppercase tracking-[0.22em] " +
                    (active ? "text-ink-950" : "text-ink-500")
                  }
                >
                  Step {s.id}
                </span>
                <span
                  className={
                    "mt-0.5 block truncate font-serif text-sm " +
                    (active ? "text-ink-950" : "text-ink-700")
                  }
                >
                  {s.label}
                </span>
                <span className="mt-0.5 block truncate text-[11px] leading-snug text-ink-500">
                  {s.hint}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
