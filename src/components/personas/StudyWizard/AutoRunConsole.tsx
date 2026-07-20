// Chamber 07 · Research Studio · Auto-run console — brief → outcome → cast → commit → synthesis.
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Rocket, RotateCcw } from "lucide-react";

import {
  commitStudy, draftCast, enrichBrief, enrichOutcome, getDraft, saveDraft,
} from "@/lib/personas/wizard.functions";
import { draftStudyQuestions, runStudy } from "@/lib/personas/study.functions";

export type AutoRunPhaseId = "brief" | "outcome" | "cast" | "commit" | "synthesis";

type PhaseState = "pending" | "running" | "done" | "failed" | "skipped";

type PhaseRow = {
  id: AutoRunPhaseId;
  label: string;
  detail: string;
  state: PhaseState;
  summary?: string;
  error?: string;
};

const PHASES: Array<{ id: AutoRunPhaseId; label: string; detail: string }> = [
  { id: "brief",     label: "Enrich the brief",     detail: "Turn the raw brief into a McKinsey Research Scope." },
  { id: "outcome",   label: "Blueprint deliverables", detail: "Scaffold + AI-refined SCQA memo, stakeholder map, survey, guide, readout." },
  { id: "cast",      label: "Cast personas & instruments", detail: "Corpus-first with open-web deep research for gaps." },
  { id: "commit",    label: "Commit to workspace",  detail: "Persist study, personas, segments, instruments, evidence ledger." },
  { id: "synthesis", label: "Run synthetic analysis", detail: "Draft questions, generate per-persona responses, synthesize themes." },
];

// Sensible, broad defaults for a one-click Cabinet-grade run.
const DEFAULT_DELIVERABLES = [
  "scqa_memo", "stakeholder_map", "segment_matrix",
  "focus_group_guide", "survey", "exec_readout",
];

type Props = {
  draftId: string;
  countryCode: string;
  onDone: (studyId: string) => void;
  onCancel: () => void;
};

