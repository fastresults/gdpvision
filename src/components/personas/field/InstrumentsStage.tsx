// Chamber 07 · Stage 03 · Instruments.
//
// AI-first: on arrival the chamber reads the approved plan's method mix and
// drafts every instrument that mix obliges — a questionnaire for the survey
// lines, a moderator guide for the qualitative ones — from the source brief,
// the supporting context and the plan. The researcher then edits wording,
// order, type and options. A near-right draft is adjusted, never regenerated.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Explain } from "@/components/explain/Explain";
import "@/lib/explain/personas-entries";
import { EmptyAction } from "./StageFrame";
import { SaveBar } from "./SaveBar";
import { useDirtyRegistration, useResolveAction } from "./stage-bus";
import { useDirtyState } from "@/hooks/useDirtyState";
import {
  QUESTION_TYPES,
  draftInstrument,
  ensureInstruments,
  getInstruments,
  saveInstrument,
} from "@/lib/personas/field-instrument.functions";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  type: string;
  prompt: string;
  help?: string;
  options?: string[];
  required?: boolean;
  objective_ref?: number;
  intent?: "frontline_insight";
};

interface Doc {
  title: string;
  intro: string;
  questions: Question[];
}

function newId() {
  return `q_${Math.random().toString(36).slice(2, 9)}`;
}

