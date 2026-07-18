import { Sparkles, PenLine } from "lucide-react";

export function EmptyStrategyCoach({
  onSuggest,
  onManual,
  suggesting,
}: {
  onSuggest: () => void;
  onManual: () => void;
  suggesting: boolean;
}) {
  return (
    <section className="border border-dashed border-line-200 bg-paper-100/40 p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
        Start here
      </p>
      <h2 className="mt-2 font-serif text-2xl leading-tight text-ink-950">
        Turn this threat into a resilient FDI plan
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-700">
        The AI will draft a reallocation of your FDI envelope <em>and</em> seed
        a set of resilience actions (attract, expand, retain, substitute, wind
        down). You'll then drag each action into the year it lands, and stress
        test the result.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSuggest}
          disabled={suggesting}
          className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-0 transition-colors hover:bg-ink-800 disabled:opacity-40"
        >
          <Sparkles size={13} />
          {suggesting ? "Modelling…" : "Suggest resilient plan"}
        </button>
        <button
          type="button"
          onClick={onManual}
          className="inline-flex items-center gap-2 border border-line-200 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-700 transition-colors hover:border-ink-950 hover:text-ink-950"
        >
          <PenLine size={13} />
          Build it manually
        </button>
        <p className="text-[11px] text-ink-500">
          You can always edit, restage, or regenerate afterwards.
        </p>
      </div>
    </section>
  );
}
