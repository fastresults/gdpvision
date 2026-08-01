// Chamber 07 · The level-2 wizard.
//
// Inside every field stage: one decision per screen. This renders the chip rail
// of sub-steps, the fixed guidance card ("why / what good looks like"), and the
// active screen — nothing else. Navigation and the primary button live in the
// single footer owned by StageFrame, so no screen ever offers two ways forward.

import { Check, HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { ScreenAction, type ScreenActionSpec } from "./kit/ScreenAction";
import { useResolveAction } from "./stage-bus";
import { useSubSteps } from "./substep-context";

export type { ScreenActionSpec };

export function StageWizard({
  panels,
  actions,
}: {
  /** One screen per sub-step key. Only the current one is mounted. */
  panels: Record<string, React.ReactNode>;
  /** The one instruction, state and action for each screen. */
  actions?: Record<string, ScreenActionSpec | null | undefined>;
}) {
  const nav = useSubSteps();
  const current = nav?.current ?? null;
  const action = current ? (actions?.[current.key] ?? null) : null;
  const firstOpenIndex = steps.findIndex((step) => !isDone(step));
  const lastReachableIndex = firstOpenIndex === -1 ? steps.length - 1 : firstOpenIndex;

  // The fixed StageFrame footer owns the only primary action. Stage content
  // publishes the active screen's operation here rather than rendering a
  // second competing button in the body.
  useResolveAction(
    "active-wizard-screen",
    action?.action
      ? {
          label: action.action.label,
          run: action.action.onClick,
          pending: action.action.pending,
          disabled: action.action.disabled,
        }
      : null,
  );

  if (!nav || !current) return <>{Object.values(panels)[0] ?? null}</>;

  const { steps, index, goTo, isDone } = nav;
  const firstOpenIndex = steps.findIndex((step) => !isDone(step));
  const lastReachableIndex = firstOpenIndex === -1 ? steps.length - 1 : firstOpenIndex;


  return (
    <div className="space-y-5">
      {/* A compact progress list, not another tab bar. Completed work can be
          reopened; future decisions stay locked until the first open one is done. */}
      <ol className="grid gap-2 border-y border-line-200 py-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Steps in this stage">
        {steps.map((s, i) => {
          const active = s.key === current.key;
          const done = isDone(s);
          const reachable = i <= lastReachableIndex || done;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => !active && reachable && goTo(s.key)}
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full items-start gap-2 border-l-2 px-3 py-2 text-left transition-colors",
                  active
                    ? "border-ink-950 bg-paper-100/60 text-ink-950"
                    : done
                      ? "border-emerald-500/50 text-emerald-700 hover:border-ink-950"
                      : reachable
                        ? "border-line-200 text-ink-600 hover:border-ink-500 hover:text-ink-800"
                        : "cursor-not-allowed border-line-100 text-ink-300",
                )}
              >
                <span className="mt-0.5 font-mono text-[10px] tabular-nums">
                  {done && !active ? <Check size={11} strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] leading-snug">{s.label}</span>
                  <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                    {done ? "Complete" : active ? "Now" : reachable ? "Ready" : "Locked"}
                  </span>
                </span>
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

      {/* Status and instruction only. The footer owns the action. */}
      {action ? <ScreenAction spec={action} done={isDone(current)} /> : null}


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
