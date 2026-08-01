// Chamber 07 · Stage 03 · Instruments.
//
// The AI drafts the instrument from the source brief and the approved plan; the
// researcher edits it — wording, order, type, options — and saves. A near-right
// draft is adjusted, never regenerated. Local edits survive background refetches.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Copy, Loader2, Plus, Sparkles, Trash2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyAction } from "./StageFrame";
import { SaveBar } from "./SaveBar";
import { useDirtyRegistration, useResolveAction } from "./stage-bus";
import { useDirtyState } from "@/hooks/useDirtyState";
import {
  QUESTION_TYPES,
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

interface Doc {
  title: string;
  intro: string;
  questions: Question[];
}

function newId() {
  return `q_${Math.random().toString(36).slice(2, 9)}`;
}

export function InstrumentsStage({
  studyId,
  onChanged,
}: {
  studyId: string | null;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [steering, setSteering] = useState("");
  const [removed, setRemoved] = useState<{ q: Question; at: number } | null>(null);

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

  const serverDoc: Doc | undefined = useMemo(
    () =>
      instrument
        ? {
            title: instrument.title ?? "",
            intro: instrument.intro ?? "",
            questions: ((instrument.questions as Question[]) ?? []).map((q) => ({ ...q })),
          }
        : undefined,
    [instrument],
  );

  const doc = useDirtyState<Doc>(serverDoc);
  const value = doc.value;

  const draft = useMutation({
    mutationFn: async (kind: "survey" | "discussion_guide") =>
      draftFn({ data: { studyId: studyId as string, kind, steering: steering || null } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["field-instrument", studyId] });
      onChanged();
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!instrument || !value) throw new Error("Nothing to save yet.");
      return saveFn({
        data: {
          id: instrument.id,
          title: value.title || null,
          intro: value.intro || null,
          questions: value.questions as never,
        },
      });
    },
    onSuccess: () => {
      doc.markSaved();
      void qc.invalidateQueries({ queryKey: ["field-instrument", studyId] });
      onChanged();
    },
  });

  useDirtyRegistration("instrument", doc.dirty, "the instrument", async () => {
    await save.mutateAsync();
  });

  useResolveAction(
    "instrument",
    !instrument
      ? { label: "Draft the instrument", run: () => draft.mutate("survey"), pending: draft.isPending }
      : doc.dirty
        ? { label: "Save the instrument", run: () => save.mutate(), pending: save.isPending }
        : null,
  );

  const patch = (fn: (d: Doc) => Doc) => doc.set((prev) => fn(prev));

  const move = (i: number, dir: -1 | 1) =>
    patch((d) => {
      const qs = [...d.questions];
      const j = i + dir;
      if (j < 0 || j >= qs.length) return d;
      const a = qs[i]!;
      qs[i] = qs[j]!;
      qs[j] = a;
      return { ...d, questions: qs };
    });

  const insertAfter = (i: number) =>
    patch((d) => {
      const qs = [...d.questions];
      qs.splice(i + 1, 0, { id: newId(), type: "open_text", prompt: "", required: false });
      return { ...d, questions: qs };
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
            {draft.isPending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
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
        {instrument && doc.dirty ? (
          <p className="mt-2 text-[11px] text-amber-700">
            Re-drafting replaces the questions below. Save your edits first if you want to keep them.
          </p>
        ) : null}
      </div>

      {instrumentQ.isLoading ? (
        <p className="text-sm text-ink-500">Reading the instrument…</p>
      ) : !instrument || !value ? (
        <EmptyAction
          title="No instrument yet."
          body="Ask the chamber for a first draft above, then edit the wording until it reads the way you would ask it aloud."
        />
      ) : (
        <div className="border border-line-200 bg-paper-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-200 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              {instrument.kind === "discussion_guide" ? "Discussion guide" : "Survey"} ·{" "}
              {value.questions.length} questions
            </p>
            <SaveBar
              what="the instrument"
              dirty={doc.dirty}
              saving={save.isPending}
              savedAt={doc.savedAt}
              conflict={doc.conflict}
              error={save.isError ? (save.error as Error).message : null}
              onSave={() => save.mutate()}
              onTakeServer={doc.takeServer}
              onKeepMine={doc.keepMine}
            />
          </div>

          <div className="space-y-3 p-4">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                Title
              </span>
              <input
                value={value.title}
                onChange={(e) => patch((d) => ({ ...d, title: e.target.value }))}
                className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                What participants are told first
              </span>
              <textarea
                value={value.intro}
                onChange={(e) => patch((d) => ({ ...d, intro: e.target.value }))}
                rows={3}
                className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
              />
            </label>

            {removed ? (
              <div className="flex items-center justify-between gap-2 border border-line-200 bg-paper-100/50 px-3 py-2">
                <span className="text-[12px] text-ink-700">Question removed.</span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    patch((d) => {
                      const qs = [...d.questions];
                      qs.splice(removed.at, 0, removed.q);
                      return { ...d, questions: qs };
                    });
                    setRemoved(null);
                  }}
                >
                  <Undo2 size={12} /> Undo
                </button>
              </div>
            ) : null}

            <ol className="space-y-3">
              {value.questions.map((q, i) => (
                <li key={q.id} className="border border-line-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                        Q{i + 1}
                      </span>
                      <select
                        value={q.type}
                        onChange={(e) =>
                          patch((d) => ({
                            ...d,
                            questions: d.questions.map((x) =>
                              x.id === q.id ? { ...x, type: e.target.value } : x,
                            ),
                          }))
                        }
                        className="border border-line-200 bg-paper-0 px-2 py-1 text-[12px] focus:border-ink-950 focus:outline-none"
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-[11px] text-ink-600">
                        <input
                          type="checkbox"
                          checked={!!q.required}
                          onChange={(e) =>
                            patch((d) => ({
                              ...d,
                              questions: d.questions.map((x) =>
                                x.id === q.id ? { ...x, required: e.target.checked } : x,
                              ),
                            }))
                          }
                        />
                        required
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        aria-label={`Move question ${i + 1} up`}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={i === value.questions.length - 1}
                        onClick={() => move(i, 1)}
                        aria-label={`Move question ${i + 1} down`}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() =>
                          patch((d) => {
                            const qs = [...d.questions];
                            qs.splice(i + 1, 0, { ...q, id: newId() });
                            return { ...d, questions: qs };
                          })
                        }
                        aria-label={`Duplicate question ${i + 1}`}
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          setRemoved({ q, at: i });
                          patch((d) => ({
                            ...d,
                            questions: d.questions.filter((x) => x.id !== q.id),
                          }));
                        }}
                        aria-label={`Remove question ${i + 1}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={q.prompt}
                    rows={2}
                    placeholder="Ask it the way you would ask it aloud."
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        questions: d.questions.map((x) =>
                          x.id === q.id ? { ...x, prompt: e.target.value } : x,
                        ),
                      }))
                    }
                    className="mt-2 w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
                  />

                  {q.type === "single_choice" ||
                  q.type === "multi_choice" ||
                  q.type === "ranking" ? (
                    <label className="mt-2 block">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                        Options · one per line
                      </span>
                      <textarea
                        value={(q.options ?? []).join("\n")}
                        rows={3}
                        onChange={(e) =>
                          patch((d) => ({
                            ...d,
                            questions: d.questions.map((x) =>
                              x.id === q.id
                                ? {
                                    ...x,
                                    options: e.target.value
                                      .split(/\r?\n/)
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  }
                                : x,
                            ),
                          }))
                        }
                        className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-[12px] focus:border-ink-950 focus:outline-none"
                      />
                    </label>
                  ) : null}

                  <button
                    type="button"
                    className="btn-ghost mt-2"
                    onClick={() => insertAfter(i)}
                  >
                    <Plus size={12} /> Insert a question here
                  </button>
                </li>
              ))}
            </ol>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => insertAfter(value.questions.length - 1)}
            >
              <Plus size={12} /> Add a question
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
