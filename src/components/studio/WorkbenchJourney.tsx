import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type JourneyStepKey = "read" | "reshape" | "stage" | "commit";

export type JourneyStep = {
  key: JourneyStepKey;
  title: string;
  caption: string;
  done: boolean;
  anchor: string;
};

export function WorkbenchJourney({
  steps,
  active,
}: {
  steps: JourneyStep[];
  active: JourneyStepKey;
}) {
  return (
    <nav
      aria-label="Workbench journey"
      className="sticky top-0 z-20 -mx-6 border-b border-line-200 bg-paper-0/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper-0/80"
    >
      <ol className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {steps.map((s, i) => {
          const isActive = s.key === active;
          return (
            <li key={s.key}>
              <a
                href={`#${s.anchor}`}
                className={cn(
                  "group flex items-start gap-3 border-l-2 py-1 pl-3 transition-colors",
                  isActive
                    ? "border-ink-950"
                    : s.done
                      ? "border-emerald-500/60"
                      : "border-line-200 hover:border-ink-500",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-[11px] tabular-nums",
                    s.done
                      ? "border-emerald-500 bg-emerald-500 text-paper-0"
                      : isActive
                        ? "border-ink-950 bg-ink-950 text-paper-0"
                        : "border-line-200 text-ink-500",
                  )}
                >
                  {s.done ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block font-mono text-[10px] uppercase tracking-[0.2em]",
                      isActive ? "text-ink-950" : "text-ink-500",
                    )}
                  >
                    {s.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-ink-700">
                    {s.caption}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
