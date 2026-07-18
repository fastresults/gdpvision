import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type NarrativeStepKey = "monitor" | "triage" | "position" | "publish";

export type NarrativeStep = {
  key: NarrativeStepKey;
  title: string;
  caption: string;
  done: boolean;
};

export function NarrativeJourney({
  steps,
  active,
}: {
  steps: NarrativeStep[];
  active: NarrativeStepKey;
}) {
  return (
    <nav
      aria-label="Narrative journey"
      className="sticky top-0 z-20 -mx-6 border-b border-line-200 bg-paper-0/95 px-6 py-3 backdrop-blur"
    >
      <ol className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {steps.map((s, i) => {
          const isActive = s.key === active;
          return (
            <li key={s.key}>
              <div
                className={cn(
                  "flex items-start gap-3 border-l-2 py-1 pl-3 transition-colors",
                  isActive
                    ? "border-ink-950"
                    : s.done
                      ? "border-emerald-500/60"
                      : "border-line-200",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 flex-none place-items-center rounded-full font-mono text-[10px]",
                    isActive
                      ? "bg-ink-950 text-paper-0"
                      : s.done
                        ? "bg-emerald-500/15 text-emerald-800"
                        : "bg-paper-100 text-ink-500",
                  )}
                >
                  {s.done ? <Check size={11} strokeWidth={2.5} /> : i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-tight text-ink-700">
                    {s.caption}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
