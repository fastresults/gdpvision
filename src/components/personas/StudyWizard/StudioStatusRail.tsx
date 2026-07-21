// Live studio status rail for Chamber 07 · Stage 03.
// Replaces the old empty "Study preview" card with an at-a-glance panel
// showing pipeline health, live counts, latest synthesis, and resume actions.

import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Brain, CheckCircle2, Loader2, RotateCcw } from "lucide-react";

type Study = {
  id: string;
  title: string;
  status?: string | null;
  updated_at?: string | null;
};
type Segment = { id: string };
type DigestItem = {
  id: string;
  title: string;
  segment_label?: string | null;
  synthesized_at?: string | null;
};

type Phase = "idle" | "running" | "complete" | "cancelled";

interface Props {
  code: string;
  studies: Study[];
  segments: Segment[];
  digest: DigestItem[];
  autoPhase: Phase;
  autoDetail?: string;
  onResume: () => void;
  resumeDisabled?: boolean;
}

export function StudioStatusRail({
  code,
  studies,
  segments,
  digest,
  autoPhase,
  autoDetail,
  onResume,
  resumeDisabled,
}: Props) {
  const done = studies.filter((s) => s.status === "synthesized" || s.status === "complete");
  const running = studies.filter((s) => s.status === "running");
  const drafts = studies.filter(
    (s) => s.status !== "synthesized" && s.status !== "complete" && s.status !== "running",
  );
  const incomplete = drafts.length + running.length;
  const total = studies.length;
  const pct = total > 0 ? Math.round((done.length / total) * 100) : 0;

  const health =
    autoPhase === "running"
      ? { label: "Auto-run in progress", tone: "running" as const }
      : incomplete > 0
        ? { label: "Incomplete studies", tone: "warn" as const }
        : total > 0
          ? { label: "All studies synthesized", tone: "ok" as const }
          : { label: "Awaiting first study", tone: "idle" as const };

  const latest = digest[0];

  return (
    <aside className="lg:sticky lg:top-4 lg:self-start space-y-4">
      {/* Health */}
      <div className="border border-line-200 bg-paper-0 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Studio status
        </p>
        <div className="mt-2 flex items-center gap-2">
          <StatusDot tone={health.tone} />
          <p className="font-serif text-[15px] leading-tight text-ink-950">{health.label}</p>
        </div>
        {autoDetail && (
          <p className="mt-1 truncate text-[11px] text-ink-700" title={autoDetail}>
            {autoDetail}
          </p>
        )}
        {total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
              <span>Progress</span>
              <span>
                {done.length}/{total}
              </span>
            </div>
            <div className="mt-1 h-[3px] w-full overflow-hidden bg-line-200">
              <div
                className={`h-full transition-[width] duration-500 ${
                  autoPhase === "running" ? "bg-ink-950" : pct === 100 ? "bg-emerald-600" : "bg-amber-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Counts */}
      <div className="border border-line-200 bg-paper-0">
        <div className="grid grid-cols-3 divide-x divide-line-200">
          <Count label="Drafts" n={drafts.length} />
          <Count label="Running" n={running.length} accent={running.length > 0 ? "ink" : undefined} />
          <Count label="Synthesized" n={done.length} accent={done.length > 0 ? "ok" : undefined} />
        </div>
        <div className="border-t border-line-200 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
          {segments.length} segment{segments.length === 1 ? "" : "s"} · {total} stud
          {total === 1 ? "y" : "ies"}
        </div>
      </div>

      {/* Latest synthesis */}
      {latest && (
        <div className="border border-line-200 bg-paper-0 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Latest synthesis
          </p>
          <p className="mt-2 font-serif text-[14px] leading-tight text-ink-950 line-clamp-2">
            {latest.title}
          </p>
          {latest.segment_label && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
              {latest.segment_label}
            </p>
          )}
          <Link
            to="/admin/countries/$code/personas/studies/$id"
            params={{ code, id: latest.id }}
            className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 underline underline-offset-2 hover:opacity-70"
          >
            Open report <ArrowRight size={11} />
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onResume}
          disabled={resumeDisabled || incomplete === 0}
          className="inline-flex w-full items-center justify-center gap-1.5 border border-ink-950 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw size={11} />{" "}
          {resumeDisabled
            ? "Auto-run in progress"
            : incomplete > 0
              ? `Resume ${incomplete} incomplete`
              : "Nothing to resume"}
        </button>
        <Link
          to="/admin/countries/$code/data"
          params={{ code }}
          className="inline-flex w-full items-center justify-center gap-1.5 border border-line-200 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:border-ink-950 hover:text-ink-950"
        >
          <Brain size={11} /> Open second brain
        </Link>
      </div>
    </aside>
  );
}

function StatusDot({ tone }: { tone: "ok" | "warn" | "running" | "idle" }) {
  if (tone === "running")
    return <Loader2 size={13} className="animate-spin text-ink-950" aria-hidden="true" />;
  if (tone === "warn")
    return <AlertTriangle size={13} className="text-amber-600" aria-hidden="true" />;
  if (tone === "ok")
    return <CheckCircle2 size={13} className="text-emerald-600" aria-hidden="true" />;
  return <span className="inline-block h-2 w-2 rounded-full bg-ink-300" aria-hidden="true" />;
}

function Count({
  label,
  n,
  accent,
}: {
  label: string;
  n: number;
  accent?: "ok" | "ink";
}) {
  return (
    <div className="px-3 py-3 text-center">
      <p
        className={`font-serif text-2xl tabular-nums ${
          accent === "ok" ? "text-emerald-700" : accent === "ink" ? "text-ink-950" : "text-ink-950"
        }`}
      >
        {n}
      </p>
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">{label}</p>
    </div>
  );
}
