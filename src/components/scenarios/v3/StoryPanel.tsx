import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";

import { generatePlainStory, type PlainStory } from "@/lib/scenarios/plain-story.functions";

export function StoryPanel({
  scenarioId,
  question,
  fallbackThesis,
  citations,
}: {
  scenarioId: string;
  question: string;
  fallbackThesis?: string;
  citations?: Array<{ label: string; kind: string; ref?: string }>;
}) {
  const q = useQuery({
    queryKey: ["plain-story", scenarioId],
    queryFn: () => generatePlainStory({ data: { scenarioId } }),
    staleTime: 60_000,
  });

  const story: PlainStory | null = q.data?.story ?? null;
  const loading = q.isLoading;
  const note = q.data?.note;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
          You asked
        </p>
        <p className="mt-1 font-serif text-base text-ink-950">"{question}"</p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Writing the cabinet brief…
        </div>
      )}

      {!loading && !story && (
        <div className="border border-line-200 bg-paper-50 p-4 text-sm text-ink-500">
          {note ?? "No plain-English story yet."}
          {fallbackThesis && <p className="mt-2 text-ink-950">{fallbackThesis}</p>}
          <button
            type="button"
            className="btn-ghost mt-3 inline-flex items-center gap-2"
            onClick={() => q.refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      )}

      {story && (
        <>
          <h2 className="font-serif text-2xl leading-snug text-ink-950 md:text-[28px]">
            {story.headline}
          </h2>

          <dl className="space-y-4">
            <Bullet term="What happens" text={story.what_happens} />
            <Bullet term="Who feels it first" text={story.who_feels_it} />
            <Bullet term="What could offset it" text={story.what_could_offset} />
          </dl>

          <div className="border-t border-line-200 pt-3 text-[11px] text-ink-500">
            <span className="font-mono uppercase tracking-[0.2em]">Confidence · </span>
            {story.confidence}
          </div>

          {citations && citations.length > 0 && (
            <div className="border-t border-line-200 pt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                Grounded in
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {citations.slice(0, 8).map((c, i) => (
                  <li
                    key={`${c.kind}-${c.ref ?? i}`}
                    className="border border-line-200 bg-paper-0 px-2 py-1 text-[11px] text-ink-700"
                  >
                    <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">
                      {c.kind}
                    </span>{" "}
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Bullet({ term, text }: { term: string; text: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">{term}</dt>
      <dd className="mt-1 text-[15px] leading-relaxed text-ink-950">{text}</dd>
    </div>
  );
}
