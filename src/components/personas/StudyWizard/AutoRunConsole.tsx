// Chamber 07 · Research Studio · Auto-run console (server-driven, poll-based).
// The client just starts, ticks, and polls. All work — brief → outcome → cast → commit → synthesis —
// runs server-side under an advisory lock so tab-close / double-click / two-tabs are all safe.

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, FileText, Loader2, Rocket, RotateCcw } from "lucide-react";

import {
  cancelAutorun,
  getAutorunStatus,
  runAutorunTick,
  startAutorun,
  type AutoRunPhase,
  type PhaseLogEntry,
} from "@/lib/personas/autorun.functions";
import { clearAutoRun, publishAutoRun } from "@/lib/autorun/beacon";

type PhaseState = "pending" | "running" | "done" | "failed" | "skipped";

type PhaseRow = {
  id: AutoRunPhase;
  label: string;
  detail: string;
  state: PhaseState;
  summary?: string;
  error?: string;
  durationMs?: number;
};

const PHASES: Array<{ id: AutoRunPhase; label: string; detail: string }> = [
  { id: "brief",     label: "Enrich the brief",              detail: "Turn the raw brief into a McKinsey Research Scope." },
  { id: "outcome",   label: "Blueprint deliverables",        detail: "Scaffold + AI-refined SCQA memo, stakeholder map, survey, guide, readout." },
  { id: "cast",      label: "Cast personas & instruments",   detail: "Corpus-first with open-web deep research for gaps." },
  { id: "commit",    label: "Commit to workspace",           detail: "Persist study, personas, segments, instruments, evidence ledger." },
  { id: "synthesis", label: "Run synthetic analysis",        detail: "Draft questions, generate per-persona responses, synthesize themes." },
];

type Props = {
  draftId: string;
  countryCode: string;
  briefRaw: string | null;
  onDone: (studyId: string) => void;
  onCancel: () => void;
  onNeedBrief: () => void;
};

