// Chamber 07 · Field programme stepper.
//
// The real-world rail. Mirrors StudioStepper's grammar but walks the stages a
// dated field programme actually passes through.

import { Link, useNavigate } from "@tanstack/react-router";
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
}: {
  code: string;
  active?: FieldStageKey;
  activeProjectId: string;
  briefCommitted?: boolean;
  planCommitted?: boolean;
  /** Live per-stage completion, so the rail always tells the truth. */
  progress?: FieldProgress;
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

  return (
    <div aria-label="Field programme stages" className="border-y border-line-200">
      <ol className="divide-y divide-line-200">
        {nodes.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.key;
          return (
            <li key={s.key} className={cn(isActive && "bg-paper-0")}>
              <button
                type="button"
                aria-expanded={isActive}
                aria-disabled={s.locked}
                disabled={s.locked}
                onClick={() => {
                  if (s.locked || isActive) return;
                  guardedGo(() => {
                    scrollToTop();
                    void navigate({
                      to: STEP_ROUTE,
                      params: { code, step: s.key },
                      search: { project: activeProjectId } as never,
                    });
                  });
                }}
                className={cn(
                  "flex w-full items-center gap-3 border-l-2 px-3 py-3 text-left transition-colors",
                  s.locked ? "cursor-not-allowed opacity-40" : "cursor-pointer",
                  isActive
                    ? "border-ink-950"
                    : s.complete
                      ? "border-emerald-500/60 hover:bg-paper-100/50"
                      : "border-line-200 hover:bg-paper-100/50",
                )}
              >
                {s.locked ? (
                  <Lock size={12} className="shrink-0 text-ink-500" />
                ) : isActive ? (
                  <ChevronDown size={14} className="shrink-0 text-ink-950" />
                ) : (
                  <ChevronRight size={14} className="shrink-0 text-ink-500" />
                )}

                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-[11px] tabular-nums",
                    isActive
                      ? "border-ink-950 bg-ink-950 text-paper-0"
                      : s.complete
                        ? "border-emerald-500 bg-emerald-500 text-paper-0"
                        : "border-line-200 text-ink-500",
                  )}
                >
                  {s.complete && !isActive ? (
                    <Check size={12} strokeWidth={3} />
                  ) : (
                    s.n.toString().padStart(2, "0")
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em]",
                      isActive ? "text-ink-950" : "text-ink-500",
                    )}
                  >
                    <Icon size={11} /> {s.sub}
                    {counter(s.key) ? (
                      <span className="tabular-nums text-ink-500">· {counter(s.key)}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block font-serif text-[16px] leading-tight text-ink-950">
                    {s.label}
                  </span>
                </span>

                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  {s.hint}
                </span>
              </button>

              {isActive ? <div className="border-t border-line-200 px-3 pb-4 pt-4">{children}</div> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

