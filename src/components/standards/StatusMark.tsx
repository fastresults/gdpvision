import { cn } from "@/lib/utils";
import type { ReqStatus } from "@/lib/standards/scoring";
import type { PlanStatus } from "@/lib/syndication/db";

import { PLAN_META, STATUS_META } from "./labels";

function Dot({ hollow }: { hollow?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        hollow ? "border border-current" : "bg-current",
      )}
    />
  );
}

/** Requirement status: coloured text with a small dot. */
export function StatusMark({ status, className }: { status: ReqStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-medium", m.text, className)}>
      <Dot hollow={m.hollow} />
      {m.label}
    </span>
  );
}

/** Collection plan status: coloured text with a small dot. */
export function PlanMark({ status, className }: { status: PlanStatus; className?: string }) {
  const m = PLAN_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5", m.text, className)}>
      <Dot />
      {m.label}
    </span>
  );
}
