// Mobile-first stepper. Mobile: "Step n of N · label" + dot row. Desktop: full labelled row.
import { Check } from "lucide-react";

export function WizardStepper({
  labels,
  current,
}: {
  labels: string[];
  current: number; // 1-indexed
}) {
  const total = labels.length;
  const currentLabel = labels[current - 1] ?? "";

  return (
    <div className="mb-8 sm:mb-10">
      {/* Mobile — compact */}
      <div className="sm:hidden">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
          Step {current} of {total} · <span className="text-ink-950">{currentLabel}</span>
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          {labels.map((_, i) => {
            const n = i + 1;
            const active = n === current;
            const done = n < current;
            return (
              <span
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  done ? "bg-gold-500" : active ? "bg-ink-950" : "bg-line-200"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Desktop — full labels */}
      <ol className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500 sm:flex">
        {labels.map((label, i) => {
          const n = i + 1;
          const active = n === current;
          const done = n < current;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border ${
                  active
                    ? "border-ink-950 bg-ink-950 text-paper-50"
                    : done
                      ? "border-gold-500 bg-gold-500 text-paper-50"
                      : "border-line-200 text-ink-500"
                }`}
              >
                {done ? <Check size={12} /> : n}
              </span>
              <span className={active ? "text-ink-950" : ""}>{label}</span>
              {n < total && <span className="mx-2 h-px w-6 bg-line-200" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
