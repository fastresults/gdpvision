// Chamber 07 · Field stage frame.
//
// The frame owns three things and nothing else: the one breadcrumb sentence
// that says where you are, the one guidance/"done when" test for the stage, and
// the ONE footer. The footer grammar never changes — Back on the left, a quiet
// "do this for me" in the middle, a single primary on the right that names the
// outcome and says what it will do. Moving inside a stage and moving between
// stages both pass through the same unsaved-work gate.

import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, CircleDashed, Loader2, Wrench } from "lucide-react";
import { useCallback, useMemo } from "react";

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
import {
  firstOpenSubStep,
  programmeProgress,
  subStepsFor,
  type FieldSubStep,
} from "@/lib/personas/field-substeps";
import { cn, scrollToTop } from "@/lib/utils";
import { useFieldStageBus } from "./stage-bus";
import { SubStepProvider } from "./substep-context";

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
  const search = useSearch({ strict: false }) as { project?: string; sub?: string };

  // The gate lives above this frame (see FieldStageProvider), so the rail is
  // guarded too — this frame just reads what stages published.
  const { dirtyEntries, resolveAction, guardedGo } = useFieldStageBus();
  const hasDirty = dirtyEntries.length > 0;

  // ── Where you are inside the stage ──────────────────────────────────────
  const steps = useMemo(() => subStepsFor(stage), [stage]);
  const isDone = useCallback((s: FieldSubStep) => s.isDone(progress), [progress]);
  const fallbackKey = firstOpenSubStep(stage, progress);
  const requestedIndex = steps.findIndex((s) => s.key === search.sub);
  const firstOpenIndex = steps.findIndex((s) => !isDone(s));
  const requestedAllowed =
    requestedIndex >= 0 &&
    (isDone(steps[requestedIndex] as FieldSubStep) ||
      firstOpenIndex === -1 ||
      requestedIndex <= firstOpenIndex);
  const currentKey =
    (requestedAllowed ? steps[requestedIndex]?.key : null) ?? fallbackKey ?? steps[0]?.key ?? null;
  const index = Math.max(
    0,
    steps.findIndex((s) => s.key === currentKey),
  );
  const current = steps[index] ?? null;
  const currentDone = current ? isDone(current) : false;
  const overall = programmeProgress(progress);

  const goStage = useCallback(
    (target: FieldStageKey) => {
      guardedGo(() => {
        scrollToTop();
        void navigate({
          to: STEP_ROUTE,
          params: { code, step: target },
          search: { project: projectId } as never,
        });
      });
    },
    [code, guardedGo, navigate, projectId],
  );

  const goSub = useCallback(
    (key: string) => {
      guardedGo(() => {
        scrollToTop();
        void navigate({
          to: STEP_ROUTE,
          params: { code, step: stage },
          search: { project: projectId, sub: key } as never,
          replace: true,
        });
      });
    },
    [code, guardedGo, navigate, projectId, stage],
  );

  const goDoor = useCallback(() => {
    guardedGo(() => {
      scrollToTop();
      void navigate({
        to: DOOR_ROUTE,
        params: { code },
        search: { project: projectId },
      });
    });
  }, [code, guardedGo, navigate, projectId]);

  const nav = useMemo(
    () => ({ stage, steps, index, current, goTo: goSub, isDone }),
    [stage, steps, index, current, goSub, isDone],
  );

  const atFirstSub = index <= 0;
  const atLastSub = index >= steps.length - 1;

  // A screen may already satisfy its persisted completion predicate while
  // holding a newer local decision (for example, edited instrument wording).
  // That published action must win until it is saved; otherwise the footer
  // incorrectly offers Continue and silently skips the user's work.
  const needsAction = !!resolveAction;
  const primaryLabel = needsAction
    ? resolveAction.label
    : !currentDone
      ? "Complete this step to continue"
      : atLastSub
        ? next
          ? spec.advance
          : "Finish · back to the chamber"
        : (current?.primaryLabel ?? "Continue");
  const primaryConsequence = needsAction
    ? (current?.consequence ?? "Complete this decision before the programme moves on.")
    : !currentDone
      ? "The next decision unlocks when the outstanding work above is complete."
      : atLastSub
        ? next
          ? `This moves the programme on to ${FIELD_STAGE_SPECS[next].label.toLowerCase()}.`
          : "This returns you to the chamber."
        : (current?.consequence ?? "");

  const onPrimary = () => {
    if (needsAction) {
      resolveAction.run();
      return;
    }
    if (!atLastSub) {
      const nk = steps[index + 1]?.key;
      if (nk) goSub(nk);
      return;
    }
    if (next) goStage(next);
    else goDoor();
  };

  return (
    <SubStepProvider value={nav}>
      <section className="space-y-5">
        <header className="border-b border-line-200 pb-4">
          {/* ONE breadcrumb sentence — always here, never more than this line. */}
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Stage {String(spec.n).padStart(2, "0")} {spec.label}
            {current ? (
              <>
                {" · "}Step {index + 1} of {steps.length}
                <span className="normal-case tracking-normal text-ink-700"> — {current.label}</span>
              </>
            ) : null}
          </p>
          {overall.total > 0 ? (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 tabular-nums">
              {overall.done} of {overall.total} steps complete
            </p>
          ) : null}

          <p className="mt-2 max-w-2xl text-sm text-ink-700">{spec.decides}</p>


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

        {/* THE footer — inside this phase, so Back/Next belong to it. */}
        <div className="sticky bottom-0 z-20 border-t border-line-200 bg-paper-0/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper-0/85">
          <div className="flex flex-wrap items-center justify-between gap-3">

            <div className="flex items-center gap-2">
              {/* BACK — one step at a time: within the stage, then out of it. */}
              <button
                type="button"
                className="btn-secondary"
                disabled={atFirstSub && !prev}
                onClick={() => {
                  if (!atFirstSub) {
                    const pk = steps[index - 1]?.key;
                    if (pk) goSub(pk);
                    return;
                  }
                  if (prev) goStage(prev);
                }}
                title={
                  !atFirstSub
                    ? `Back to ${steps[index - 1]?.label}`
                    : prev
                      ? `Back to ${FIELD_STAGE_SPECS[prev].label}`
                      : "First step of the programme"
                }
              >
                <ArrowLeft size={12} /> Back
                <span className="hidden max-w-[14rem] truncate text-ink-500 sm:inline">
                  ·{" "}
                  {!atFirstSub
                    ? steps[index - 1]?.label
                    : prev
                      ? FIELD_STAGE_SPECS[prev].label
                      : ""}
                </span>
              </button>

              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 tabular-nums">
                Stage {position} of {FIELD_STAGES.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {hasDirty ? (
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-amber-700 sm:block">
                  Saves as you continue · {dirtyEntries.map((d) => d.label).join(", ")}
                </span>
              ) : null}

              {/* THE primary — far right, names the outcome, says what it does. */}
              <div className="text-right">
                {atLastSub && !next ? (
                  <Link
                    to={DOOR_ROUTE}
                    params={{ code }}
                    search={{ project: projectId }}
                    className={complete ? "btn-primary" : "btn-secondary"}
                    onClick={(e) => {
                      if (hasDirty) {
                        e.preventDefault();
                        goDoor();
                      }
                    }}
                  >
                    {primaryLabel} <ArrowRight size={12} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={currentDone || needsAction ? "btn-primary" : "btn-secondary"}
                    disabled={
                      needsAction ? resolveAction.pending || resolveAction.disabled : !currentDone
                    }
                    onClick={onPrimary}
                  >
                    {resolveAction?.pending && needsAction ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : needsAction ? (
                      <Wrench size={12} />
                    ) : null}
                    <span className="max-w-[18rem] truncate">{primaryLabel}</span>
                    <ArrowRight size={12} />
                  </button>
                )}
                {primaryConsequence ? (
                  <p className="mt-1 hidden max-w-xs text-[11px] leading-tight text-ink-500 md:block">
                    {primaryConsequence}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </SubStepProvider>
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
