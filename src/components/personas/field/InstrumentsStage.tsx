// Chamber 07 · Stage 03 · Instruments.
//
// The AI drafts the instrument from the source brief and the approved plan;
// the researcher edits the wording and saves. Nothing here is a blank page.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyAction } from "./StageFrame";
import {
  draftInstrument,
  getInstrument,
  saveInstrument,
} from "@/lib/personas/field-instrument.functions";

type Question = {
  id: string;
  type: string;
  prompt: string;
  help?: string;
  options?: string[];
  required?: boolean;
};

export function InstrumentsStage({
  studyId,
  onChanged,
}: {
  studyId: string | null;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [steering, setSteering] = useState("");
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [title, setTitle] = useState("");
  const [intro, setIntro] = useState("");

  const draftFn = useServerFn(draftInstrument);
  const saveFn = useServerFn(saveInstrument);

  const instrumentQ = useQuery({
    queryKey: ["field-instrument", studyId],
    queryFn: () => getInstrument({ data: { studyId: studyId as string } }),
    enabled: !!studyId,
  });
  const instrument = instrumentQ.data as
    | { id: string; title: string | null; intro: string | null; kind: string; questions: unknown }
    | null
    | undefined;

  useEffect(() => {
    if (!instrument) return;
    setQuestions((instrument.questions as Question[]) ?? []);
    setTitle(instrument.title ?? "");
    setIntro(instrument.intro ?? "");
  }, [instrument]);

  const draft = useMutation({
    mutationFn: async (kind: "survey" | "discussion_guide") =>
      draftFn({ data: { studyId: studyId as string, kind, steering: steering || null } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["field-instrument", studyId] });
      onChanged();
    },
  });

  const save = useMutation({
    mutationFn: async () =>
      saveFn({
        data: {
          id: instrument!.id,
          title: title || null,
          intro: intro || null,
          questions: (questions ?? []) as never,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["field-instrument", studyId] });
      onChanged();
    },
  });

  if (!studyId) {
    return (
      <EmptyAction
        title="The programme plan is not active yet."
        body="Approve the plan in Stage 01 — the instrument is written against its phases and method mix."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="border border-line-200 bg-paper-0 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Let the chamber draft it
        </p>
        <p className="mt-1 text-[12px] text-ink-600">
          The draft is derived from your source brief, the supporting context and the approved plan.
          Steer it if there is something it cannot know.
        </p>
        <textarea
          value={steering}
          onChange={(e) => setSteering(e.target.value)}
          rows={2}
          placeholder="Optional steer — e.g. keep it under 12 questions; probe on cost of living before trust."
          className="mt-2 w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={draft.isPending}
            onClick={() => draft.mutate("survey")}
          >
            {draft.isPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={12} />}
            Draft a survey
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={draft.isPending}
            onClick={() => draft.mutate("discussion_guide")}
          >
            <Sparkles size={12} /> Draft a discussion guide
          </button>
          {draft.isError ? (
            <span className="text-[11px] text-rose-600">{(draft.error as Error).message}</span>
          ) : null}
        </div>
      </div>

      {instrumentQ.isLoading ? (
        <p className="text-sm text-ink-500">Reading the instrument…</p>
      ) : !instrument ? (
        <EmptyAction
          title="No instrument yet."
          body="Ask the chamber for a first draft above, then edit the wording until it reads the way you would ask it aloud."
        />
      ) : (
        <div className="border border-line-200 bg-paper-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-200 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              {instrument.kind === "discussion_guide" ? "Discussion guide" : "Survey"} ·{" "}
              {(questions ?? []).length} questions
            </p>
            <button
              type="button"
              className="btn-primary"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={12} />}
              Save the instrument
            </button>
          </div>

          <div className="space-y-3 p-4">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                Title
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                What participants are told first
              </span>
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={3}
                className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
              />
            </label>

            <ol className="space-y-3">
              {(questions ?? []).map((q, i) => (
                <li key={q.id} className="border border-line-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                      Q{i + 1} · {q.type.replace(/_/g, " ")}
                    </span>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() =>
                        setQuestions((prev) => (prev ?? []).filter((x) => x.id !== q.id))
                      }
                      aria-label={`Remove question ${i + 1}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <textarea
                    value={q.prompt}
                    rows={2}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        (prev ?? []).map((x) =>
                          x.id === q.id ? { ...x, prompt: e.target.value } : x,
                        ),
                      )
                    }
                    className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
                  />
                  {q.options?.length ? (
                    <p className="mt-1 text-[11px] text-ink-600">
                      Options · {q.options.join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
