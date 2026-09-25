import type { InterestView } from "@/lib/investments/investors.functions";
import { INTEREST_STAGE_LABEL } from "@/lib/syndication/db";
import { cn } from "@/lib/utils";

import { Dot, formatDate, formatUsd } from "./ui";

export function isOverdue(
  i: Pick<InterestView, "next_step_due" | "stage">,
  today = new Date(),
): boolean {
  if (!i.next_step_due || i.stage === "closed_won" || i.stage === "closed_lost") return false;
  const t = today.toISOString().slice(0, 10);
  return i.next_step_due < t;
}

export function interestName(i: InterestView): string {
  return i.investorName ?? i.organisation ?? i.contact_name ?? "Unnamed enquiry";
}

export function InterestCard({
  interest: i,
  showProject = true,
  showStage = false,
  onOpen,
}: {
  interest: InterestView;
  showProject?: boolean;
  showStage?: boolean;
  onOpen: () => void;
}) {
  const overdue = isOverdue(i);
  const unmatched = !i.investor_id;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "block w-full border border-line-200 border-l-2 bg-paper-0 p-3 text-left transition-colors hover:border-ink-950",
        unmatched && i.source === "share_link"
          ? "border-l-signal-caution"
          : overdue
            ? "border-l-signal-negative"
            : "border-l-line-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-ink-950">{interestName(i)}</span>
        {i.indicative_amount_usd != null && (
          <span className="text-xs tabular-nums text-ink-800">
            {formatUsd(i.indicative_amount_usd)}
          </span>
        )}
      </div>
      {showProject && <div className="mt-0.5 text-xs text-ink-600">{i.projectTitle}</div>}
      {showStage && (
        <div className="mt-0.5 text-xs text-ink-600">{INTEREST_STAGE_LABEL[i.stage]}</div>
      )}
      {unmatched && (
        <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-signal-caution">
          <Dot tone="caution" />
          {i.source === "share_link"
            ? "Enquiry via share link · Match to an investor"
            : "No investor record · Match to an investor"}
        </div>
      )}
      {i.next_step && (
        <div className="mt-2 text-xs text-ink-800">
          {i.next_step}
          {i.next_step_due && (
            <span
              className={cn("ml-1 tabular-nums", overdue ? "text-signal-negative" : "text-ink-500")}
            >
              · {overdue ? "overdue since " : "due "}
              {formatDate(i.next_step_due)}
            </span>
          )}
        </div>
      )}
      {!i.next_step && i.next_step_due && (
        <div
          className={cn(
            "mt-2 text-xs tabular-nums",
            overdue ? "text-signal-negative" : "text-ink-500",
          )}
        >
          {overdue ? "Overdue since " : "Due "}
          {formatDate(i.next_step_due)}
        </div>
      )}
      {i.ownerName && <div className="mt-1 text-[11px] text-ink-500">Owner: {i.ownerName}</div>}
    </button>
  );
}
