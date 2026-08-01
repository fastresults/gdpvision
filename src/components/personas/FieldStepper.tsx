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
      locked: !planCommitted,
      complete: done("instruments"),
    },
    {
      key: "fieldwork",
      n: 4,
      label: "Fieldwork",
      sub: "Collection",
      hint: hintFor("fieldwork", "sessions & returns"),
      icon: Mic,
      locked: !planCommitted,
      complete: done("fieldwork"),
    },
    {
      key: "evidence",
      n: 5,
      label: "Evidence",
      sub: "Synthesis",
      hint: hintFor("evidence", "filed to the brain"),
      icon: Library,
      locked: !planCommitted,
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
          const to = s.key === "brief" ? ("/admin/countries/$code/personas" as const) : STEP_ROUTE;
          const params = s.key === "brief" ? { code } : { code, step: s.key };
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
                  if (s.locked) e.preventDefault();
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
