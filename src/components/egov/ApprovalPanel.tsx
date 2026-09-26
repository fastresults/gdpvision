// Status, the actions the caller may take, and the governance history.
// The database decides what is allowed; this panel only shows the right
// buttons and passes its message through.

import { useState } from "react";

import type { PrdRow } from "@/lib/egov/db";
import type { Capabilities, HistoryItem } from "@/lib/egov/prd.functions";
import { cn } from "@/lib/utils";

import { HISTORY_LABEL, MICRO, PRD_META, formatWhen } from "./labels";

/** The status fields of any studio document under the two-person rule. */
type Approvable = Pick<
  PrdRow,
  | "status"
  | "version"
  | "returned_note"
  | "submitted_by"
  | "submitted_at"
  | "approved_at"
  | "approval_mode"
>;

export function ApprovalPanel({
  prd,
  approvedNote = "Share links can now be issued.",
  capabilities,
  userId,
  allDrafted,
  staleCount,
  history,
  busy,
  onTransition,
}: {
  prd: Approvable;
  /** What approval unlocks, shown after the approval line. */
  approvedNote?: string;
  capabilities: Capabilities;
  userId: string;
  allDrafted: boolean;
  staleCount: number;
  history: HistoryItem[];
  busy: boolean;
  onTransition: (
    to: "submitted" | "approved" | "returned" | "draft",
    note?: string,
  ) => Promise<void>;
}) {
  const meta = PRD_META[prd.status];
  const [note, setNote] = useState("");
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSubmitter = prd.submitted_by === userId;
  // Two-person rule, with the sole-approver exception the database enforces
  // (global admin, nobody else holds an approver role for this country).
  const soleApproval = isSubmitter && capabilities.soleApprove;
  const canApprove =
    capabilities.approve && prd.status === "submitted" && (!isSubmitter || soleApproval);
  const canSubmit = (prd.status === "draft" || prd.status === "returned") && allDrafted;
  const canWithdraw = prd.status === "submitted" && (isSubmitter || capabilities.approve);
  const canReopen = prd.status === "approved" && capabilities.approve;

  async function go(to: "submitted" | "approved" | "returned" | "draft", n?: string) {
    setError(null);
    try {
      await onTransition(to, n);
      setReturning(false);
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <aside className="border-t border-line-200 pt-4" aria-label="Approval">
      <div className={MICRO}>Approval</div>
      <div className={cn("mt-1 text-sm", meta.text)}>
        <span
          className={cn(
            "mr-1.5 inline-block h-1.5 w-1.5 rounded-full border bg-current",
            meta.border,
          )}
        />
        {meta.label}
        <span className="ml-2 font-mono text-[10px] text-ink-400">v{prd.version}</span>
      </div>

      {prd.status === "returned" && prd.returned_note && (
        <p className="mt-2 border-l-2 border-signal-negative py-1 pl-3 text-sm text-ink-700">
          {prd.returned_note}
        </p>
      )}
      {prd.status === "submitted" && (
        <p className="mt-2 text-xs text-ink-500">
          Submitted {formatWhen(prd.submitted_at)}.{" "}
          {isSubmitter && !soleApproval ? "A second person must approve it." : ""}
          {soleApproval
            ? "No second approver is bound to this country, so as global admin you may approve your own submission. The approval is recorded as not counter-signed."
            : ""}
        </p>
      )}
      {prd.status === "approved" && (
        <p className="mt-2 text-xs text-ink-500">
          Approved {formatWhen(prd.approved_at)}
          {prd.approval_mode === "sole_admin"
            ? " by the submitter (sole approver, not counter-signed)"
            : ""}
          . {approvedNote}
        </p>
      )}
      {(prd.status === "draft" || prd.status === "returned") && !allDrafted && (
        <p className="mt-2 text-xs text-ink-500">
          Every section must be drafted before submission.
        </p>
      )}
      {prd.status === "submitted" && staleCount > 0 && (
        <p className="mt-2 text-xs text-signal-caution">
          {staleCount} section{staleCount === 1 ? " is" : "s are"} out of date; approval will be
          refused until refreshed.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canSubmit && (
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={() => go("submitted")}
          >
            Submit for approval
          </button>
        )}
        {canApprove && (
          <>
            <button
              type="button"
              className="btn-primary px-3 py-1.5 text-xs"
              disabled={busy}
              onClick={() => go("approved")}
            >
              {soleApproval ? "Approve as sole approver" : "Approve"}
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-xs"
              disabled={busy}
              onClick={() => setReturning((v) => !v)}
            >
              Return with a note
            </button>
          </>
        )}
        {canWithdraw && (
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={() => go("draft")}
          >
            Withdraw
          </button>
        )}
        {canReopen && (
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={() => go("draft")}
          >
            Reopen for revision
          </button>
        )}
      </div>

      {returning && (
        <div className="mt-3">
          <textarea
            className="min-h-20 w-full border border-line-200 bg-paper-0 px-3 py-2 text-sm text-ink-950 focus:border-ink-950 focus:outline-none"
            placeholder="What needs to change?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
          />
          <button
            type="button"
            className="btn-secondary mt-2 px-3 py-1.5 text-xs"
            disabled={busy || !note.trim()}
            onClick={() => go("returned", note.trim())}
          >
            Return
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-signal-negative">{error}</p>}

      {history.length > 0 && (
        <ol className="mt-5 space-y-2 border-l border-line-200 pl-3">
          {history.slice(0, 12).map((h) => (
            <li key={h.id} className="text-xs">
              <div className="text-ink-950">
                {HISTORY_LABEL[h.action] ?? h.action}
                {h.section ? <span className="text-ink-500"> · {h.section}</span> : null}
                {h.mode === "sole_admin" ? (
                  <span className="text-ink-500"> · sole approver, not counter-signed</span>
                ) : null}
              </div>
              <div className="text-ink-500">
                {h.actorLabel ?? "System"} · {formatWhen(h.at)}
              </div>
              {h.note && <div className="mt-0.5 text-ink-700">{h.note}</div>}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
