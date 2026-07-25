import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Circle, GripHorizontal, Loader2 } from "lucide-react";

import { updatePlaybookAction, type PlaybookRow, type PlaybookAction } from "@/lib/fdi-studio/playbook.functions";

const HORIZONS: Array<{ key: "30d" | "3m" | "6m" | "12m"; label: string; intent: string }> = [
  { key: "30d", label: "30 days", intent: "Signal & unblock" },
  { key: "3m", label: "3 months", intent: "Structure & de-risk" },
  { key: "6m", label: "6 months", intent: "Land & anchor" },
  { key: "12m", label: "12 months", intent: "Compound & measure" },
];

const STATUS_META: Record<PlaybookAction["status"], { label: string; tone: string }> = {
  proposed: { label: "Proposed", tone: "text-ink-500" },
  in_flight: { label: "In flight", tone: "text-gold-500" },
  done: { label: "Done", tone: "text-emerald-600" },
  blocked: { label: "Blocked", tone: "text-signal-negative" },
  dropped: { label: "Dropped", tone: "text-ink-300 line-through" },
};

export function PlaybookTimeline({ playbook, countryCode }: { playbook: PlaybookRow; countryCode: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {HORIZONS.map((h) => {
        const rows = playbook.actions.filter((a) => a.horizon === h.key);
        return (
          <div key={h.key} className="border border-line-200 bg-paper-0 p-4">
            <div className="flex items-baseline justify-between border-b border-line-200 pb-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{h.label}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-300">{rows.length}</p>
            </div>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-gold-500">{h.intent}</p>
            <ul className="mt-3 space-y-3">
              {rows.length === 0 && <li className="text-xs text-ink-500">No actions yet.</li>}
              {rows.map((a) => (
                <ActionRow key={a.id} action={a} countryCode={countryCode} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ActionRow({ action, countryCode }: { action: PlaybookAction; countryCode: string }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updatePlaybookAction);
  const [local, setLocal] = useState(action);

  const cycleStatus = useMutation({
    mutationFn: async () => {
      const order: PlaybookAction["status"][] = ["proposed", "in_flight", "done", "blocked", "dropped"];
      const next = order[(order.indexOf(local.status) + 1) % order.length];
      setLocal({ ...local, status: next });
      return updateFn({ data: { actionId: local.id, countryCode, patch: { status: next } } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fdi-playbooks", countryCode] }),
  });

  const s = STATUS_META[local.status];

  return (
    <li className="border-l-2 border-line-200 pl-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => cycleStatus.mutate()}
          className={`mt-0.5 shrink-0 rounded-full border border-line-200 p-1 ${s.tone}`}
          title={`Status: ${s.label} (click to cycle)`}
        >
          {cycleStatus.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : local.status === "done" ? (
            <Check className="h-3 w-3" />
          ) : (
            <Circle className="h-3 w-3" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-950">{local.action}</p>
          {local.investor_signal && (
            <p className="mt-1 text-xs italic text-ink-700">Signal: {local.investor_signal}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
            {local.ministry_slug && (
              <span className="border border-line-200 bg-paper-100 px-1.5 py-0.5">
                {local.ministry_name ?? local.ministry_slug}
              </span>
            )}
            {local.sector_code && (
              <span className="border border-line-200 bg-paper-100 px-1.5 py-0.5">{local.sector_code}</span>
            )}
            {local.kpi_target && (
              <span className="text-gold-500">→ {local.kpi_target}</span>
            )}
          </div>
        </div>
        <GripHorizontal className="mt-1 h-3 w-3 shrink-0 text-ink-300" />
      </div>
    </li>
  );
}