function kindLabel(kind: string) {
  return kind === "discussion_guide" ? "Discussion guide" : "Questionnaire";
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
  const [activeKind, setActiveKind] = useState<string | null>(null);

  const ensureFn = useServerFn(ensureInstruments);
  const draftFn = useServerFn(draftInstrument);
  const saveFn = useServerFn(saveInstrument);

  const stateQ = useQuery({
    queryKey: ["field-instrument", studyId],
    queryFn: () => getInstruments({ data: { studyId: studyId as string } }),
    enabled: !!studyId,
  });

  const required = stateQ.data?.required ?? [];
  const objectives = stateQ.data?.objectives ?? [];
  const provenance = stateQ.data?.provenance ?? [];
  const instruments = useMemo(() => stateQ.data?.instruments ?? [], [stateQ.data]);
  const missing = stateQ.data?.missing ?? [];

  // ── AI-first arrival ─────────────────────────────────────────────────────
  // Nothing to click: if the plan requires an instrument this study does not
  // hold, the chamber drafts it as soon as the stage opens.
  const derive = useMutation({
    mutationFn: async (kind?: "survey" | "discussion_guide") =>
      ensureFn({
        data: { studyId: studyId as string, ...(kind ? { kind } : {}), steering: steering || null },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["field-instrument", studyId] });
      onChanged();
    },
  });
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    if (!studyId || !stateQ.data) return;
    if (stateQ.data.missing.length === 0) return;
    autoRan.current = true;
    derive.mutate(undefined);
    // Deliberately one attempt per mount — a failed derivation is retried by hand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, stateQ.data]);

  const active = instruments.find((i) => i.kind === activeKind) ?? instruments[0] ?? null;

  const serverDoc: Doc | undefined = useMemo(
    () =>
      active
        ? {
            title: active.title ?? "",
            intro: active.intro ?? "",
            questions: ((active.questions as Question[]) ?? []).map((q) => ({ ...q })),
          }
        : undefined,
    [active],
  );

  const doc = useDirtyState<Doc>(serverDoc);
  const value = doc.value;

  const save = useMutation({
    mutationFn: async () => {
      if (!active || !value) throw new Error("Nothing to save yet.");
      return saveFn({
        data: {
          id: active.id,
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

  const redraft = useMutation({
    mutationFn: async (kind: "survey" | "discussion_guide") =>
      draftFn({ data: { studyId: studyId as string, kind, steering: steering || null } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["field-instrument", studyId] });
      onChanged();
    },
  });

  useDirtyRegistration("instrument", doc.dirty, "the instrument", async () => {
    await save.mutateAsync();
  });

  useResolveAction(
    "instrument",
    missing.length > 0
      ? {
          label: `Draft the ${missing.map((k) => (k === "discussion_guide" ? "guide" : "questionnaire")).join(" and ")}`,
          run: () => derive.mutate(undefined),
          pending: derive.isPending,
        }
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
        body="Approve the plan in Stage 01 — the instruments are written against its objectives and method mix."
      />
    );
  }

  const coverage = objectives.map((o, i) => ({
    objective: o.objective,
    n: (value?.questions ?? []).filter((q) => q.objective_ref === i + 1).length,
  }));

  return (
    <div className="space-y-5">
      {/* ── Derivation read-out: what this was written from ─────────────── */}
      <div className="border border-line-200 bg-paper-0 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            <Explain id="research.instrument.derivation" mark={false}>
              Derived from
            </Explain>
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            The plan requires {required.map((r) => kindLabel(r.kind).toLowerCase()).join(" + ")}
          </p>
        </div>
        <ul className="mt-2 flex flex-wrap gap-2">
          {provenance.length === 0 ? (
            <li className="text-[12px] text-ink-600">The study objective only.</li>
          ) : (
            provenance.map((p) => (
              <li
                key={p}
                className="border border-line-200 bg-paper-100/50 px-2 py-1 text-[11px] text-ink-700"
              >
                {p}
              </li>
            ))
          )}
        </ul>

        {derive.isPending ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-700">
            <Loader2 size={13} className="animate-spin" />
            Reading the brief and the approved plan, then writing{" "}
            {missing.length > 1 ? "both instruments" : "the instrument"}…
          </p>
        ) : derive.isError ? (
          <p className="mt-3 text-[12px] text-rose-600">
            {(derive.error as Error).message}{" "}
            <button type="button" className="underline" onClick={() => derive.mutate(undefined)}>
              Try again
            </button>
          </p>
        ) : missing.length > 0 ? (
          <button
            type="button"
            className="btn-primary mt-3"
            onClick={() => derive.mutate(undefined)}
          >
            <Sparkles size={12} /> Draft what the plan still needs
          </button>
        ) : instruments.length > 0 ? (
          <p className="mt-3 flex items-center gap-2 text-[12px] text-emerald-700">
            <Check size={13} strokeWidth={3} /> Every instrument the plan requires is drafted.
          </p>
        ) : null}

        <label className="mt-3 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            Steer the next draft — optional
          </span>
          <textarea
            value={steering}
            onChange={(e) => setSteering(e.target.value)}
            rows={2}
            placeholder="e.g. keep it under 12 questions; probe on cost of living before trust."
            className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
          />
        </label>
      </div>

      {stateQ.isLoading ? (
        <p className="text-sm text-ink-500">Reading the instruments…</p>
      ) : !active || !value ? (
        derive.isPending ? null : (
          <EmptyAction
            title="No instrument yet."
            body="The chamber writes these from the brief and the approved plan. Use the button above if the first attempt did not land."
          />
        )
      ) : (
        <div className="border border-line-200 bg-paper-0">
          {/* Tabs — one per instrument the plan requires. */}
          <div className="flex flex-wrap items-center gap-1 border-b border-line-200 p-2">
            {instruments.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setActiveKind(i.kind)}
                className={cn(
                  "px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em]",
                  i.id === active.id
                    ? "bg-ink-950 text-paper-0"
                    : "text-ink-500 hover:text-ink-950",
                )}
              >
                {kindLabel(i.kind)} · {((i.questions as Question[]) ?? []).length}
              </button>
            ))}
            {missing.map((k) => (
              <button
                key={k}
                type="button"
                disabled={derive.isPending}
                onClick={() => derive.mutate(k as "survey" | "discussion_guide")}
                className="border border-dashed border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 hover:text-ink-950"
              >
                + {kindLabel(k)}
              </button>
            ))}
          </div>

          {/* Coverage — every objective, and how many questions serve it. */}
          {coverage.length > 0 ? (
            <div className="border-b border-line-200 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                <Explain id="research.instrument.coverage" mark={false}>
                  Objective coverage
                </Explain>
              </p>
              <ul className="mt-2 space-y-1">
                {coverage.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px]">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 border px-1.5 py-0.5 font-mono text-[10px]",
                        c.n > 0
                          ? "border-emerald-500/40 text-emerald-700"
                          : "border-amber-500/50 text-amber-700",
                      )}
                    >
                      {c.n > 0 ? `${c.n} q` : "none"}
                    </span>
                    <span className="text-ink-700">{c.objective}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                {kindLabel(active.kind)} · v{active.version} · {value.questions.length} questions
              </p>
              <button
                type="button"
                className="btn-ghost"
                disabled={redraft.isPending}
                onClick={() => redraft.mutate(active.kind as "survey" | "discussion_guide")}
                title="Write a fresh version of this instrument"
              >
                {redraft.isPending ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                Re-draft
              </button>
            </div>
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

          {redraft.isError ? (
            <p className="px-3 pt-3 text-[12px] text-rose-600">
              {(redraft.error as Error).message}
            </p>
          ) : null}
          {doc.dirty ? (
            <p className="px-3 pt-3 text-[11px] text-amber-700">
              Re-drafting replaces the questions below. Save your edits first if you want to keep
              them.
            </p>
          ) : null}

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
                      <select
                        value={q.objective_ref ?? ""}
                        onChange={(e) =>
                          patch((d) => ({
                            ...d,
                            questions: d.questions.map((x) =>
                              x.id === q.id
                                ? {
                                    ...x,
                                    objective_ref: e.target.value
                                      ? Number(e.target.value)
                                      : undefined,
                                  }
                                : x,
                            ),
                          }))
                        }
                        className="border border-line-200 bg-paper-0 px-2 py-1 text-[12px] focus:border-ink-950 focus:outline-none"
                        title="Which objective this question serves"
                      >
                        <option value="">no objective</option>
                        {objectives.map((_, oi) => (
                          <option key={oi} value={oi + 1}>
                            objective {oi + 1}
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

                  <button type="button" className="btn-ghost mt-2" onClick={() => insertAfter(i)}>
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
