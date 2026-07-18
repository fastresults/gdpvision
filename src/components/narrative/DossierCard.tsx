import { ExternalLink, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { redriveSignal, type SignalRow } from "@/lib/narrative-chamber.functions";
import { RecommendationChip } from "./RecommendationChip";

export function DossierCard({ signal, code }: { signal: SignalRow; code: string }) {
  const qc = useQueryClient();
  const redrive = useServerFn(redriveSignal);
  const m = useMutation({
    mutationFn: async () => redrive({ data: { id: signal.id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["narrative-signal", signal.id] });
      await qc.invalidateQueries({ queryKey: ["narrative-signals", code] });
    },
  });

  const meta = (signal.metadata ?? {}) as {
    dossier_bullets?: string[];
    rationale?: string;
    citations?: string[];
  };

  return (
    <section className="border border-line-200 bg-paper-0 p-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Act 2 · Dossier
          </p>
          <h2 className="mt-1 font-serif text-2xl leading-tight text-ink-950">{signal.topic}</h2>
          {signal.url && (
            <a
              href={signal.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-950"
            >
              <ExternalLink size={10} /> primary source
            </a>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <RecommendationChip value={signal.recommendation} />
          <button
            type="button"
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="inline-flex items-center gap-1 border border-line-200 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700 hover:border-ink-950 disabled:opacity-50"
          >
            <RefreshCw size={10} className={m.isPending ? "animate-spin" : ""} /> Redrive
          </button>
        </div>
      </header>

      <p className="mt-4 text-sm leading-relaxed text-ink-700">{signal.summary}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Scope" value={signal.scope ?? "—"} />
        <Stat label="Severity" value={`${signal.severity ?? "—"} / 5`} />
        <Stat label="Reach" value={`${signal.reach ?? "—"} / 5`} />
        <Stat
          label="Sentiment"
          value={
            signal.sentiment === null || signal.sentiment === undefined
              ? "—"
              : signal.sentiment > 0
                ? `+${signal.sentiment}`
                : String(signal.sentiment)
          }
        />
      </div>

      {meta.dossier_bullets && meta.dossier_bullets.length > 0 && (
        <>
          <h3 className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            What / why / who / blowback
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
            {meta.dossier_bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-ink-500" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {meta.rationale && (
        <p className="mt-4 border-l-2 border-ink-950 pl-3 text-sm italic text-ink-700">
          {meta.rationale}
        </p>
      )}

      {meta.citations && meta.citations.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {meta.citations.slice(0, 6).map((u, i) => (
            <a
              key={u}
              href={u}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 border border-line-200 px-1.5 py-0.5 font-mono text-[10px] text-ink-500 hover:border-ink-950 hover:text-ink-950"
            >
              [{i + 1}] {new URL(u).hostname}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line-200 p-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <p className="mt-1 font-serif text-lg tabular-nums text-ink-950">{value}</p>
    </div>
  );
}
