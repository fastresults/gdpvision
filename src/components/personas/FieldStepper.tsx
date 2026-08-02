// Chamber 07 · Field programme stepper.
//
// The real-world rail. Mirrors StudioStepper's grammar but walks the stages a
// dated field programme actually passes through.

import { useNavigate } from "@tanstack/react-router";
import {
  Check,
  ClipboardList,
  FileText,
  Lock,
  Mic,
  Users,
  CalendarRange,
  Library,
} from "lucide-react";

import { subStepProgress } from "@/lib/personas/field-substeps";
import type { FieldProgress } from "@/lib/personas/field-stages";
import { cn, scrollToTop } from "@/lib/utils";
import { useGuardedGo } from "./field/stage-bus";


const STEP_ROUTE = "/admin/countries/$code/personas/field/$step" as const;

export type FieldStageKey =
  | "brief"
  | "plan"
  | "participants"
  | "instruments"
  | "fieldwork"
  | "evidence";

export function FieldStepper({
  code,
  active,
  activeProjectId,
  briefCommitted = false,
  planCommitted = false,
  progress,
  children,
}: {
  code: string;
  active?: FieldStageKey;
  activeProjectId: string;
  briefCommitted?: boolean;
  planCommitted?: boolean;
  /** Live per-stage completion, so the rail always tells the truth. */
  progress?: FieldProgress;
  /** The open phase's body — the stage UI itself, nested under its header. */
  children?: React.ReactNode;
}) {

  const guardedGo = useGuardedGo();
  const navigate = useNavigate();
  const done = (k: FieldStageKey) => !!progress?.stages[k]?.complete;
  const hasBrief = briefCommitted || done("brief");
  const hasPlan = planCommitted || done("plan");
  const hintFor = (k: FieldStageKey, fallback: string) =>
    done(k) ? "done" : progress?.stages[k]?.blocker ? "outstanding" : fallback;
  // Micro-counter: how many screens inside this stage are already settled.
  const counter = (k: FieldStageKey) => {
    const { done: d, total } = subStepProgress(k, progress);
    return total > 1 ? `${d}/${total}` : null;
  };

  const nodes: Array<{
    key: FieldStageKey;
    n: number;
    label: string;
    sub: string;
    hint: string;
    icon: typeof Users;
    locked?: boolean;
    complete?: boolean;
  }> = [
    {
      key: "brief",
      n: 0,
      label: "Brief",
      sub: "Intake",
      hint: briefCommitted ? "committed" : "required",
      icon: FileText,
      complete: briefCommitted,
    },
    {
      key: "plan",
      n: 1,
      label: "Programme",
      sub: "AI plan",
      hint: planCommitted ? "active" : "pending",
      icon: CalendarRange,
      locked: !hasBrief,
      complete: planCommitted,
    },
    {
      key: "participants",
      n: 2,
      label: "Participants",
      sub: "CRM",
      hint: hintFor("participants", "panels & consent"),
      icon: Users,
      locked: !hasPlan,
      complete: done("participants"),
    },
    {
      key: "instruments",
      n: 3,
      label: "Instruments",
      sub: "Fieldcraft",
      hint: hintFor("instruments", "surveys & guides"),
      icon: ClipboardList,
      locked: !hasPlan,
      complete: done("instruments"),
    },
    {
      key: "fieldwork",
      n: 4,
      label: "Fieldwork",
      sub: "Collection",
      hint: hintFor("fieldwork", "sessions & returns"),
      icon: Mic,
      locked: !hasPlan,
      complete: done("fieldwork"),
    },
    {
      key: "evidence",
      n: 5,
      label: "Evidence",
      sub: "Synthesis",
      hint: hintFor("evidence", "filed to the brain"),
      icon: Library,
      locked: !hasPlan,
      complete: done("evidence"),
    },
  ];

  const go = (s: (typeof nodes)[number]) => {
    if (s.locked || active === s.key) return;
    guardedGo(() => {
      scrollToTop();
      void navigate({
        to: STEP_ROUTE,
        params: { code, step: s.key },
        search: { project: activeProjectId } as never,
      });
    });
  };

  return (
    <div>
      <ol
        aria-label="Field programme stages"
        className="flex items-stretch gap-px overflow-x-auto border-y border-line-200 bg-line-200"
      >
        {nodes.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.key;
          return (
            <li key={s.key} className="min-w-[150px] flex-1 bg-paper-50">
              <button
                type="button"
                aria-current={isActive ? "step" : undefined}
                aria-disabled={s.locked}
                disabled={s.locked}
                onClick={() => go(s)}
                className={cn(
                  "flex h-full w-full flex-col items-start gap-2 border-t-2 px-3 py-3 text-left transition-colors",
                  s.locked ? "cursor-not-allowed opacity-40" : "cursor-pointer",
                  isActive
                    ? "border-ink-950 bg-paper-0"
                    : s.complete
                      ? "border-emerald-500/60 hover:bg-paper-100/60"
                      : "border-line-200 hover:bg-paper-100/60",
                )}
              >
                <span className="flex w-full items-center gap-2">
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-[10px] tabular-nums",
                      isActive
                        ? "border-ink-950 bg-ink-950 text-paper-0"
                        : s.complete
                          ? "border-emerald-500 bg-emerald-500 text-paper-0"
                          : "border-line-200 text-ink-500",
                    )}
                  >
                    {s.complete && !isActive ? (
                      <Check size={11} strokeWidth={3} />
                    ) : (
                      s.n.toString().padStart(2, "0")
                    )}
                  </span>
                  <span
                    className={cn(
                      "flex min-w-0 items-center gap-1 truncate font-mono text-[9px] uppercase tracking-[0.18em]",
                      isActive ? "text-ink-950" : "text-ink-500",
                    )}
                  >
                    <Icon size={10} className="shrink-0" /> {s.sub}
                    {counter(s.key) ? (
                      <span className="tabular-nums">· {counter(s.key)}</span>
                    ) : null}
                  </span>
                  {s.locked ? <Lock size={11} className="ml-auto shrink-0 text-ink-500" /> : null}
                </span>

                <span className="block font-serif text-[15px] leading-tight text-ink-950">
                  {s.label}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                  {s.hint}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {children ? <div className="pt-5">{children}</div> : null}
    </div>
  );
}


