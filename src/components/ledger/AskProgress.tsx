// Beautiful phased loader for Ask-the-Ledger. Time-driven with real reconciliation
// on completion (grounded/extended_with_research). No streaming dependency.

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";

export type PhaseId = "corpus" | "country" | "web" | "synthesize";
export type PhaseStatus = "pending" | "active" | "done" | "skipped";

interface Phase {
  id: PhaseId;
  label: string;
  hint: string[];
  status: PhaseStatus;
}

const PHASE_HINTS: Record<PhaseId, string[]> = {
  corpus: [
    "Ranking corpus chunks by semantic + keyword relevance…",
    "Selecting top-8 grounded excerpts…",
    "Cross-checking passage embeddings…",
  ],
  country: [
    "Anchoring to KPIs, sector dossiers & ministries…",
    "Pulling whole-country context…",
    "Threading capital-flow ledger…",
  ],
  web: [
    "Escalating to McKinsey-grade web research…",
    "Consulting IMF, World Bank, ECCB & national stats…",
    "Ranking authoritative citations…",
  ],
  synthesize: [
    "Drafting Situation → Answer → Evidence → So-What…",
    "Cross-checking every [N] citation…",
    "Grading confidence & pruning orphan sources…",
  ],
};

function estimateEtaMs(question: string): number {
  const words = question.trim().split(/\s+/).length;
  const q = question.toLowerCase();
  const complexKw = ["scenario", "24-month", "24 month", "if we", "prioritize", "triage", "policy", "plan", "make up", "compare", "forecast", "project"];
  const hits = complexKw.filter((k) => q.includes(k)).length;
  if (words > 40 || hits >= 2) return 75_000;
  if (words > 18 || hits >= 1) return 40_000;
  return 18_000;
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function AskProgress({
  question,
  onCancel,
  finalized,
}: {
  question: string;
  onCancel?: () => void;
  // When the answer resolves, pass reconciliation info so the loader tells the truth.
  finalized?: { web: boolean } | null;
}) {
  const startedAt = useMemo(() => Date.now(), [question]);
  const etaMs = useMemo(() => estimateEtaMs(question), [question]);
  const [now, setNow] = useState(() => Date.now());
  const [hintIndex, setHintIndex] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setHintIndex((i) => i + 1), 2500);
    return () => clearInterval(iv);
  }, []);

  const elapsed = now - startedAt;
  // Time buckets → phase advancement. Web is speculative until finalized.
  const corpusDone = elapsed > 2200;
  const countryActive = elapsed > 2200;
  const countryDone = elapsed > 5800;
  // Web phase only "lights up" past ~10s AND (still running OR finalized web:true)
  const webActive = elapsed > 9500 && (!finalized || finalized.web);
  const webDone = finalized ? finalized.web : elapsed > 20_000;
  const webSkipped = !!finalized && !finalized.web;
  const synthActive = webDone || webSkipped || elapsed > 22_000;

  const phases: Phase[] = [
    {
      id: "corpus",
      label: "Searching corpus",
      hint: PHASE_HINTS.corpus,
      status: corpusDone ? "done" : "active",
    },
    {
      id: "country",
      label: "Reading country context",
      hint: PHASE_HINTS.country,
      status: countryDone ? "done" : countryActive ? "active" : "pending",
    },
    {
      id: "web",
      label: "Deep web research",
      hint: PHASE_HINTS.web,
      status: webSkipped
        ? "skipped"
        : webDone
          ? "done"
          : webActive
            ? "active"
            : "pending",
    },
    {
      id: "synthesize",
      label: "Synthesizing McKinsey-style answer",
      hint: PHASE_HINTS.synthesize,
      status: synthActive ? "active" : "pending",
    },
  ];

  const completed = phases.filter((p) => p.status === "done" || p.status === "skipped").length;
  const pct = Math.min(97, Math.round((completed / phases.length) * 100) + (phases.some((p) => p.status === "active") ? 8 : 0));

  const activePhase = phases.find((p) => p.status === "active");
  const rotatingHint = activePhase
    ? activePhase.hint[hintIndex % activePhase.hint.length]
    : "Preparing…";

  const etaLabel = elapsed < etaMs ? `est. ~${Math.round(etaMs / 1000)}s` : "any moment now…";

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-in border border-line-200 bg-paper-50/60 px-3 py-3"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Grounding your question
        </p>
        <span className="font-mono text-[10px] tabular-nums tracking-wider text-ink-700">
          {fmt(elapsed)} · {etaLabel}
        </span>
      </div>

      <ol className="space-y-2">
        {phases.map((p) => (
          <li key={p.id} className="flex items-start gap-2.5">
            <PhaseDot status={p.status} />
            <div className="min-w-0 flex-1">
              <p
                className={`text-[12px] font-medium leading-tight ${
                  p.status === "done"
                    ? "text-ink-950"
                    : p.status === "active"
                      ? "text-ink-950"
                      : p.status === "skipped"
                        ? "text-ink-500/70 line-through"
                        : "text-ink-500"
                }`}
              >
                {p.label}
              </p>
              {p.status === "active" && (
                <p className="mt-0.5 animate-fade-in text-[11px] text-ink-500">{rotatingHint}</p>
              )}
              {p.status === "skipped" && (
                <p className="mt-0.5 text-[11px] italic text-ink-500/70">
                  Not needed — corpus was sufficient
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-3 h-1 w-full overflow-hidden bg-line-200">
        <div
          className="h-full bg-ink-950 transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {elapsed > 30_000 && (
        <p className="mt-2 animate-fade-in text-[11px] italic text-ink-500">
          Complex questions may take up to 90 seconds. Your research is being grounded in the corpus.
        </p>
      )}

      {onCancel && elapsed > 8_000 && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-ink-950"
          >
            Stop
          </button>
        </div>
      )}
    </div>
  );
}

function PhaseDot({ status }: { status: PhaseStatus }) {
  if (status === "done")
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink-950 bg-ink-950 text-paper-0">
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    );
  if (status === "active")
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-ink-950" />
      </span>
    );
  if (status === "skipped")
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <span className="h-2 w-2 rounded-full border border-dashed border-ink-500/60" />
      </span>
    );
  return (
    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
      <span className="h-2 w-2 rounded-full border border-line-200 bg-paper-0" />
    </span>
  );
}