export function AutoRunConsole({ draftId, countryCode: _countryCode, briefRaw, onDone, onCancel, onNeedBrief }: Props) {
  const [rows, setRows] = useState<PhaseRow[]>(
    PHASES.map((p) => ({ ...p, state: "pending" })),
  );
  const [status, setStatus] = useState<"queued" | "running" | "done" | "failed" | "canceled">("queued");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [studyId, setStudyId] = useState<string | null>(null);
  const startedRef = useRef(false);
  const stopRef = useRef(false);
  const tickingRef = useRef(false);

  function applyPhaseLog(log: PhaseLogEntry[], activePhase: AutoRunPhase | null) {
    setRows((prev) =>
      prev.map((r) => {
        const entries = log.filter((e) => e.phase === r.id);
        const last = entries[entries.length - 1];
        if (r.id === activePhase && (!last || last.state === "failed")) {
          return { ...r, state: "running", summary: last?.summary, error: undefined, durationMs: last?.duration_ms };
        }
        if (!last) return { ...r, state: "pending" };
        return {
          ...r,
          state: last.state,
          summary: last.summary,
          error: last.error,
          durationMs: last.duration_ms,
        };
      }),
    );
  }

  async function pollStatus() {
    const s = await getAutorunStatus({ data: { draftId } });
    applyPhaseLog(s.phaseLog, s.status === "running" ? s.nextPhase : null);
    setStatus(s.status);
    setStatusMsg(s.message);
    if (s.studyId) setStudyId(s.studyId);
    return s;
  }

  async function tickLoop() {
    if (tickingRef.current) return;
    tickingRef.current = true;
    try {
      // Prime the UI with any prior state.
      await pollStatus();

      while (!stopRef.current) {
        const res = await runAutorunTick({ data: { draftId } });
        // Re-sync the UI from persisted phase log.
        const s = await pollStatus();

        if (res.done || s.done) {
          if (s.studyId) setTimeout(() => onDone(s.studyId!), 600);
          break;
        }
        if (s.canceled || s.status === "canceled") break;
        if (res.state === "failed" || s.status === "failed") break;
        if ((res as { locked?: boolean }).locked) {
          // Another tick is holding the lock — wait it out.
          await new Promise((r) => setTimeout(r, 3_000));
          continue;
        }
        // Tiny yield so React can paint the intermediate state.
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch (e) {
      setStatusMsg((e as Error).message);
      setStatus("failed");
    } finally {
      tickingRef.current = false;
    }
  }

  async function start() {
    stopRef.current = false;
    // Guard: no point hitting the server if the draft has no brief.
    if (!briefRaw?.trim()) {
      setStatus("queued");
      setStatusMsg("Waiting for brief — add a brief to start auto-run");
      return;
    }
    await startAutorun({ data: { draftId } });
    await tickLoop();
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
    return () => { stopRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRetry() {
    stopRef.current = false;
    await tickLoop();
  }

  async function handleCancel() {
    stopRef.current = true;
    try { await cancelAutorun({ data: { draftId } }); } catch { /* noop */ }
    onCancel();
  }

  const anyFailed = rows.some((r) => r.state === "failed") || status === "failed";
  const allDoneOrSkipped = rows.every((r) => r.state === "done" || r.state === "skipped");
  const running = status === "running" || tickingRef.current;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center border border-ink-950 bg-ink-950 text-paper-0">
          <Rocket size={16} />
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Auto-run</p>
          <h3 className="font-serif text-xl text-ink-950">Building the full study end-to-end</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">
            Server-driven, resumable. Safe to close this tab — progress persists and continues on refresh.
          </p>
        </div>
      </header>

      {!briefRaw?.trim() && status === "queued" && (
        <div className="mt-6 border border-amber-400 bg-amber-50 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-800">Waiting for brief</p>
          <p className="mt-1 text-[12px] text-ink-800">
            This auto-run is queued, but the draft has no brief yet. Add a brief first and the runner will take it from there.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onNeedBrief}
              className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700"
            >
              <FileText size={12} /> Back to brief
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="border border-line-200 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
            >
              Close & keep draft
            </button>
          </div>
        </div>
      )}

      <ol className="mt-6 space-y-2">
        {rows.map((r, i) => (
          <li
            key={r.id}
            className={`flex items-start gap-3 border p-3 transition ${
              r.state === "running"
                ? "border-ink-950 bg-paper-50"
                : r.state === "failed"
                  ? "border-rose-500 bg-rose-50/40"
                  : r.state === "done"
                    ? "border-line-200 bg-paper-0"
                    : r.state === "skipped"
                      ? "border-dashed border-line-200 bg-paper-0"
                      : "border-line-200 bg-paper-0"
            }`}
          >
            <span
              className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center border ${
                r.state === "done" || r.state === "skipped"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : r.state === "failed"
                    ? "border-rose-500 bg-rose-100 text-rose-600"
                    : r.state === "running"
                      ? "border-ink-950 bg-ink-950 text-paper-0"
                      : "border-line-200 text-ink-500"
              }`}
              aria-hidden="true"
            >
              {r.state === "running" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : r.state === "done" || r.state === "skipped" ? (
                <Check size={13} />
              ) : r.state === "failed" ? (
                <AlertTriangle size={13} />
              ) : (
                <span className="font-mono text-[10px]">{i + 1}</span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-sm text-ink-950">{r.label}</span>
                {r.state === "skipped" && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">Already done</span>
                )}
                {r.state === "running" && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-700">Running…</span>
                )}
                {r.state === "failed" && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-rose-600">Failed</span>
                )}
                {typeof r.durationMs === "number" && r.state !== "pending" && r.state !== "running" && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                    {(r.durationMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-ink-500">{r.detail}</p>
              {r.summary && (
                <p className="mt-1 text-[12px] text-ink-700">{r.summary}</p>
              )}
              {r.error && (
                <p className="mt-1 text-[11px] text-rose-600">{r.error}</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {statusMsg && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          {statusMsg}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="border border-line-200 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
        >
          Close & keep draft
        </button>
        <div className="flex items-center gap-2">
          {anyFailed && !running && (
            <button
              type="button"
              onClick={() => { void handleRetry(); }}
              className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700"
            >
              <RotateCcw size={12} /> Retry from failed step
            </button>
          )}
          {studyId && allDoneOrSkipped && (
            <button
              type="button"
              onClick={() => onDone(studyId)}
              className="inline-flex items-center gap-1.5 border border-emerald-700 bg-emerald-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:bg-emerald-800"
            >
              Open study <Rocket size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
