import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Download, Play, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { z } from "zod";

import { CitedMarkdown } from "@/components/citations/CitedMarkdown";
import { CitedText } from "@/components/citations/CitedText";
import { PrettyJson } from "@/components/data/PrettyJson";
import { draftStudyQuestions, getStudy, runStudy } from "@/lib/personas/study.functions";
import { downloadMarkdown, studyReportToMarkdown } from "@/lib/personas/report-export";
import { StudioStepper } from "@/components/personas/StudioStepper";

function studyQuery(id: string, projectId?: string) {
  return queryOptions({
    queryKey: ["study", id, projectId ?? "any"],
    queryFn: () => getStudy({ data: { id, projectId } }),
  });
}

const searchSchema = z.object({ auto: z.coerce.number().optional(), project: z.string().optional() });

export const Route = createFileRoute("/_authenticated/admin/countries/$code/personas/studies/$id")({
  validateSearch: (s) => searchSchema.parse(s),
  loaderDeps: ({ search: { project } }) => ({ project }),
  loader: ({ context, params, deps }) => context.queryClient.ensureQueryData(studyQuery(params.id, deps.project)),
  errorComponent: ({ error }) => <p className="p-6 text-sm text-rose-600">{error.message}</p>,
  component: StudyDetail,
});

function StudyDetail() {
  const { code, id } = Route.useParams();
  const search = Route.useSearch();
  const projectSearch = search.project ? { project: search.project } : undefined;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(studyQuery(id, search.project));
  const { study, questions, responses, transcript, report } = data;

  const draft = useMutation({
    mutationFn: () => draftStudyQuestions({ data: { studyId: id, count: 8 } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study", id] }),
  });
  const run = useMutation({
    mutationFn: () => runStudy({ data: { studyId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study", id] }),
  });

  // Landing on detail must never start work from a stale URL flag. Strip any
  // legacy `?auto=1` and leave execution to the visible Run study button.
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (search.auto !== 1 || autoRanRef.current) return;
    autoRanRef.current = true;
    navigate({
      to: "/admin/countries/$code/personas/studies/$id",
      params: { code, id },
      search: projectSearch ?? {},
      replace: true,
    });
  }, [search.auto, navigate, code, id, projectSearch]);

  if (!study) return <p className="p-6 text-sm text-ink-500">Study not found.</p>;

  const byQuestion = new Map<string, typeof responses>();
  for (const r of responses) {
    if (!r.question_id) continue;
    const arr = byQuestion.get(r.question_id) ?? [];
    arr.push(r);
    byQuestion.set(r.question_id, arr);
  }

  const statusPhase: "drafted" | "questions" | "running" | "synthesized" =

    study.status === "running"
      ? "running"
      : study.status === "synthesized" || study.status === "complete" || report
        ? "synthesized"
        : questions.length > 0
          ? "questions"
          : "drafted";
  const phase: "drafted" | "questions" | "running" | "synthesized" = run.isPending
    ? "running"
    : draft.isPending && statusPhase === "drafted"
      ? "drafted"
      : statusPhase;
  const coach: Record<typeof phase, string> = {
    drafted: "Start by AI-drafting 8 questions grounded in your objective. You can re-draft any time.",
    questions: "Review the questions, then run the study — each persona answers in ≈ 30–60 seconds.",
    running: "Personas are responding. Synthesis appears when the last voice is in.",
    synthesized: "Read the synthesis below. Re-run with sharper questions if the signal is thin.",
  };
  const phases: Array<{ id: typeof phase; label: string }> = [
    { id: "drafted", label: "Drafted" },
    { id: "questions", label: "Questions ready" },
    { id: "running", label: "Running" },
    { id: "synthesized", label: "Synthesized" },
  ];
  const activeIdx = phases.findIndex((p) => p.id === phase);

  const draftIsPrimary = phase === "drafted";
  const runIsPrimary = phase === "questions";
  const draftClass = draftIsPrimary
    ? "border-ink-950 bg-ink-950 text-paper-0 hover:bg-ink-700"
    : "border-line-200 bg-paper-0 text-ink-950 hover:border-ink-950";
  const runClass = runIsPrimary
    ? "border-ink-950 bg-ink-950 text-paper-0 hover:bg-ink-700"
    : "border-line-200 bg-paper-0 text-ink-950 hover:border-ink-950";

  return (
    <div className="space-y-6">
      <StudioStepper code={code} active="rehearse" activeProjectId={search.project} />

      <Link
        to="/admin/countries/$code/personas/studies"
        params={{ code }}
        search={projectSearch}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft size={12} /> All studies
      </Link>
      <header className="border-b border-line-200 pb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          {study.kind.replace("_", " ")} · {study.status}
        </p>
        <h2 className="mt-1 font-serif text-2xl text-ink-950">{study.title}</h2>
        {study.objective && <p className="mt-1 max-w-3xl text-sm text-ink-700">{study.objective}</p>}
      </header>

      {/* Primary actions — above the ribbon so the recommended next action leads */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => draft.mutate()}
          disabled={draft.isPending || run.isPending || phase === "running"}
          className={`inline-flex items-center gap-1.5 border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] disabled:opacity-40 ${draftClass}`}
        >
          <Sparkles size={12} /> {draft.isPending ? "Drafting…" : questions.length ? "Re-draft questions" : "AI-draft questions"}
        </button>
        <button
          type="button"
          onClick={() => run.mutate()}
          disabled={questions.length === 0 || run.isPending || draft.isPending}
          className={`inline-flex items-center gap-1.5 border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] disabled:opacity-40 ${runClass}`}
        >
          <Play size={12} /> {run.isPending ? "Running study…" : "Run study"}
        </button>
        <button
          type="button"
          onClick={() => {
            const { filename, body } = studyReportToMarkdown({
              study: study as never,
              questions: questions as never,
              responses: responses as never,
              transcript: transcript as never,
              report: report as never,
            });
            downloadMarkdown(filename, body);
          }}
          disabled={!study}
          className="inline-flex items-center gap-1.5 border border-line-200 bg-paper-0 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:border-ink-950 disabled:opacity-40"
        >
          <Download size={12} /> Download .md
        </button>
        {phase === "running" && (
          <span className="inline-flex items-center gap-1.5 border border-line-200 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Personas responding…
          </span>
        )}
        {phase === "synthesized" && (
          <Link
            to="/admin/countries/$code/personas/studies"
            params={{ code }}
              search={{ segmentId: study.segment_id ?? undefined, project: search.project }}
            className="ml-auto inline-flex items-center gap-1.5 border border-line-200 bg-paper-0 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:border-ink-950"
          >
            Start a follow-up study <ArrowLeft size={12} className="rotate-180" />
          </Link>
        )}
      </div>
      {(draft.isError || run.isError) && (
        <p className="text-[11px] text-rose-600">
          {(draft.error as Error | null)?.message ?? (run.error as Error | null)?.message}
        </p>
      )}

      {/* Phase ribbon */}
      <div className="border border-line-200 bg-paper-0 p-3">
        <ol className="flex items-center gap-2 overflow-x-auto">
          {phases.map((p, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <li key={p.id} className="flex items-center gap-2">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-[10px] ${
                    done
                      ? "border-ink-950 bg-ink-950 text-paper-0"
                      : active
                        ? "border-ink-950 bg-paper-0 text-ink-950"
                        : "border-line-200 bg-paper-0 text-ink-400"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] ${
                    active ? "text-ink-950" : done ? "text-ink-700" : "text-ink-400"
                  }`}
                >
                  {p.label}
                </span>
                {i < phases.length - 1 && (
                  <span className={`h-px w-6 ${i < activeIdx ? "bg-ink-950" : "bg-line-200"}`} />
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-[12px] leading-snug text-ink-700">{coach[phase]}</p>
      </div>




      {questions.length > 0 && (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Questions · {questions.length}
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-950">
            {questions.map((q) => (
              <li key={q.id}>
                {q.prompt} <span className="font-mono text-[10px] text-ink-500">[{q.kind}]</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {report && (
        <section className="border border-line-200 bg-paper-0 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Synthesis</p>
          <div className="prose prose-sm mt-2 max-w-none">
            <CitedMarkdown source={report.summary_md} citations={report.citations as never} />
          </div>
        </section>
      )}

      {transcript.length > 0 && (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Transcript</p>
          <div className="mt-2 space-y-2 border border-line-200 bg-paper-0 p-4 text-sm">
            {transcript.map((t) => (
              <div key={t.id}>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{t.speaker}</p>
                <p className="text-ink-950">
                  <CitedText text={t.utterance} citations={t.citations as never} />
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {responses.length > 0 && study.kind !== "focus_group" && (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Responses · {responses.length}
          </p>
          <div className="mt-2 space-y-4">
            {questions.map((q) => {
              const rows = byQuestion.get(q.id) ?? [];
              if (rows.length === 0) return null;
              return (
                <div key={q.id} className="border border-line-200 bg-paper-0 p-3">
                  <p className="font-serif text-sm text-ink-950">{q.prompt}</p>
                  <ul className="mt-2 divide-y divide-line-200">
                    {rows.map((r) => {
                      const persona = (r as { personas?: { name?: string; archetype?: string } | null }).personas;
                      return (
                        <li key={r.id} className="py-2">
                          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                            {persona?.name ?? "?"} · {persona?.archetype ?? ""}
                          </p>
                          <div className="mt-0.5 text-[13px] leading-relaxed text-ink-950">
                            {typeof r.answer === "string" ? (
                              <CitedText text={r.answer} citations={r.citations as never} />
                            ) : (
                              <PrettyJson value={r.answer as never} citations={r.citations as never} showRaw={false} />
                            )}
                          </div>
                          {r.rationale && (
                            <p className="mt-1 text-[11px] italic text-ink-500">
                              <CitedText text={r.rationale} citations={r.citations as never} />
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {questions.length === 0 && (
        <p className="text-sm text-ink-500">
          Start by drafting questions above. Once you&rsquo;re happy, run the study.
        </p>
      )}
    </div>
  );
}
