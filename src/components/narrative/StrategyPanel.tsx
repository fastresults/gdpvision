import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";

import {
  generateStrategyDraft,
  listArtifactsForSignal,
} from "@/lib/narrative-chamber.functions";
import { getStrategy } from "@/lib/narrative.functions";
import { CitedText } from "@/components/citations/CitedText";
import type { CitationRef } from "@/components/citations/CitationSup";

export function StrategyPanel({ signalId }: { signalId: string }) {
  const qc = useQueryClient();
  const gen = useServerFn(generateStrategyDraft);
  const getS = useServerFn(getStrategy);

  const artifacts = useQuery({
    queryKey: ["narrative-artifacts", signalId],
    queryFn: () => listArtifactsForSignal({ data: { signalId } }),
  });

  const firstStratId = artifacts.data?.strategies?.[0]?.id;
  const strat = useQuery({
    queryKey: ["narrative-strategy", firstStratId],
    queryFn: () => getS({ data: { id: firstStratId! } }),
    enabled: !!firstStratId,
  });

  const m = useMutation({
    mutationFn: async () => gen({ data: { signalId } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["narrative-artifacts", signalId] });
      await qc.invalidateQueries({ queryKey: ["narrative-signal", signalId] });
    },
  });

  const seven = (strat.data?.seven_part ?? {}) as Record<string, string | string[]>;

  return (
    <section id="strategy" className="border border-line-200 bg-paper-0 p-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Act 3 · Position
          </p>
          <h2 className="mt-1 font-serif text-2xl text-ink-950">Strategy statement</h2>
        </div>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-0 hover:bg-ink-800 disabled:opacity-50"
        >
          <Sparkles size={12} /> {m.isPending ? "Drafting…" : firstStratId ? "Redraft" : "Auto-draft"}
        </button>
      </header>

      {m.error && <p className="mt-3 text-sm text-rose-600">{(m.error as Error).message}</p>}

      {!firstStratId && !m.isPending && (
        <p className="mt-4 text-sm text-ink-500">
          Grounded AI will fill a 7-part McKinsey Pyramid frame (situation, complication,
          question, answer, grounds, warrant, call) plus talking points and risks.
        </p>
      )}

      {strat.data && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <h3 className="md:col-span-2 font-serif text-xl text-ink-950">{strat.data.title}</h3>
          {(["situation", "complication", "question", "answer", "grounds", "warrant", "call"] as const).map((k) => (
            <div key={k} className="border border-line-200 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{k}</p>
              <p className="mt-1 text-sm text-ink-800 whitespace-pre-wrap">{String(seven[k] ?? "—")}</p>
            </div>
          ))}
          {Array.isArray(seven.talking_points) && (
            <div className="md:col-span-2 border border-ink-950 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Talking points</p>
              <ol className="mt-2 space-y-1 text-sm text-ink-950">
                {(seven.talking_points as string[]).map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-[10px] text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {Array.isArray(seven.risks) && (
            <div className="md:col-span-2 border border-rose-200 bg-rose-50/40 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-rose-700">Risks &amp; blowback</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-800">
                {(seven.risks as string[]).map((t, i) => (
                  <li key={i}>• {t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
