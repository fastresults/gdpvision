import { Explain } from "@/components/explain/Explain";
import type { ReadinessCheck } from "@/lib/investments/readiness";
import { cn } from "@/lib/utils";

import { ReadinessRule } from "./ui";

const SECTION_LABEL: Record<ReadinessCheck["section"], string> = {
  profile: "Profile",
  commercial: "Commercial",
  impact: "Impact",
  preparation: "Preparation",
  compliance: "Compliance",
};

export function ReadinessList({
  checks,
  onFix,
}: {
  checks: ReadinessCheck[];
  /** Jump to the section that fixes a check. */
  onFix: (section: ReadinessCheck["section"]) => void;
}) {
  const passed = checks.filter((c) => c.ok).length;
  return (
    <div>
      <div className="mb-4 flex items-end gap-4">
        <Explain id="investments.readiness" ctx={{ checks }}>
          <ReadinessRule score={passed} total={checks.length} className="min-w-[6rem]" />
        </Explain>
        <p className="text-sm text-ink-700">
          {passed === checks.length
            ? "Every check passes. The project can be submitted for approval."
            : `${checks.length - passed} ${checks.length - passed === 1 ? "check needs" : "checks need"} attention before the project can be submitted.`}
        </p>
      </div>
      <ol className="divide-y divide-line-100 border-y border-line-200">
        {checks.map((c, i) => (
          <li
            key={c.key}
            className={cn(
              "grid gap-1 border-l-2 py-3 pl-3 pr-2 sm:grid-cols-[1.5rem_1fr_auto] sm:gap-3",
              c.ok ? "border-l-signal-positive" : "border-l-signal-negative",
            )}
          >
            <span className="font-mono text-[10px] text-ink-400 tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm text-ink-950">{c.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
                  {c.standard}
                </span>
              </div>
              {!c.ok && <p className="mt-0.5 text-xs text-ink-700">{c.fix}</p>}
            </div>
            <div className="flex items-center gap-3 sm:justify-end">
              <span
                className={cn("text-xs", c.ok ? "text-signal-positive" : "text-signal-negative")}
              >
                {c.ok ? "Passes" : "Not yet"}
              </span>
              {!c.ok && (
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs"
                  onClick={() => onFix(c.section)}
                >
                  Go to {SECTION_LABEL[c.section]}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
