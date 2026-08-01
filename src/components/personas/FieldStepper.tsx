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

import { useGuardedGo } from "@/components/personas/field/stage-bus";
import { subStepProgress } from "@/lib/personas/field-substeps";
import type { FieldProgress } from "@/lib/personas/field-stages";
import { cn, scrollToTop } from "@/lib/utils";

export type FieldStageKey =
  | "brief"
  | "plan"
  | "participants"
  | "instruments"
  | "fieldwork"
  | "evidence";

const STEP_ROUTE = "/admin/countries/$code/personas/field/$step" as const;

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
  activeProjectId?: string;
  briefCommitted?: boolean;
  planCommitted?: boolean;
  /** Live per-stage completion, so the rail always tells the truth. */
  progress?: FieldProgress;
}) {
  const done = (k: FieldStageKey) => !!progress?.stages[k]?.complete;
  const hintFor = (k: FieldStageKey, fallback: string) =>
    done(k) ? "done" : progress?.stages[k]?.blocker ? "outstanding" : fallback;
  // Micro-counter: how many screens inside this stage are already settled.
  const counter = (k: FieldStageKey) => {
    const { done: d, total } = subStepProgress(k, progress);
    return total > 1 ? `${d}/${total}` : null;
  };

  // The rail is a way out of a stage like any other — it goes through the
  // same save-or-discard gate the sticky bar uses.
  const navigate = useNavigate();
  const guardedGo = useGuardedGo();

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
      locked: !briefCommitted,
      complete: planCommitted,
    },
    {
      key: "participants",
      n: 2,
      label: "Participants",
      sub: "CRM",
      hint: hintFor("participants", "panels & consent"),
      icon: Users,
      locked: !planCommitted,
      complete: done("participants"),
    },
    {
      key: "instruments",
      n: 3,
      label: "Instruments",
      sub: "Fieldcraft",
      hint: hintFor("instruments", "surveys & guides"),
      icon: ClipboardList,
      locked: !done("participants"),
      complete: done("instruments"),
    },
    {
      key: "fieldwork",
      n: 4,
      label: "Fieldwork",
      sub: "Collection",
      hint: hintFor("fieldwork", "sessions & returns"),
      icon: Mic,
      locked: !done("instruments"),
      complete: done("fieldwork"),
    },
    {
      key: "evidence",
      n: 5,
      label: "Evidence",
      sub: "Synthesis",
      hint: hintFor("evidence", "filed to the brain"),
      icon: Library,
      locked: !done("fieldwork"),
      complete: done("evidence"),
    },
  ];

  return (
    <nav
      aria-label="Field programme stages"
      className="sticky top-0 z-20 -mx-6 border-b border-line-200 bg-paper-0/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper-0/80"
    >
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {nodes.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.key;
          const to = STEP_ROUTE;
          const params = { code, step: s.key };
          return (
            <li key={s.key}>
              <Link
                to={to}
                params={params as never}
                search={activeProjectId ? { project: activeProjectId } : undefined}
                disabled={s.locked}
                aria-disabled={s.locked}
                title={
                  s.locked
                    ? !briefCommitted
                      ? "Commit the brief to unlock"
                      : "Approve the programme plan to unlock"
                    : undefined
                }
                onClick={(e) => {
                  e.preventDefault();
                  if (s.locked || isActive) return;
                  guardedGo(() => {
                    scrollToTop();
                    void navigate({
                      to,
                      params: params as never,
                      search: activeProjectId ? { project: activeProjectId } : undefined,
                    });
                  });
                }}
                className={cn(
                  "group flex items-start gap-2 border-l-2 py-1 pl-2 transition-colors",
                  s.locked && "pointer-events-none cursor-not-allowed opacity-40",
                  isActive
                    ? "border-ink-950"
                    : s.complete
                      ? "border-emerald-500/60 hover:border-ink-950"
                      : "border-line-200 hover:border-ink-500",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-[11px] tabular-nums",
                    isActive
                      ? "border-ink-950 bg-ink-950 text-paper-0"
                      : s.complete
                        ? "border-emerald-500 bg-emerald-500 text-paper-0"
                        : "border-line-200 text-ink-500",
                  )}
                >
                  {s.locked ? (
                    <Lock size={11} />
                  ) : s.complete && !isActive ? (
                    <Check size={12} strokeWidth={3} />
                  ) : (
                    s.n.toString().padStart(2, "0")
                  )}
                </span>
                <span className="min-w-0">
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
                  <span className="mt-0.5 block font-serif text-[15px] leading-tight text-ink-950">
                    {s.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                    {s.hint}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
