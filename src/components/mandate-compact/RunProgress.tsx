// Chamber 08 · Live progress for the AI steps, shared progress query, and
// step-state badges for the 8-step stepper.

import { useEffect, useState } from "react";
import { queryOptions } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";

import { Explain } from "@/components/explain/Explain";
import type { CompactProgress, RunInfo, StepState } from "@/lib/mandate-compact/progress.functions";
import { cn } from "@/lib/utils";

export function progressQuery(compactId: string, fetcher: (a: { data: { compactId: string } }) => Promise<CompactProgress>) {
  return queryOptions({
    queryKey: ["mandate-compact-progress", compactId],
    queryFn: () => fetcher({ data: { compactId } }),
    refetchInterval: (q) => (q.state.data?.active ? 2000 : 30000),
  });
}

function useElapsed(from: string, to: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (to) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [to]);
  const ms = (to ? new Date(to).getTime() : now) - new Date(from).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

const STAGES: Record<RunInfo["step"], string[]> = {
  decompose: ["Reading manifesto", "Asking AI", "Checking pledges", "Saving pillars"],
  transform: ["Loading pledges", "Asking AI", "Saving deliverables"],
};

export function RunProgressCard({ run, pendingLocal, onRetry }: { run?: RunInfo; pendingLocal: boolean; onRetry: () => void }) {
  const elapsed = useElapsed(run?.started_at ?? new Date().toISOString(), run?.finished_at ?? null);
  if (!run && !pendingLocal) return null;
  const status = run?.status ?? "running";
  const stages = STAGES[run?.step ?? "decompose"];
  const idx = run?.stage ? stages.indexOf(run.stage) : 0;

  if (status === "succeeded") {
    const r = run?.result ?? {};
    const bits = Object.entries(r)
      .filter(([k, v]) => typeof v === "number" && k !== "source_chars")
      .map(([k, v]) => `${v} ${k.replace(/_created|_/g, " ").trim()}`);
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line-200 bg-paper-50 px-4 py-3 text-sm text-ink-700">
        <CheckCircle2 className="h-4 w-4 text-signal-positive" />
        Last run finished in {elapsed}{bits.length ? ` · ${bits.join(" · ")}` : ""}.
      </div>
    );
  }

  if (status === "failed" || status === "stalled") {
    return (
      <div role="alert" className="grid gap-2 rounded-xl border border-signal-negative/40 bg-paper-50 px-4 py-3 text-sm">
        <p className="flex items-center gap-2 font-semibold text-ink-950">
          <AlertTriangle className="h-4 w-4 text-signal-negative" />
          <Explain id="compact.run-stall">{status === "stalled" ? "Run stalled" : "Run failed"}</Explain>
          {run?.stage ? <span className="font-normal text-ink-500">at “{run.stage}”</span> : null}
        </p>
        <p className="text-ink-700">{run?.error}</p>
        <div>
          <button type="button" className="btn-secondary" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div aria-live="polite" className="grid gap-3 rounded-xl border border-gold-500/50 bg-paper-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-semibold text-ink-950">
          <Loader2 className="h-4 w-4 animate-spin" /> {run?.stage ?? "Starting"}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-ink-500">{elapsed}</span>
      </div>
      <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0,1fr))` }}>
        {stages.map((s, i) => (
          <li key={s} className="grid gap-1">
            <span className={cn("h-1 w-full", i < idx ? "bg-ink-950" : i === idx ? "animate-pulse bg-gold-500" : "bg-line-200")} />
            <span className={cn("font-mono text-[10px] uppercase tracking-[0.14em]", i === idx ? "text-ink-950" : "text-ink-400")}>{s}</span>
          </li>
        ))}
      </ol>
      {run?.stage_detail ? <p className="text-xs text-ink-500">{run.stage_detail}</p> : null}
      <p className="text-[11px] text-ink-400">You can switch steps or refresh. Progress is saved and picks up when you return.</p>
    </div>
  );
}

export const STATE_LABEL: Record<StepState, string> = {
  done: "Done",
  running: "Running",
  ready: "Ready",
  blocked: "Blocked",
  stale: "Out of date",
  failed: "Needs retry",
};

export function StepBadge({ state }: { state?: StepState }) {
  if (!state) return null;
  return (
    <span
      className={cn(
        "mt-1 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em]",
        state === "done" && "text-signal-positive",
        state === "running" && "text-gold-500",
        state === "ready" && "text-ink-700",
        state === "blocked" && "text-ink-400",
        (state === "stale" || state === "failed") && "text-signal-negative",
      )}
    >
      {state === "done" ? <CheckCircle2 className="h-3 w-3" /> : state === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : state === "failed" || state === "stale" ? <AlertTriangle className="h-3 w-3" /> : null}
      {STATE_LABEL[state]}
    </span>
  );
}
