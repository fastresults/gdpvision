import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Play, Sparkles } from "lucide-react";

import { CitedMarkdown } from "@/components/citations/CitedMarkdown";
import { CitedText } from "@/components/citations/CitedText";
import { PrettyJson } from "@/components/data/PrettyJson";
import { draftStudyQuestions, getStudy, runStudy } from "@/lib/personas/study.functions";

function studyQuery(id: string) {
  return queryOptions({ queryKey: ["study", id], queryFn: () => getStudy({ data: { id } }) });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/personas/studies/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(studyQuery(params.id)),
  errorComponent: ({ error }) => <p className="p-6 text-sm text-rose-600">{error.message}</p>,
  component: StudyDetail,
});

function StudyDetail() {
  const { code, id } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(studyQuery(id));
  const { study, questions, responses, transcript, report } = data;

  const draft = useMutation({
    mutationFn: () => draftStudyQuestions({ data: { studyId: id, count: 8 } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study", id] }),
  });
  const run = useMutation({
    mutationFn: () => runStudy({ data: { studyId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study", id] }),
  });

  if (!study) return <p className="p-6 text-sm text-ink-500">Study not found.</p>;

  const byQuestion = new Map<string, typeof responses>();
  for (const r of responses) {
    if (!r.question_id) continue;
    const arr = byQuestion.get(r.question_id) ?? [];
    arr.push(r);
    byQuestion.set(r.question_id, arr);
  }

  return (
    <div className="space-y-6">
      <Link
        to="/admin/countries/$code/personas/studies"
        params={{ code }}
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => draft.mutate()}
          disabled={draft.isPending || run.isPending}
          className="inline-flex items-center gap-1.5 border border-line-200 bg-paper-0 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:border-ink-950 disabled:opacity-40"
        >
          <Sparkles size={12} /> {draft.isPending ? "Drafting…" : questions.length ? "Re-draft questions" : "AI-draft questions"}
        </button>
        <button
          type="button"
          onClick={() => run.mutate()}
          disabled={questions.length === 0 || run.isPending || draft.isPending}
          className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
        >
          <Play size={12} /> {run.isPending ? "Running study…" : "Run study"}
        </button>
      </div>
      {(draft.isError || run.isError) && (
        <p className="text-[11px] text-rose-600">
          {(draft.error as Error | null)?.message ?? (run.error as Error | null)?.message}
        </p>
      )}

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
