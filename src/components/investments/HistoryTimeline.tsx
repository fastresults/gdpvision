import type { HistoryItem } from "@/lib/investments/pipeline.functions";
import { APPROVAL_LABEL } from "@/lib/investments/readiness";
import { cn } from "@/lib/utils";

import { formatDate } from "./ui";

const ACTION: Record<string, { label: string; tone: string }> = {
  "investment.created": { label: "Created", tone: "bg-ink-300" },
  "investment.edited": { label: "Edited", tone: "bg-ink-300" },
  "investment.submitted": { label: "Submitted for approval", tone: "bg-signal-caution" },
  "investment.approved": { label: "Approved for investors", tone: "bg-signal-positive" },
  "investment.returned": { label: "Returned for changes", tone: "bg-signal-negative" },
  "investment.withdrawn": { label: "Withdrawn", tone: "bg-ink-300" },
  "investment.reopened": { label: "Reopened as a draft after an edit", tone: "bg-signal-caution" },
  "investment.deleted": { label: "Deleted", tone: "bg-signal-negative" },
  "investment.compliance_updated": { label: "Compliance record updated", tone: "bg-gold-500" },
  "share_link.created": { label: "Share link created", tone: "bg-gold-500" },
  "share_link.revoked": { label: "Share link revoked", tone: "bg-ink-300" },
  "package.approved": { label: "Investor material approved", tone: "bg-signal-positive" },
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : typeof v === "number" ? String(v) : null;
}

function detail(h: HistoryItem): string[] {
  const m = (h.metadata ?? {}) as Record<string, unknown>;
  const out: string[] = [];
  const version = str(m.version);
  if (version) out.push(`Version ${version}`);
  const readiness = str(m.readiness);
  if (readiness) out.push(`Readiness ${readiness}/10`);
  const from = str(m.from);
  const to = str(m.to);
  if (from && to && from !== to)
    out.push(`${APPROVAL_LABEL[from] ?? from} → ${APPROVAL_LABEL[to] ?? to}`);
  const label = str(m.label);
  if (label) out.push(`“${label}”${str(m.hint) ? ` · …${str(m.hint)}` : ""}`);
  const kind = str(m.kind);
  if (kind) out.push(kind.replace("_", " "));
  const aml = str(m.aml_status);
  if (aml) out.push(`AML ${aml.replace("_", " ")}`);
  const owners = str(m.owners_listed);
  if (owners) out.push(`${owners} owner${owners === "1" ? "" : "s"} listed`);
  return out;
}

export function HistoryTimeline({ items }: { items: HistoryItem[] }) {
  if (!items.length) return <p className="text-sm text-ink-500">No history recorded yet.</p>;
  return (
    <ol className="relative ml-1 border-l border-line-200">
      {items.map((h) => {
        const a = ACTION[h.action] ?? { label: h.action, tone: "bg-ink-300" };
        const note = str((h.metadata as Record<string, unknown> | null)?.note);
        return (
          <li key={h.id} className="relative pb-5 pl-5">
            <span
              aria-hidden
              className={cn("absolute -left-[4px] top-1.5 h-2 w-2 rounded-full", a.tone)}
            />
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-sm text-ink-950">{a.label}</span>
              <span className="text-xs text-ink-500">
                {h.actor_label ?? (h.actor_id ? "A team member" : "System")}
              </span>
              <span className="text-xs tabular-nums text-ink-400">
                {formatDate(h.created_at, true)}
              </span>
            </div>
            {detail(h).length > 0 && (
              <div className="mt-0.5 text-xs text-ink-600">{detail(h).join(" · ")}</div>
            )}
            {note && (
              <div className="mt-1 border-l-2 border-l-signal-negative pl-2 text-xs text-ink-800">
                {note}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
