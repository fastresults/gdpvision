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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { FieldStageBus, type DirtyEntry, type ResolveAction } from "./stage-bus";

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

  // ---- the bus: stages publish unsaved work and their resolve action --------
  const [dirtyMap, setDirtyMap] = useState<Record<string, DirtyEntry>>({});
  const [resolveMap, setResolveMap] = useState<Record<string, ResolveAction>>({});
  const dirtyRef = useRef(dirtyMap);
  dirtyRef.current = dirtyMap;

  const setDirty = useCallback((id: string, entry: DirtyEntry | null) => {
    setDirtyMap((prev) => {
      if (!entry) {
        if (!(id in prev)) return prev;
        const nextMap = { ...prev };
        delete nextMap[id];
        return nextMap;
      }
      return { ...prev, [id]: entry };
    });
  }, []);

  const setResolve = useCallback((id: string, action: ResolveAction | null) => {
    setResolveMap((prev) => {
      if (!action) {
        if (!(id in prev)) return prev;
        const nextMap = { ...prev };
        delete nextMap[id];
        return nextMap;
      }
      return { ...prev, [id]: action };
    });
  }, []);

  const bus = useMemo(() => ({ setDirty, setResolve }), [setDirty, setResolve]);

  const dirtyEntries = Object.values(dirtyMap);
  const hasDirty = dirtyEntries.length > 0;
  const resolveAction = Object.values(resolveMap)[0] ?? null;

  // ---- navigation guard ----------------------------------------------------
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);
  const [savingNav, setSavingNav] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);

  const go = useCallback(
    (target: FieldStageKey) => {
      const run = () => {
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
      };
      if (Object.keys(dirtyRef.current).length > 0) {
        setNavError(null);
        setPendingNav(() => run);
        return;
      }
      run();
    },
    [code, navigate, projectId],
  );

  useEffect(() => {
    if (!hasDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDirty]);

  const saveAllAndGo = async () => {
    setSavingNav(true);
    setNavError(null);
    try {
      for (const entry of Object.values(dirtyRef.current)) await entry.save();
      const run = pendingNav;
      setPendingNav(null);
      run?.();
    } catch (err) {
      setNavError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSavingNav(false);
    }
  };

  const [amendOpen, setAmendOpen] = useState(false);
  const earlier = FIELD_STAGES.slice(0, FIELD_STAGES.indexOf(stage));

  return (
    <FieldStageBus.Provider value={bus}>
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
              {prev ? (
                <button type="button" className="btn-ghost" onClick={() => go(prev)}>
                  <ArrowLeft size={12} /> {FIELD_STAGE_SPECS[prev].label}
                </button>
              ) : null}

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
                  Unsaved · {dirtyEntries.map((d) => d.label).join(", ")}
                </span>
              ) : null}

              {!complete && resolveAction ? (
                <button
                  type="button"
                  className="btn-primary"
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

              {next ? (
                complete ? (
                  <button type="button" className="btn-primary" onClick={() => go(next)}>
                    {spec.advance} <ArrowRight size={12} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-[12px] text-ink-600 underline underline-offset-4 hover:text-ink-950"
                    onClick={() => go(next)}
                  >
                    Skip ahead to {FIELD_STAGE_SPECS[next].label}
                  </button>
                )
              ) : (
                <Link
                  to={DOOR_ROUTE}
                  params={{ code }}
                  search={{ project: projectId }}
                  className="btn-primary"
                  onClick={(e) => {
                    if (hasDirty) {
                      e.preventDefault();
                      go("brief");
                    }
                  }}
                >
                  {spec.advance} <ArrowRight size={12} />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Unsaved-work confirm */}
        {pendingNav ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
            <div className="w-full max-w-md border border-line-200 bg-paper-0 p-5">
              <p className="font-serif text-lg text-ink-950">You have unsaved work.</p>
              <p className="mt-1 text-[13px] text-ink-700">
                Unsaved · {dirtyEntries.map((d) => d.label).join(", ")}. Save it before moving, or
                leave it behind.
              </p>
              {navError ? <p className="mt-2 text-[12px] text-rose-600">{navError}</p> : null}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={savingNav}
                  onClick={() => setPendingNav(null)}
                >
                  Stay here
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={savingNav}
                  onClick={() => {
                    const run = pendingNav;
                    setPendingNav(null);
                    setDirtyMap({});
                    run?.();
                  }}
                >
                  Discard and continue
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={savingNav}
                  onClick={() => void saveAllAndGo()}
                >
                  {savingNav ? <Loader2 size={11} className="animate-spin" /> : null}
                  Save and continue
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </FieldStageBus.Provider>
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
