// Global auto-run beacon. Renders whenever any auto-run is active anywhere in
// the app. Two surfaces:
//   1. Persistent top-of-viewport ribbon (thin, animated) — impossible to miss.
//   2. Floating bottom-right card with per-run detail + deep link back.
//
// Mounts once inside the authenticated shell. State comes from
// `src/lib/autorun/beacon.ts`.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight, Loader2, PauseCircle, Sparkles, X } from "lucide-react";

import { useAutoRuns, clearAutoRun, type AutoRunEntry } from "@/lib/autorun/beacon";

export function AutoRunBeacon() {
  const runs = useAutoRuns();
  const [collapsed, setCollapsed] = useState(false);

  if (runs.length === 0) return null;

  const active = runs.filter((r) => r.status === "running");
  const hasActive = active.length > 0;
  const hasError = runs.some((r) => r.status === "error");

  return (
    <>
      {/* Top ribbon — always visible while any run is active */}
      {hasActive && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-0 z-[70] pointer-events-none"
        >
          <div className="relative h-[3px] w-full overflow-hidden bg-ink-950/10">
            <div className="autorun-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-ink-950 to-transparent" />
          </div>
        </div>
      )}

      {/* Floating card */}
      <div className="fixed bottom-5 right-5 z-[71] w-[360px] max-w-[calc(100vw-2rem)]">
        <div
          className={`border shadow-[0_20px_60px_-20px_rgba(15,15,15,0.35)] ${
            hasError
              ? "border-rose-500 bg-rose-50/95"
              : "border-ink-950 bg-paper-0/95"
          } backdrop-blur`}
        >
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center gap-2 border-b border-line-200 px-3 py-2 text-left"
          >
            <span
              className={`grid h-6 w-6 place-items-center border ${
                hasError
                  ? "border-rose-500 bg-rose-500 text-paper-0"
                  : "border-ink-950 bg-ink-950 text-paper-0"
              }`}
              aria-hidden="true"
            >
              {hasError ? (
                <AlertTriangle size={12} />
              ) : hasActive ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[9px] uppercase tracking-[0.22em] text-ink-500">
                {hasError ? "Auto-run needs attention" : hasActive ? "Auto-run in progress" : "Auto-run"}
              </span>
              <span className="block truncate font-serif text-[13px] text-ink-950">
                {runs.length} active{runs.length === 1 ? " run" : " runs"}
              </span>
            </span>
            <ChevronRight
              size={14}
              className={`shrink-0 text-ink-500 transition-transform ${collapsed ? "" : "rotate-90"}`}
            />
          </button>

          {!collapsed && (
            <ul className="max-h-[60vh] divide-y divide-line-200 overflow-auto">
              {runs.map((r) => (
                <RunRow key={r.id} run={r} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <style>{`
        @keyframes autorun-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .autorun-shimmer {
          animation: autorun-shimmer 1.6s linear infinite;
        }
      `}</style>
    </>
  );
}

function RunRow({ run }: { run: AutoRunEntry }) {
  const pct =
    run.progress && run.progress.total > 0
      ? Math.min(100, Math.round((run.progress.current / run.progress.total) * 100))
      : null;

  return (
    <li className="px-3 py-3">
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center border ${
            run.status === "error"
              ? "border-rose-500 bg-rose-100 text-rose-600"
              : run.status === "paused"
                ? "border-amber-500 bg-amber-50 text-amber-700"
                : run.status === "complete"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-ink-950 bg-ink-950 text-paper-0"
          }`}
          aria-hidden="true"
        >
          {run.status === "running" ? (
            <Loader2 size={11} className="animate-spin" />
          ) : run.status === "paused" ? (
            <PauseCircle size={11} />
          ) : run.status === "error" ? (
            <AlertTriangle size={11} />
          ) : (
            <Sparkles size={11} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">{run.scope}</p>
          <p className="mt-0.5 font-serif text-[13px] leading-tight text-ink-950">{run.title}</p>
          {run.detail && (
            <p className="mt-0.5 truncate text-[11px] text-ink-700" title={run.detail}>
              {run.detail}
            </p>
          )}
          {run.message && run.status !== "running" && (
            <p className="mt-0.5 text-[11px] text-rose-600">{run.message}</p>
          )}
          {pct !== null && (
            <div className="mt-2 h-[3px] w-full overflow-hidden bg-line-200">
              <div
                className={`h-full transition-[width] duration-500 ${
                  run.status === "error" ? "bg-rose-500" : "bg-ink-950"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            {run.href && (
              <Link
                to={run.href}
                className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-950 underline underline-offset-2 hover:opacity-70"
              >
                Open →
              </Link>
            )}
            {(run.status === "complete" || run.status === "error" || run.status === "paused") && (
              <button
                type="button"
                onClick={() => clearAutoRun(run.id)}
                className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
              >
                <X size={10} /> Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
