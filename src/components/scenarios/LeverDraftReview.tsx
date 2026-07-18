import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Sparkles, X, RotateCcw, Loader2 } from "lucide-react";
import {
  synthesizeLevers,
  commitLeverDraft,
  type LeverProposal,
} from "@/lib/scenarios/synthesize-levers.functions";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

export function LeverDraftReview({
  countryCode,
  onCommitted,
  onDismiss,
}: {
  countryCode: string;
  onCommitted: () => void;
  onDismiss: () => void;
}) {
  const [draftId, setDraftId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<LeverProposal[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const synth = useMutation({
    mutationFn: () => synthesizeLevers({ data: { countryCode, focus: focus || undefined } }),
    onSuccess: (r) => {
      setDraftId(r.draftId);
      setProposals(r.proposals);
      setSelected(new Set(r.proposals.map((p) => p.slug)));
      setNote(r.note ?? null);
    },
  });

  const commit = useMutation({
    mutationFn: () =>
      commitLeverDraft({
        data: { draftId: draftId!, selectedSlugs: Array.from(selected) },
      }),
    onSuccess: onCommitted,
  });

  const bySector = useMemo(() => {
    const m = new Map<string, LeverProposal[]>();
    for (const p of proposals) {
      const list = m.get(p.sector_code) ?? [];
      list.push(p);
      m.set(p.sector_code, list);
    }
    return m;
  }, [proposals]);

  const running = synth.isPending;

  return (
    <div className="space-y-4">
      {proposals.length === 0 && (
        <div className="space-y-3 border border-dashed border-line-200 bg-paper-100/40 p-4">
          <div className="flex items-start gap-2">
            <Sparkles size={14} className="mt-0.5 text-ink-950" />
            <div>
              <p className="text-sm text-ink-950">Synthesize levers with AI</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
                Gemini reads {countryCode}'s sectors, KPIs, ministries, capital flows and live
                signals, then proposes 8–14 concrete policy levers with bounds and rationale.
                Review before committing.
              </p>
            </div>
          </div>
          <label className="block">
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-500">
              Focus (optional)
            </span>
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. fiscal consolidation, blue economy, CBI wind-down"
              className="mt-1 w-full border border-line-200 bg-paper-0 px-2 py-1.5 text-xs focus:border-ink-950 focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => synth.mutate()}
              disabled={running}
              className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-0 hover:bg-ink-700 disabled:opacity-50"
            >
              {running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {running ? "Synthesizing…" : "Generate levers with AI"}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500 hover:text-ink-950"
            >
              Cancel
            </button>
          </div>
          {synth.error && (
            <p className="text-xs text-red-600">{(synth.error as Error).message}</p>
          )}
        </div>
      )}

      {proposals.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
              Review {proposals.length} proposals · {selected.size} selected
            </p>
            <button
              type="button"
              onClick={() => {
                setProposals([]);
                setDraftId(null);
                setSelected(new Set());
              }}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500 hover:text-ink-950"
            >
              <RotateCcw size={11} /> Regenerate
            </button>
          </div>

          <div className="max-h-[420px] space-y-4 overflow-y-auto border-y border-line-200 py-3">
            {Array.from(bySector.entries()).map(([sector, plays]) => {
              const meta = CANONICAL_SECTORS.find((c) => c.slug === sector);
              return (
                <div key={sector}>
                  <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-500">
                    <span
                      className="inline-block h-2 w-2"
                      style={{ backgroundColor: `var(${meta?.cssVar ?? "--ink-500"})` }}
                    />
                    {meta?.label ?? sector}
                  </p>
                  <ul className="space-y-1.5">
                    {plays.map((p) => {
                      const isOn = selected.has(p.slug);
                      return (
                        <li
                          key={p.slug}
                          className={
                            "border p-2.5 text-[12px] " +
                            (isOn
                              ? "border-ink-950 bg-paper-100/50"
                              : "border-line-200 bg-paper-0")
                          }
                        >
                          <label className="flex cursor-pointer items-start gap-2">
                            <input
                              type="checkbox"
                              checked={isOn}
                              onChange={(e) => {
                                const next = new Set(selected);
                                if (e.target.checked) next.add(p.slug);
                                else next.delete(p.slug);
                                setSelected(next);
                              }}
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-ink-950">{p.name}</p>
                              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                                {p.slug} · {p.unit} · [{p.bounds.min}..{p.bounds.max}] default{" "}
                                {p.bounds.default}
                              </p>
                              {p.rationale && (
                                <p className="mt-1 text-[11px] leading-relaxed text-ink-700">
                                  {p.rationale}
                                </p>
                              )}
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => commit.mutate()}
              disabled={commit.isPending || selected.size === 0}
              className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-0 hover:bg-ink-700 disabled:opacity-50"
            >
              {commit.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              Commit {selected.size} lever{selected.size === 1 ? "" : "s"}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500 hover:text-ink-950"
            >
              <X size={11} /> Close
            </button>
          </div>
          {commit.error && (
            <p className="text-xs text-red-600">{(commit.error as Error).message}</p>
          )}
          {note && <p className="text-[11px] text-ink-500">{note}</p>}
        </>
      )}
    </div>
  );
}
