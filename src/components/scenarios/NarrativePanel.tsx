import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles } from "lucide-react";

import { narrateScenario, type NarrateInput } from "@/lib/scenarios.functions";

export function NarrativePanel({
  initial,
  payload,
  onGenerated,
}: {
  initial: string | null;
  payload: NarrateInput;
  onGenerated?: (md: string) => void;
}) {
  const narrate = useServerFn(narrateScenario);
  const mut = useMutation({
    mutationFn: () => narrate({ data: payload }),
    onSuccess: (res) => onGenerated?.(res.narrative_md),
  });

  const md = mut.data?.narrative_md ?? initial;

  return (
    <div className="border border-line-200 bg-paper-0 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          Executive narrative
        </h3>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="inline-flex items-center gap-1.5 border border-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:opacity-50"
        >
          <Sparkles size={12} />
          {mut.isPending ? "Drafting…" : md ? "Regenerate" : "Draft narrative"}
        </button>
      </div>
      {mut.error && (
        <p className="mt-3 text-xs text-red-600">
          {(mut.error as Error).message}
        </p>
      )}
      {md ? (
        <article className="prose prose-sm mt-4 max-w-none font-serif text-ink-950 [&_h2]:mt-6 [&_h2]:font-serif [&_h2]:text-lg [&_h3]:font-mono [&_h3]:text-[11px] [&_h3]:uppercase [&_h3]:tracking-[0.15em] [&_h3]:text-ink-500 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
        </article>
      ) : (
        <p className="mt-4 text-sm text-ink-500">
          Draft a McKinsey-style Situation → Complication → Recommendation → Risks → Watch-list
          brief grounded in the current lever settings and projected GDP path.
        </p>
      )}
    </div>
  );
}
