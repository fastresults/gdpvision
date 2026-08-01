// Chamber 07 · Program Brief intake — required first screen for every
// research program. No segments, studies, or auto-run are allowed to run
// until the admin has captured (type / dictate / upload), enriched, and
// confirmed the brief.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, FileText, Loader2, Lock, Sparkles } from "lucide-react";

import { MultimodalInput, type WizardUpload } from "./MultimodalInput";
import { PrettyJson } from "@/components/data/PrettyJson";
import {
  commitProjectBrief,
  enrichProjectBrief,
  getProjectBrief,
  saveProjectBrief,
} from "@/lib/personas/project-brief.functions";

type Props = {
  code: string;
  projectId: string;
  onCommitted?: () => void;
};

const GUIDED_PROMPTS: { title: string; body: string }[] = [
  { title: "Decision", body: "What decision does this research need to inform? Who will act on it?" },
  { title: "Audience", body: "Who are we listening to — segments, geographies, roles, income bands?" },
  { title: "Hypotheses", body: "What do you believe today, and what would falsify it?" },
  { title: "Timeframe & scope", body: "By when do you need this? Which geographies, sectors, or channels are in scope?" },
  { title: "Sensitivities", body: "Any political, reputational or diplomatic issues to handle carefully." },
  { title: "Source material", body: "Attach the RFP, prior study, cabinet memo, or media clippings that seed this work." },
];

