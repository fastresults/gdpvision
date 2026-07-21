// Chamber 07 · Blueprint review canvas.
// AI-first: composes a full research plan (segments + persona counts + studies)
// from the committed brief. Admin refines and approves. On approval, we
// client-drive segment generation (via `generateSegment`) and land on Studies
// where the existing autorun pipeline finishes the work.

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  approveBlueprint,
  composeBlueprint,
  getBlueprint,
  saveBlueprint,
  suggestBriefAdditions,
  type Blueprint,
  type StudyKind,
} from "@/lib/personas/blueprint.functions";
import { generateSegment, listSegments } from "@/lib/personas/generate.functions";
import { saveProjectBrief, getProjectBrief } from "@/lib/personas/project-brief.functions";

const KIND_LABEL: Record<StudyKind, string> = {
  survey: "Survey",
  focus_group: "Focus group",
  creative_test: "Creative test",
};

type Progress = { index: number; total: number; label: string; phase: "segment" | "done" };

export function BlueprintReview({ code, projectId }: { code: string; projectId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const q = useQuery({
    queryKey: ["program-blueprint", projectId],
    queryFn: () => getBlueprint({ data: { projectId } }),
  });

  const [draft, setDraft] = useState<Blueprint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const cancelRef = useRef(false);

  // Hydrate local draft when server data arrives / changes.
  useEffect(() => {
    if (q.data?.proposal) setDraft(q.data.proposal);
  }, [q.data?.proposal]);

  const [assist, setAssist] = useState<{ suggestions: string[]; missing: string[] } | null>(null);
  const [augmented, setAugmented] = useState(false);

  const compose = useMutation({
    mutationFn: async () => composeBlueprint({ data: { projectId } }),
    onSuccess: (r) => {
      if (r.status === "needs_more_brief") {
        setAssist({ suggestions: r.suggestions, missing: r.missing });
        setAugmented(false);
        return;
      }
      setAssist(null);
      setAugmented(!!r.augmented);
      setDraft(r.blueprint);
      qc.invalidateQueries({ queryKey: ["program-blueprint", projectId] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const draftAdditions = useMutation({
    mutationFn: async () => suggestBriefAdditions({ data: { projectId } }),
    onSuccess: async (r) => {
      const current = await getProjectBrief({ data: { projectId } }).catch(() => null);
      const merged = `${current?.brief_raw ?? ""}\n\n${r.text}`.trim();
      await saveProjectBrief({ data: { projectId, brief_raw: merged } });
      setAssist(null);
      compose.mutate();
    },
    onError: (e) => setError((e as Error).message),
  });

  const save = useMutation({
    mutationFn: async (b: Blueprint) => saveBlueprint({ data: { projectId, blueprint: b } }),
  });

  // Autosave draft edits (600ms debounce).
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => save.mutate(draft), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const totalPersonas = useMemo(
    () => (draft?.segments ?? []).reduce((s, x) => s + (x.size || 0), 0),
    [draft],
  );

  async function approveAndRun() {
    if (!draft) return;
    setError(null);
    setRunning(true);
    cancelRef.current = false;
    try {
      await approveBlueprint({ data: { projectId, blueprint: draft } });

      // Skip segments that already exist for this program (idempotent re-runs).
      const existing = await listSegments({ data: { countryCode: code, projectId } }).catch(() => []);
      const existingLabels = new Set((existing ?? []).map((s) => s.label));

      const targets = draft.segments.filter((s) => !existingLabels.has(s.label));
      const total = targets.length;

      for (let i = 0; i < total; i++) {
        if (cancelRef.current) break;
        const seg = targets[i];
        setProgress({ index: i + 1, total, label: seg.label, phase: "segment" });
        try {
          await generateSegment({
            data: {
              countryCode: code,
              projectId,
              prompt: seg.prompt,
              size: seg.size,
              visibility: "public",
            },
          });
        } catch (e) {
          // Non-fatal — surface once and continue with the rest.
          setError(`Segment "${seg.label}" failed: ${(e as Error).message}`);
        }
      }

      setProgress({ index: total, total, label: "", phase: "done" });
      await qc.invalidateQueries({ queryKey: ["persona-segments", code, projectId] });
      await qc.invalidateQueries({ queryKey: ["personas", code, projectId] });

      // Hand off to Rehearse — the existing autorun completes studies there.
      navigate({
        to: "/admin/countries/$code/personas/studies",
        params: { code },
        search: { project: projectId, open: 1, auto: 1 },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 border border-line-200 bg-paper-50 p-6 text-sm text-ink-500">
        <Loader2 size={14} className="animate-spin" /> Loading blueprint…
      </div>
    );
  }

  const alreadyApproved = !!q.data?.committedAt;

  return (
    <section className="space-y-5">
      <header className="border border-ink-950 bg-paper-0 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 border border-ink-950 bg-ink-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0">
            <Sparkles size={10} /> Stage 01 · Blueprint
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {code} · {q.data?.title}
          </span>
          {alreadyApproved && (
            <span className="inline-flex items-center gap-1 border border-emerald-500 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-700">
              <CheckCircle2 size={10} /> Approved
            </span>
          )}
        </div>
        <h2 className="mt-2 font-serif text-2xl leading-tight text-ink-950">
          The AI has drafted your research plan
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-700">
          Based on the committed brief, we propose which audiences to hear from and which studies to
          run. Refine anything — then approve to auto-generate personas and hand off to Rehearse.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => compose.mutate()}
            disabled={compose.isPending || running}
            className="inline-flex items-center gap-1.5 border border-ink-950 bg-paper-0 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:bg-paper-100 disabled:opacity-40"
          >
            {compose.isPending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {draft ? "Regenerate blueprint" : "Generate blueprint"}
          </button>
          {draft && (
            <button
              type="button"
              onClick={approveAndRun}
              disabled={running || compose.isPending}
              className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
            >
              {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              Approve &amp; run
            </button>
          )}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {draft ? `${draft.segments.length} segments · ${totalPersonas} personas · ${draft.studies.length} studies` : "No plan yet"}
          </span>
        </div>
      </header>

      {error && !/too short/i.test(error) && (
        <div className="flex items-start gap-2 border border-rose-300 bg-rose-50 p-3 text-[12px] text-rose-700">
          <AlertTriangle size={13} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {assist && (
        <div className="space-y-3 border border-ink-950 bg-paper-0 p-4">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-ink-950" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950">
              AI needs a little more to work with
            </p>
          </div>
          <p className="text-[13px] leading-relaxed text-ink-700">
            Your brief is very short. Either answer the prompts below and re-generate, or let the AI
            draft a starting brief-addition grounded in this country's context.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-800">
            {assist.suggestions.map((s) => <li key={s}>{s}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => draftAdditions.mutate()}
              disabled={draftAdditions.isPending || compose.isPending}
              className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
            >
              {draftAdditions.isPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              Draft brief additions with AI
            </button>
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/admin/countries/$code/personas",
                  params: { code },
                  search: { project: projectId, open: 1 },
                })
              }
              className="inline-flex items-center gap-1.5 border border-ink-950 bg-paper-0 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:bg-paper-100"
            >
              Back to brief
            </button>
          </div>
        </div>
      )}

      {augmented && draft && (
        <p className="border border-line-200 bg-paper-50 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
          Blueprint drafted from brief + country corpus
        </p>
      )}

      {running && progress && (
        <div className="border border-line-200 bg-paper-50 p-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
          {progress.phase === "done"
            ? "Handing off to Rehearse…"
            : `Casting segment ${progress.index} of ${progress.total} — ${progress.label}`}
        </div>
      )}

      {!draft && !compose.isPending && (
        <div className="border border-dashed border-line-200 bg-paper-0 p-6 text-center">
          <Sparkles size={16} className="mx-auto text-ink-500" />
          <p className="mt-2 font-serif text-base text-ink-950">Generate your research blueprint</p>
          <p className="mt-1 text-[12px] text-ink-500">
            The AI will read your brief and propose segments and studies.
          </p>
        </div>
      )}

      {draft && (
        <>
          {draft.summary && (
            <p className="border border-line-200 bg-paper-0 p-4 font-serif text-[15px] leading-relaxed text-ink-800">
              {draft.summary}
            </p>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Segments */}
            <div className="min-w-0 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  <Layers size={11} className="mr-1 inline" /> Segments
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      segments: [
                        ...draft.segments,
                        { label: "New segment", prompt: "Describe the audience", size: 8, rationale: "", priority: 3 },
                      ],
                    })
                  }
                  className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500 hover:text-ink-950"
                >
                  + Add segment
                </button>
              </div>
              {draft.segments.map((seg, idx) => (
                <details
                  key={idx}
                  open
                  className="group border border-line-200 bg-paper-0"
                >
                  <summary className="flex cursor-pointer items-center gap-2 border-b border-line-200 px-3 py-2">
                    <ChevronDown size={12} className="text-ink-500 transition group-open:rotate-0 -rotate-90" />
                    <input
                      value={seg.label}
                      onChange={(e) => {
                        const next = [...draft.segments];
                        next[idx] = { ...seg, label: e.target.value };
                        setDraft({ ...draft, segments: next });
                      }}
                      className="flex-1 border-0 bg-transparent font-serif text-[15px] text-ink-950 focus:outline-none"
                    />
                    <label className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                      Size
                      <input
                        type="number"
                        min={4}
                        max={12}
                        value={seg.size}
                        onChange={(e) => {
                          const next = [...draft.segments];
                          next[idx] = { ...seg, size: Math.max(4, Math.min(12, Number(e.target.value) || 8)) };
                          setDraft({ ...draft, segments: next });
                        }}
                        className="w-12 border border-line-200 bg-paper-0 px-1 py-0.5 text-right font-mono text-[11px] tabular-nums"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setDraft({
                          ...draft,
                          segments: draft.segments.filter((_, i) => i !== idx),
                          studies: draft.studies.filter((s) => s.segment_label !== seg.label),
                        });
                      }}
                      className="text-ink-500 hover:text-rose-600"
                      aria-label="Remove segment"
                    >
                      <Trash2 size={12} />
                    </button>
                  </summary>
                  <div className="space-y-2 p-3">
                    <textarea
                      value={seg.prompt}
                      onChange={(e) => {
                        const next = [...draft.segments];
                        next[idx] = { ...seg, prompt: e.target.value };
                        setDraft({ ...draft, segments: next });
                      }}
                      rows={2}
                      placeholder="Persona-generator brief"
                      className="w-full border border-line-200 bg-paper-0 p-2 text-[12px] focus:border-ink-950 focus:outline-none"
                    />
                    <textarea
                      value={seg.rationale ?? ""}
                      onChange={(e) => {
                        const next = [...draft.segments];
                        next[idx] = { ...seg, rationale: e.target.value };
                        setDraft({ ...draft, segments: next });
                      }}
                      rows={2}
                      placeholder="Why this segment matters"
                      className="w-full border border-line-200 bg-paper-0 p-2 text-[12px] italic text-ink-700 focus:border-ink-950 focus:outline-none"
                    />
                  </div>
                </details>
              ))}
            </div>

            {/* Studies */}
            <div className="min-w-0 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  Studies
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      studies: [
                        ...draft.studies,
                        {
                          segment_label: draft.segments[0]?.label ?? "",
                          kind: "survey",
                          title: "New study",
                          objective: "Describe the objective",
                        },
                      ],
                    })
                  }
                  className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500 hover:text-ink-950"
                >
                  + Add study
                </button>
              </div>
              {draft.studies.map((st, idx) => (
                <div key={idx} className="space-y-2 border border-line-200 bg-paper-0 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={st.title}
                      onChange={(e) => {
                        const next = [...draft.studies];
                        next[idx] = { ...st, title: e.target.value };
                        setDraft({ ...draft, studies: next });
                      }}
                      className="flex-1 border-0 bg-transparent font-serif text-[14px] text-ink-950 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          studies: draft.studies.filter((_, i) => i !== idx),
                        })
                      }
                      className="text-ink-500 hover:text-rose-600"
                      aria-label="Remove study"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-0.5">
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">Segment</span>
                      <select
                        value={st.segment_label}
                        onChange={(e) => {
                          const next = [...draft.studies];
                          next[idx] = { ...st, segment_label: e.target.value };
                          setDraft({ ...draft, studies: next });
                        }}
                        className="border border-line-200 bg-paper-0 px-2 py-1 text-[12px] focus:border-ink-950 focus:outline-none"
                      >
                        {draft.segments.map((s) => (
                          <option key={s.label} value={s.label}>{s.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">Method</span>
                      <select
                        value={st.kind}
                        onChange={(e) => {
                          const next = [...draft.studies];
                          next[idx] = { ...st, kind: e.target.value as StudyKind };
                          setDraft({ ...draft, studies: next });
                        }}
                        className="border border-line-200 bg-paper-0 px-2 py-1 text-[12px] focus:border-ink-950 focus:outline-none"
                      >
                        {(Object.keys(KIND_LABEL) as StudyKind[]).map((k) => (
                          <option key={k} value={k}>{KIND_LABEL[k]}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <textarea
                    value={st.objective}
                    onChange={(e) => {
                      const next = [...draft.studies];
                      next[idx] = { ...st, objective: e.target.value };
                      setDraft({ ...draft, studies: next });
                    }}
                    rows={2}
                    className="w-full border border-line-200 bg-paper-0 p-2 text-[12px] focus:border-ink-950 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
