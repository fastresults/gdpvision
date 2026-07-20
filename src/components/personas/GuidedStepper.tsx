import { Check } from "lucide-react";

export type StepState = "complete" | "active" | "locked" | "available";

export type GuidedStep = {
  n: number;
  label: string;
  hint?: string;
  state: StepState;
};

export function GuidedStepper({ steps }: { steps: GuidedStep[] }) {
  return (
    <ol className="flex flex-col gap-0">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const dot =
          s.state === "complete"
            ? "border-ink-950 bg-ink-950 text-paper-0"
            : s.state === "active"
              ? "border-ink-950 bg-paper-0 text-ink-950"
              : s.state === "locked"
                ? "border-line-200 bg-paper-0 text-ink-400"
                : "border-line-200 bg-paper-0 text-ink-700";
        const label =
          s.state === "locked" ? "text-ink-400" : s.state === "active" ? "text-ink-950" : "text-ink-700";
        return (
          <li key={s.n} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={`absolute left-[13px] top-7 bottom-0 w-px ${
                  s.state === "complete" ? "bg-ink-950" : "bg-line-200"
                }`}
              />
            )}
            <span
              className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-[11px] ${dot}`}
            >
              {s.state === "complete" ? <Check size={13} strokeWidth={2.5} /> : s.n.toString().padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={`font-serif text-[15px] leading-tight ${label}`}>{s.label}</p>
              {s.hint && <p className="mt-0.5 text-[11px] leading-snug text-ink-500">{s.hint}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
