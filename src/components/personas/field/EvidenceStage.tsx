// Chamber 07 · Stage 05 · Evidence.
//
// The returns become a finding, and the finding becomes something the Cabinet
// can cite. Synthesise, read it, then close the programme into the second brain.
// Closing is not terminal: a filed programme can be reopened, corrected and
// re-filed over the same memo.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, Loader2, RotateCcw, Sparkles } from "lucide-react";

import { EmptyAction } from "./StageFrame";
import { useResolveAction } from "./stage-bus";
import { getCollection } from "@/lib/personas/field-collection.functions";
import {
  closeProgramme,
  reopenProgramme,
  synthesiseField,
} from "@/lib/personas/field-synthesis.functions";

import type { FieldFinding as Finding } from "@/lib/personas/field-stages";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line-200 pt-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{title}</p>
      <div className="mt-1.5 space-y-1.5 text-[13px] leading-relaxed text-ink-800">{children}</div>
    </div>
  );
}

export function EvidenceStage({
  projectId,
  studyId,
  finding,
  closed,
  onChanged,
}: {
  projectId: string;
  studyId: string | null;
  finding: Finding | null;
  closed?: boolean;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const synthFn = useServerFn(synthesiseField);
  const closeFn = useServerFn(closeProgramme);
  const reopenFn = useServerFn(reopenProgramme);

  const collectionQ = useQuery({
    queryKey: ["field-collection", studyId],
    queryFn: () => getCollection({ data: { studyId: studyId as string } }),
    enabled: !!studyId,
  });

  const synth = useMutation({
    mutationFn: async () => synthFn({ data: { studyId: studyId as string } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["field-collection", studyId] });
      onChanged();
    },
  });

  const close = useMutation({
    mutationFn: async () => closeFn({ data: { projectId } }),
    onSuccess: onChanged,
  });

  const reopen = useMutation({
    mutationFn: async () => reopenFn({ data: { projectId } }),
    onSuccess: onChanged,
  });

  const live = (synth.data?.finding as Finding | undefined) ?? finding;

  useResolveAction(
    "evidence",
    closed
      ? null
      : !live
        ? {
            label: "Synthesise the finding",
            run: () => synth.mutate(),
            pending: synth.isPending,
          }
        : { label: "Close the programme", run: () => close.mutate(), pending: close.isPending },
  );

  if (!studyId) {
    return (
      <EmptyAction
        title="No field work to read yet."
        body="Approve a plan and collect at least one return — synthesis works from real evidence only."
      />
    );
  }

  return (
    <div className="space-y-5">
      {closed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-500/40 bg-emerald-500/5 p-4">
          <div className="min-w-0">
            <p className="font-serif text-lg text-ink-950">This programme is filed.</p>
            <p className="mt-0.5 text-[13px] text-ink-700">
              The closing memo sits in this country's second brain. Reopen it to correct the
              finding — re-closing writes over the same memo, it does not file a second one.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            disabled={reopen.isPending}
            onClick={() => reopen.mutate()}
          >
            {reopen.isPending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RotateCcw size={12} />
            )}
            Reopen to revise
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border border-line-200 bg-paper-0 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Evidence base
          </p>
          <p className="mt-1 font-mono text-[12px] tabular-nums text-ink-700">
            {collectionQ.data?.responseCount ?? 0} returns collected
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={synth.isPending}
          onClick={() => synth.mutate()}
        >
          {synth.isPending ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          {live ? "Re-synthesise" : "Synthesise the finding"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={close.isPending || !live}
          onClick={() => close.mutate()}
        >
          {close.isPending ? <Loader2 size={11} className="animate-spin" /> : <Archive size={12} />}
          {closed ? "Re-file the programme" : "Close the programme"}
        </button>
      </div>
      {synth.isError ? (
        <p className="text-[12px] text-rose-600">{(synth.error as Error).message}</p>
      ) : null}
      {close.isError ? (
        <p className="text-[12px] text-rose-600">{(close.error as Error).message}</p>
      ) : null}
      {reopen.isError ? (
        <p className="text-[12px] text-rose-600">{(reopen.error as Error).message}</p>
      ) : null}
      {close.isSuccess ? (
        <p className="text-[12px] text-emerald-700">
          Closed. The programme memo is filed to this country's second brain.
        </p>
      ) : null}


      {!live ? (
        <EmptyAction
          title="Not synthesised yet."
          body="Once returns are in, the chamber reads every response and transcript and writes the finding — toplines, tensions, quotes and an explicit confidence statement."
        />
      ) : (
        <article className="space-y-4 border border-line-200 bg-paper-0 p-5">
          {live.headline ? (
            <h3 className="max-w-3xl font-serif text-2xl leading-snug text-ink-950">
              {live.headline}
            </h3>
          ) : null}

          {live.toplines?.length ? (
            <Block title="Toplines">
              <ol className="space-y-2">
                {live.toplines.map((t, i) => (
                  <li key={i}>
                    <p className="text-ink-950">{t.finding}</p>
                    {t.evidence ? <p className="text-ink-600">Evidence · {t.evidence}</p> : null}
                    {t.strength ? (
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                        {t.strength}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Block>
          ) : null}

          {live.segments?.length ? (
            <Block title="Where groups differ">
              <ul className="space-y-1">
                {live.segments.map((s, i) => (
                  <li key={i}>
                    <span className="text-ink-950">{s.segment}</span> — {s.observation}
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {live.quotes?.length ? (
            <Block title="In their words">
              <ul className="space-y-2">
                {live.quotes.map((q, i) => (
                  <li key={i} className="border-l-2 border-line-200 pl-3">
                    <p className="font-serif italic text-ink-900">“{q.quote}”</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                      {q.participant ?? "participant"}
                      {q.context ? ` · ${q.context}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {live.tensions?.length ? (
            <Block title="Tensions in the evidence">
              <ul className="list-disc space-y-1 pl-4">
                {live.tensions.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </Block>
          ) : null}

          {live.innovation_signals?.length ? (
            <Block title="Innovation signals from the field">
              <p className="text-[12px] text-ink-600">
                Raised unprompted by the people doing the work — beyond what the brief asked.
              </p>
              <ul className="space-y-2">
                {live.innovation_signals.map((s, i) => (
                  <li key={i} className="border-l-2 border-line-200 pl-3">
                    <p className="text-ink-950">{s.idea}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                      raised by {s.raised_by ?? 1}
                      {s.confidence ? ` · confidence ${s.confidence}` : ""}
                    </p>
                    {s.what_would_improve ? (
                      <p className="text-[12px] text-ink-700">{s.what_would_improve}</p>
                    ) : null}
                    {s.verbatim ? (
                      <p className="font-serif italic text-ink-800">“{s.verbatim}”</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {live.implications?.length ? (
            <Block title="What follows from it">
              <ul className="list-disc space-y-1 pl-4">
                {live.implications.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </Block>
          ) : null}

          {live.confidence ? (
            <Block title={`Confidence · ${live.confidence.level ?? "unstated"}`}>
              <p>{live.confidence.why}</p>
              {live.confidence.limitations?.length ? (
                <ul className="list-disc space-y-1 pl-4 text-ink-600">
                  {live.confidence.limitations.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              ) : null}
            </Block>
          ) : null}
        </article>
      )}
    </div>
  );
}
