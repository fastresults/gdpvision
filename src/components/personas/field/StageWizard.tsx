// Chamber 07 · The level-2 wizard.
//
// Inside every field stage: one decision per screen. This renders the chip rail
// of sub-steps, the fixed guidance card ("why / what good looks like"), and the
// active screen — nothing else. Navigation and the primary button live in the
// single footer owned by StageFrame, so no screen ever offers two ways forward.

import { Check, HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSubSteps } from "./substep-context";

export function StageWizard({
  panels,
}: {
  /** One screen per sub-step key. Only the current one is mounted. */
  panels: Record<string, React.ReactNode>;
}) {
  const nav = useSubSteps();
  if (!nav || !nav.current) return <>{Object.values(panels)[0] ?? null}</>;

  const { steps, current, index, goTo, isDone } = nav;

  return (
    <div className="space-y-5">
      {/* Sub-step chips — the only navigation inside a stage. */}
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Steps in this stage">
        {steps.map((s, i) => {
          const active = s.key === current.key;
          const done = isDone(s);
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => !active && goTo(s.key)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 border px-2.5 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
                  active
                    ? "border-ink-950 bg-ink-950 text-paper-0"
                    : done
                      ? "border-emerald-500/50 text-emerald-700 hover:border-ink-950"
                      : "border-line-200 text-ink-500 hover:border-ink-500 hover:text-ink-800",
                )}
              >
                <span className="tabular-nums">
                  {done && !active ? <Check size={11} strokeWidth={3} /> : i + 1}
                </span>
                <span className="max-w-[16rem] truncate normal-case tracking-normal">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Guidance — same words, same place, every screen. */}
      <div className="border-l-2 border-ink-950 bg-paper-100/40 p-4">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          <HelpCircle size={12} /> Step {index + 1} of {steps.length}
        </p>
        <h3 className="mt-1 font-serif text-xl leading-tight text-ink-950">{current.label}</h3>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-700">{current.why}</p>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ink-600">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            What good looks like ·{" "}
          </span>
          {current.goodLooksLike}
        </p>
      </div>

      {panels[current.key] ?? (
        <p className="border border-dashed border-line-200 p-6 text-sm text-ink-500">
          Nothing to do on this screen.
        </p>
      )}
    </div>
  );
}

/**
 * The quiet drawer for everything that is not the decision on this screen —
 * raw tables, debug detail, manual fallbacks. Closed on arrival, by design.
 */
export function ShowTheDetail({
  label = "Show the detail",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="border border-line-200 bg-paper-0">
      <summary className="cursor-pointer px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
        {label}
      </summary>
      <div className="space-y-5 border-t border-line-200 p-4">{children}</div>
    </details>
  );
}
