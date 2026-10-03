// Chamber 07 · Ministers track — the run rail. Shows each phase and its log
// line, and drives the run: while this page is open and the run is going, it
// calls one tick after another. Closing the page stops the loop; the stored
// phase is where the next visit resumes. The server lock means two open
// windows cannot run the same step twice.

import { Check, CircleAlert, Loader2 } from "lucide-react";

import { PHASE_HINT, PHASE_LABEL, phasesFor, type SetRow } from "@/lib/personas/portfolio/db";
import { cn } from "@/lib/utils";

import { MICRO, RUN_META, formatWhen } from "./labels";
import type { useRunLoop } from "./useRunLoop";

export function RunRail({
  set,
  personas,
  canRun,
  aiAvailable,
  loop,
}: {
  set: SetRow;
  personas: number;
  canRun: boolean;
  aiAvailable: boolean;
  loop: ReturnType<typeof useRunLoop>;
}) {
  const phases = phasesFor(set.kind);
  const at = phases.indexOf(set.phase);
  const editable = set.status === "draft" || set.status === "returned";
  const lastFor = (p: string) => [...(set.phase_log ?? [])].reverse().find((l) => l.phase === p);
  const meta = RUN_META[loop.running ? "running" : set.run_state];

  return (
    <aside className="border border-line-200 bg-paper-0 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className={MICRO}>The run</div>
        <span className={cn("text-[11px]", meta.text)}>{meta.label}</span>
      </div>

      {set.kind === "regional" && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-ink-700">
            <span>Personas cast</span>
            <span className="font-mono tabular-nums">
              {personas}/{set.target_size}
            </span>
          </div>
          <div
            className="mt-1 h-1.5 border border-line-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={set.target_size}
            aria-valuenow={personas}
          >
            <div
              className="h-full bg-ink-950"
              style={{ width: `${(personas / set.target_size) * 100}%` }}
            />
          </div>
        </div>
      )}

      <ol className="mt-4 space-y-2.5">
        {phases.map((p, i) => {
          const done = i < at || set.phase === "done";
          const current = i === at && set.phase !== "done";
          const log = lastFor(p);
          return (
            <li key={p} className="flex gap-2.5">
              <span
                className={cn(
                  "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                  done
                    ? "border-signal-positive text-signal-positive"
                    : current
                      ? "border-gold-500 text-gold-500"
                      : "border-line-200 text-ink-300",
                )}
              >
                {done ? (
                  <Check size={9} />
                ) : current && loop.running ? (
                  <Loader2 size={9} className="animate-spin" />
                ) : current && set.run_state === "failed" ? (
                  <CircleAlert size={9} />
                ) : null}
              </span>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-xs",
                    current ? "text-ink-950" : done ? "text-ink-700" : "text-ink-400",
                  )}
                >
                  {PHASE_LABEL[p]}
                </div>
                <div className="text-[11px] leading-snug text-ink-500">
                  {log?.summary ?? log?.error ?? (p === "done" ? "" : PHASE_HINT[p])}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {(loop.error || (set.run_state === "failed" && set.run_error)) && (
        <p className="mt-3 border-l-2 border-signal-negative py-1 pl-2 text-[11px] text-signal-negative">
          {loop.error ?? set.run_error}
        </p>
      )}
      {loop.message && !loop.error && loop.running && (
        <p className="mt-3 border-l-2 border-gold-500 py-1 pl-2 text-[11px] text-ink-700">
          {loop.message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {editable && canRun && set.phase !== "done" && !loop.running && (
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs"
            disabled={!aiAvailable}
            onClick={() => loop.start(set.run_state === "failed")}
          >
            {set.run_state === "failed"
              ? "Try again"
              : set.phase === "scope" && !(set.phase_log ?? []).length
                ? "Start the run"
                : "Continue the run"}
          </button>
        )}
        {loop.running && (
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={loop.stop}>
            Pause
          </button>
        )}
      </div>
      {set.model && <div className="mt-3 text-[10px] text-ink-400">Model: {set.model}</div>}
      <div className="text-[10px] text-ink-400">Last change {formatWhen(set.updated_at)}</div>
    </aside>
  );
}