export function ProgramBriefIntake({ code, projectId, onCommitted }: Props) {
  const qc = useQueryClient();
  const briefQ = useQuery({
    queryKey: ["program-brief", projectId],
    queryFn: () => getProjectBrief({ data: { projectId } }),
  });

  const [text, setText] = useState("");
  const [briefSource, setBriefSource] = useState<WizardUpload | null>(null);
  const [uploads, setUploads] = useState<WizardUpload[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate local state once when the brief loads.
  useEffect(() => {
    if (hydrated || !briefQ.data) return;
    setText(briefQ.data.brief_raw ?? "");
    setBriefSource((briefQ.data.brief_source as WizardUpload | null) ?? null);
    setUploads(Array.isArray(briefQ.data.brief_uploads) ? (briefQ.data.brief_uploads as WizardUpload[]) : []);
    setHydrated(true);
  }, [briefQ.data, hydrated]);

  // Autosave (800ms debounce).
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      saveProjectBrief({
        data: { projectId, brief_raw: text, brief_source: briefSource, brief_uploads: uploads },
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [projectId, text, briefSource, uploads, hydrated]);

  const scope = briefQ.data?.brief_scope ?? null;
  const totalChars = useMemo(
    () =>
      text.trim().length +
      (briefSource?.excerpt?.length ?? 0) +
      uploads.reduce((s, u) => s + (u.excerpt?.length ?? 0), 0),
    [text, briefSource, uploads],
  );
  const meetsMinimum = totalChars >= 40;

  const enrich = useMutation({
    mutationFn: async () => {
      setError(null);
      // Flush pending edits before enrichment reads the row.
      await saveProjectBrief({
        data: { projectId, brief_raw: text, brief_source: briefSource, brief_uploads: uploads },
      });
      return enrichProjectBrief({ data: { projectId } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["program-brief", projectId] }),
    onError: (e) => setError((e as Error).message),
  });

  const commit = useMutation({
    mutationFn: async () => {
      setError(null);
      await saveProjectBrief({
        data: { projectId, brief_raw: text, brief_source: briefSource, brief_uploads: uploads },
      });
      return commitProjectBrief({ data: { projectId } });
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["program-brief", projectId] }),
        qc.invalidateQueries({ queryKey: ["persona-projects", code] }),
      ]);
      onCommitted?.();
    },
    onError: (e) => setError((e as Error).message),
  });

  if (briefQ.isLoading) {
    return (
      <div className="flex items-center gap-2 border border-line-200 bg-paper-50 p-6 text-sm text-ink-500">
        <Loader2 size={14} className="animate-spin" /> Loading brief…
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <header className="border border-ink-950 bg-paper-0 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 border border-ink-950 bg-ink-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0">
            <Lock size={10} /> Stage 00 · Required
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {code} · {briefQ.data?.title ?? "New program"}
          </span>
        </div>
        <h2 className="mt-2 font-serif text-2xl leading-tight text-ink-950">
          Capture the brief before any research runs
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-700">
          This is an academic and survey process. Type, dictate, or upload the source material that
          frames the study. The AI will convert it into a structured Research Scope; nothing casts,
          groups or rehearses until you confirm.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Intake rail */}
        <div className="min-w-0 space-y-3 border border-line-200 bg-paper-0 p-4">
          <div className="flex items-center gap-2">
            <FileText size={13} className="text-ink-500" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Intake · type · dictate · upload
            </p>
          </div>
          <div className="border border-ink-950 bg-paper-50 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Source brief · one only · governs the scope
            </p>
            {briefSource ? (
              <div className="mt-2 flex items-center gap-2 text-[12.5px] text-ink-950">
                <FileText size={12} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{briefSource.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setUploads((list) => [...list, briefSource]);
                    setBriefSource(null);
                  }}
                  className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500 hover:text-ink-950"
                >
                  Demote to context
                </button>
              </div>
            ) : (
              <p className="mt-2 text-[12px] text-ink-700">
                None set — upload the governing document below, then mark it as the source brief.
                Everything else stays supporting context.
              </p>
            )}
          </div>
          <MultimodalInput
            countryCode={code}
            value={text}
            onChange={setText}
            onUpload={(u) => setUploads((prev) => [...prev, u])}
            uploads={uploads}
            placeholder="What are you trying to learn, decide, or defend? Who does it affect? What changed?"
            rows={12}
          />
          {uploads.length > 0 && (
            <ul className="space-y-1">
              {uploads.map((u, i) => (
                <li
                  key={`${u.path}-${i}`}
                  className="flex items-center gap-2 border border-line-200 px-2.5 py-1.5 text-[12px] text-ink-700"
                >
                  <FileText size={12} className="shrink-0 text-ink-300" />
                  <span className="min-w-0 flex-1 truncate text-ink-950">{u.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUploads((list) => {
                        const rest = list.filter((_, idx) => idx !== i);
                        return briefSource ? [...rest, briefSource] : rest;
                      });
                      setBriefSource(u);
                    }}
                    className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500 hover:text-ink-950"
                  >
                    Make source brief
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            <span className={meetsMinimum ? "text-emerald-700" : "text-amber-700"}>
              {totalChars} chars
            </span>{" "}
            · minimum 40 to enrich · autosaves
          </p>
        </div>

        {/* Guided prompts */}
        <aside className="min-w-0 space-y-3 border border-line-200 bg-paper-50 p-4">
          <div className="flex items-center gap-2">
            <ClipboardList size={13} className="text-ink-500" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              What the AI will look for
            </p>
          </div>
          <ul className="space-y-3">
            {GUIDED_PROMPTS.map((p) => (
              <li key={p.title}>
                <p className="font-serif text-[13px] leading-tight text-ink-950">{p.title}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-ink-700">{p.body}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* Enriched scope preview */}
      {scope && (
        <section className="border border-emerald-600/40 bg-emerald-50/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-700" />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-800">
                Research Scope · enriched
              </p>
            </div>
            <button
              type="button"
              onClick={() => enrich.mutate()}
              disabled={enrich.isPending || !meetsMinimum}
              className="inline-flex items-center gap-1.5 border border-emerald-700 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-800 hover:bg-emerald-700 hover:text-paper-0 disabled:opacity-40"
            >
              {enrich.isPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              Re-enrich
            </button>
          </div>
          <div className="mt-3">
            <PrettyJson value={scope as never} />
          </div>
        </section>
      )}

      {/* Action bar */}
      <footer className="flex flex-wrap items-center gap-3 border-t border-line-200 pt-4">
        {!scope && (
          <button
            type="button"
            onClick={() => enrich.mutate()}
            disabled={enrich.isPending || !meetsMinimum}
            className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
          >
            {enrich.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {enrich.isPending ? "Enriching…" : "Enrich into Research Scope"}
          </button>
        )}
        <button
          type="button"
          onClick={() => commit.mutate()}
          disabled={commit.isPending || !scope || !meetsMinimum}
          className="inline-flex items-center gap-1.5 border border-emerald-700 bg-emerald-700 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-emerald-800 disabled:opacity-40"
          title={
            !scope
              ? "Enrich the brief first"
              : !meetsMinimum
                ? "Brief too short"
                : "Lock the brief and unlock the Cast / Group / Rehearse stages"
          }
        >
          {commit.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          {commit.isPending ? "Committing…" : "Confirm brief & open workspace"}
        </button>
        <p className="text-[11px] leading-snug text-ink-500">
          Committing locks the brief for this program. You can still add later addenda from the
          program header.
        </p>
        {error && <p className="w-full text-[12px] text-rose-600">{error}</p>}
      </footer>
    </section>
  );
}
