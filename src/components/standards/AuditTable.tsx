import { Explain } from "@/components/explain/Explain";
import type { PlanSummary } from "@/lib/standards/audit.functions";
import type { AuditRow } from "@/lib/standards/scoring";
import { cn } from "@/lib/utils";

import {
  FREQUENCY_LABEL,
  IMPACT_LABEL,
  MICRO,
  ageText,
  formatDate,
  isPastDue,
  rowCtx,
} from "./labels";
import { PlanMark, StatusMark } from "./StatusMark";

/** Stops clicks on an Explain (and its portal-rendered modal) from opening the row's sheet. */
function Quiet({ children }: { children: React.ReactNode }) {
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {children}
    </span>
  );
}

export function AuditTable({
  rows,
  plans,
  onOpen,
  empty,
}: {
  rows: AuditRow[];
  plans: Map<string, PlanSummary>;
  onOpen: (row: AuditRow) => void;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="border-l-2 border-line-200 py-6 pl-4 text-sm text-ink-500">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead className={cn("border-b border-line-200 text-left", MICRO)}>
          <tr>
            <th className="py-2 pr-4 font-normal">Requirement</th>
            <th className="pr-4 font-normal">Standard</th>
            <th className="pr-4 font-normal">Required</th>
            <th className="pr-4 font-normal">Impact</th>
            <th className="pr-4 font-normal">Status</th>
            <th className="pr-4 font-normal">Evidence</th>
            <th className="font-normal">Collection plan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const plan = plans.get(r.id) ?? null;
            const pastDue = plan ? isPastDue(plan.dueDate, r.status) : false;
            return (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => onOpen(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(r);
                  }
                }}
                className="cursor-pointer border-b border-line-100 align-top transition-colors hover:bg-paper-50 focus-visible:bg-paper-50 focus-visible:outline-none"
              >
                <td className="py-2.5 pr-4 text-ink-950">
                  {r.label}
                  {r.clause && <div className="mt-0.5 text-xs text-ink-500">{r.clause}</div>}
                </td>
                <td className="pr-4 pt-2.5 font-mono text-xs text-ink-700">{r.standardCode}</td>
                <td className="pr-4 pt-2.5 text-ink-700">
                  {FREQUENCY_LABEL[r.frequency] ?? r.frequency}
                  <div className="text-xs text-ink-500">lag {r.maxLagMonths} mo</div>
                </td>
                <td className="pr-4 pt-2.5 text-ink-700">{IMPACT_LABEL[r.impact] ?? r.impact}</td>
                <td className="pr-4 pt-2.5">
                  <Quiet>
                    <Explain id="standards.status" ctx={rowCtx(r)} mark={false}>
                      <StatusMark status={r.status} />
                    </Explain>
                  </Quiet>
                </td>
                <td className="pr-4 pt-2.5 text-xs text-ink-700">
                  {r.evidence.length === 0 ? (
                    <span className="text-ink-400">None</span>
                  ) : (
                    r.evidence.map((e) => (
                      <div key={e.kpi} className="tabular-nums">
                        <span className="font-mono">{e.kpi}</span> · {e.period ?? "undated"} ·{" "}
                        <span className={e.fresh ? "" : "text-signal-caution"}>
                          {ageText(e.ageMonths)}
                        </span>
                        {e.viaMapping && (
                          <span className="ml-1 text-scenario-tint">via AI mapping</span>
                        )}
                      </div>
                    ))
                  )}
                </td>
                <td className="pt-2.5 text-xs">
                  {plan ? (
                    <div>
                      <PlanMark status={plan.status} />
                      <div className="mt-0.5 text-ink-700">
                        {plan.ownerAgency ?? "No owner yet"}
                      </div>
                      {plan.dueDate && (
                        <div className={pastDue ? "text-signal-negative" : "text-ink-500"}>
                          Due {formatDate(plan.dueDate)}
                          {pastDue && " · overdue"}
                        </div>
                      )}
                    </div>
                  ) : r.status === "collected" ? (
                    <span className="text-ink-400">Not needed</span>
                  ) : (
                    <span className="text-ink-500 underline decoration-line-200 underline-offset-4">
                      Create a plan
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading the audit">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse border-b border-line-100 bg-paper-50" />
      ))}
    </div>
  );
}
