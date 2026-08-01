// Chamber 07 · Field stage frame.
//
// Every field stage wears the same three-part frame: a masthead that says what
// this stage decides, the work surface itself, and a sticky decision bar that
// always carries the action that matters — the one that clears the blocker when
// the stage is incomplete, the one that advances when it is done. Navigation is
// guarded: unsaved work is never dropped silently.

import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDashed,
  Loader2,
  Wrench,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Explain } from "@/components/explain/Explain";
import "@/lib/explain/personas-entries";
import {
  FIELD_STAGE_SPECS,
  FIELD_STAGES,
  nextFieldStage,
  prevFieldStage,
  type FieldProgress,
  type FieldStageKey,
} from "@/lib/personas/field-stages";
import { cn, scrollToTop } from "@/lib/utils";
import { useFieldStageBus } from "./stage-bus";

const STEP_ROUTE = "/admin/countries/$code/personas/field/$step" as const;
const DOOR_ROUTE = "/admin/countries/$code/personas" as const;

export function StageFrame({
  code,
  projectId,
  stage,
  progress,
  progressPending,
  progressError,
  onRetryProgress,
  children,
}: {
  code: string;
  projectId: string;
  stage: FieldStageKey;
  progress: FieldProgress | undefined;
  progressPending?: boolean;
  progressError?: string | null;
  onRetryProgress?: () => void;
  children: React.ReactNode;
}) {
  const spec = FIELD_STAGE_SPECS[stage];
  const state = progress?.stages[stage];
  const complete = !!state?.complete;
  const next = nextFieldStage(stage);
  const prev = prevFieldStage(stage);
  const position = FIELD_STAGES.indexOf(stage) + 1;
  const navigate = useNavigate();

  // The gate lives above this frame (see FieldStageProvider), so the rail is
  // guarded too — this frame just reads what stages published.
  const { dirtyEntries, resolveAction, guardedGo } = useFieldStageBus();
  const hasDirty = dirtyEntries.length > 0;

  const go = useCallback(
    (target: FieldStageKey) => {
      guardedGo(() => {
        scrollToTop();
        if (target === "brief") {
          void navigate({ to: DOOR_ROUTE, params: { code }, search: { project: projectId } });
        } else {
          void navigate({
            to: STEP_ROUTE,
            params: { code, step: target },
            search: { project: projectId },
          });
        }
      });
    },
    [code, guardedGo, navigate, projectId],
  );

  const [amendOpen, setAmendOpen] = useState(false);
  const earlier = FIELD_STAGES.slice(0, FIELD_STAGES.indexOf(stage));

  return (
    <>
      <section className="space-y-5 pb-28">
        <header className="border-b border-line-200 pb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Stage {String(spec.n).padStart(2, "0")} · {spec.sub}
          </p>
          <h2 className="mt-1 font-serif text-2xl text-ink-950">{spec.label}</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-700">{spec.decides}</p>

          <div
            className={cn(
              "mt-3 flex max-w-2xl items-start gap-2 border p-3",
              complete
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-line-200 bg-paper-100/40",
            )}
          >
            {complete ? (
              <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3} />
            ) : (
              <CircleDashed size={14} className="mt-0.5 shrink-0 text-ink-500" />
            )}
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                <Explain id="research.stage.done" mark={false}>
                  Done when
                </Explain>
                {progressPending ? <span className="ml-2 normal-case">checking…</span> : null}
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-800">{spec.doneWhen}</p>
              {!complete && state?.blocker ? (
                <p className="mt-1 text-[12px] text-ink-600">Outstanding · {state.blocker}</p>
              ) : null}
              {progressError ? (
                <p className="mt-1 text-[12px] text-rose-600">
                  Could not read the programme's state.{" "}
                  <button type="button" className="underline" onClick={onRetryProgress}>
                    Try again
                  </button>
                </p>
              ) : null}
            </div>
          </div>
        </header>

        {children}

        {/* Sticky decision bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-200 bg-paper-0/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper-0/85">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* BACK — always the same shape, same place, on every stage. */}
              <button
                type="button"
                className="btn-secondary"
                disabled={!prev}
                onClick={() => prev && go(prev)}
                title={prev ? `Back to ${FIELD_STAGE_SPECS[prev].label}` : "First stage"}
              >
                <ArrowLeft size={12} /> Back
                {prev ? (
                  <span className="hidden text-ink-500 sm:inline">
                    · {FIELD_STAGE_SPECS[prev].label}
                  </span>
                ) : null}
              </button>

              {earlier.length > 0 ? (
                <div className="relative">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setAmendOpen((v) => !v)}
                    aria-expanded={amendOpen}
                  >
                    Amend <ChevronDown size={12} />
                  </button>
                  {amendOpen ? (
                    <div className="absolute bottom-full left-0 z-40 mb-2 w-60 border border-line-200 bg-paper-0 p-1 shadow-lg">
                      {earlier.map((k) => (
                        <button
                          key={k}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[13px] text-ink-800 hover:bg-paper-100"
                          onClick={() => {
                            setAmendOpen(false);
                            go(k);
                          }}
                        >
                          {k === "brief"
                            ? "Return to the brief"
                            : k === "plan"
                              ? "Revise the plan"
                              : `Back to ${FIELD_STAGE_SPECS[k].label}`}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                {position} of {FIELD_STAGES.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {hasDirty ? (
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-amber-700 sm:block">
                  Saves as you continue · {dirtyEntries.map((d) => d.label).join(", ")}
                </span>
              ) : null}

              {!complete && resolveAction ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={resolveAction.pending}
                  onClick={resolveAction.run}
                >
                  {resolveAction.pending ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Wrench size={12} />
                  )}
                  {resolveAction.label}
                </button>
              ) : null}

              {/* CONTINUE — always present, always right-most, always the same shape. */}
              {next ? (
                <button
                  type="button"
                  className={complete ? "btn-primary" : "btn-secondary"}
                  onClick={() => go(next)}
                  title={
                    complete
                      ? spec.advance
                      : `${FIELD_STAGE_SPECS[stage].label} is still outstanding — you can continue and come back.`
                  }
                >
                  Continue
                  <span className="hidden sm:inline">· {FIELD_STAGE_SPECS[next].label}</span>
                  <ArrowRight size={12} />
                </button>
              ) : (
                <Link
                  to={DOOR_ROUTE}
                  params={{ code }}
                  search={{ project: projectId }}
                  className={complete ? "btn-primary" : "btn-secondary"}
                  onClick={(e) => {
                    if (hasDirty) {
                      e.preventDefault();
                      go("brief");
                    }
                  }}
                >
                  Finish <span className="hidden sm:inline">· back to the chamber</span>
                  <ArrowRight size={12} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** An empty state that names the one action which fills it. */
export function EmptyAction({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-line-200 bg-paper-100/30 p-6">
      <p className="font-serif text-lg text-ink-950">{title}</p>
      <p className="mt-1 max-w-xl text-sm text-ink-700">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