export function AutoRunConsole({ draftId, countryCode, onDone, onCancel }: Props) {
  const [rows, setRows] = useState<PhaseRow[]>(
    PHASES.map((p) => ({ ...p, state: "pending" })),
  );
  const [running, setRunning] = useState(false);
  const [studyId, setStudyId] = useState<string | null>(null);
  const startedRef = useRef(false);

  const patchRow = (id: AutoRunPhaseId, patch: Partial<PhaseRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function persistStatus(id: AutoRunPhaseId, state: PhaseState, message?: string) {
    try {
      await saveDraft({
        data: {
          id: draftId,
          patch: {
            autorun_status: { phase: id, state, message: message ?? null, ts: new Date().toISOString() },
          },
        },
      });
    } catch { /* non-fatal */ }
  }

  async function runOnce() {
    if (running) return;
    setRunning(true);

    try {
      const draft = await getDraft({ data: { id: draftId } });

      // Phase 1 · brief
      if (draft.brief_scope) {
        patchRow("brief", { state: "skipped", summary: "Scope already enriched." });
      } else {
        patchRow("brief", { state: "running" });
        await persistStatus("brief", "running");
        const raw = (draft.brief_raw ?? "").trim();
        if (raw.length < 3) throw new Error("Draft has no brief text. Type or upload a brief first.");
        try {
          const res = await enrichBrief({ data: { draftId, countryCode, raw: raw.slice(0, 20000) } });
          patchRow("brief", {
            state: "done",
            summary: `${res.scope.title.slice(0, 80)} · ${res.scope.objectives?.length ?? 0} objectives`,
          });
          await persistStatus("brief", "done");
        } catch (e) {
          patchRow("brief", { state: "failed", error: (e as Error).message });
          await persistStatus("brief", "failed", (e as Error).message);
          throw e;
        }
      }

      // Phase 2 · outcome
      const draft2 = await getDraft({ data: { id: draftId } });
      const bp = draft2.outcome_blueprint as { deliverables?: unknown[]; ai_status?: string } | null;
      if (bp?.deliverables?.length && bp.ai_status !== "scaffold_only") {
        patchRow("outcome", { state: "skipped", summary: `${bp.deliverables.length} deliverables ready.` });
      } else {
        patchRow("outcome", { state: "running" });
        await persistStatus("outcome", "running");
        try {
          const res = await enrichOutcome({
            data: {
              draftId, countryCode,
              selectedCodes: DEFAULT_DELIVERABLES,
              tone: "cabinet",
            },
          });
          const status = res.blueprint.ai_status ?? "enriched";
          patchRow("outcome", {
            state: "done",
            summary: `${res.blueprint.deliverables.length} deliverables · ${status}`,
          });
          await persistStatus("outcome", "done", status);
        } catch (e) {
          patchRow("outcome", { state: "failed", error: (e as Error).message });
          await persistStatus("outcome", "failed", (e as Error).message);
          throw e;
        }
      }

      // Phase 3 · cast
      const draft3 = await getDraft({ data: { id: draftId } });
      const cast = draft3.cast_draft as { personas?: unknown[]; segments?: unknown[]; instruments?: unknown[] } | null;
      if (cast?.personas?.length) {
        patchRow("cast", {
          state: "skipped",
          summary: `${cast.personas.length} personas · ${cast.segments?.length ?? 0} segments · ${cast.instruments?.length ?? 0} instruments`,
        });
      } else {
        patchRow("cast", { state: "running" });
        await persistStatus("cast", "running");
        try {
          const res = await draftCast({
            data: { draftId, countryCode, personaCount: 8, segmentCount: 4, allowDeepResearch: true },
          });
          patchRow("cast", {
            state: "done",
            summary: `${res.cast.personas.length} personas · ${res.cast.segments.length} segments · ${res.cast.instruments.length} instruments · ${res.cast.deep_research.length} deep-research passes`,
          });
          await persistStatus("cast", "done");
        } catch (e) {
          patchRow("cast", { state: "failed", error: (e as Error).message });
          await persistStatus("cast", "failed", (e as Error).message);
          throw e;
        }
      }

      // Phase 4 · commit
      const draft4 = await getDraft({ data: { id: draftId } });
      let committedStudyId: string | null = (draft4 as { study_id?: string | null }).study_id ?? null;
      if (committedStudyId) {
        patchRow("commit", { state: "skipped", summary: "Study already committed." });
      } else {
        patchRow("commit", { state: "running" });
        await persistStatus("commit", "running");
        try {
          const res = await commitStudy({ data: { draftId, countryCode, visibility: "private" } });
          committedStudyId = res.studyId;
          patchRow("commit", { state: "done", summary: `Study committed · ${res.personaCount} personas persisted` });
          await persistStatus("commit", "done");
        } catch (e) {
          patchRow("commit", { state: "failed", error: (e as Error).message });
          await persistStatus("commit", "failed", (e as Error).message);
          throw e;
        }
      }
      setStudyId(committedStudyId);

      // Phase 5 · synthesis
      patchRow("synthesis", { state: "running" });
      await persistStatus("synthesis", "running");
      try {
        await draftStudyQuestions({ data: { studyId: committedStudyId!, count: 8 } });
        await runStudy({ data: { studyId: committedStudyId! } });
        patchRow("synthesis", { state: "done", summary: "Questions drafted · responses generated · brief synthesized" });
        await persistStatus("synthesis", "done");
      } catch (e) {
        patchRow("synthesis", { state: "failed", error: (e as Error).message });
        await persistStatus("synthesis", "failed", (e as Error).message);
        // Synthesis failure isn't fatal — study exists. Surface but allow open.
      }

      // Give the user a beat to see the green checks before navigating.
      setTimeout(() => onDone(committedStudyId!), 800);
    } catch { /* halted at failing phase — user can retry */ }
    finally { setRunning(false); }
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anyFailed = rows.some((r) => r.state === "failed");
  const allDoneOrSkipped = rows.every((r) => r.state === "done" || r.state === "skipped");

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
            Brief → deliverable blueprint → cast → commit → synthetic analysis. Powered by corpus-first AI with open-web fallback.
          </p>
        </div>
      </header>

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

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="border border-line-200 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
        >
          Close & keep draft
        </button>
        <div className="flex items-center gap-2">
          {anyFailed && !running && (
            <button
              type="button"
              onClick={() => { void runOnce(); }}
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
