import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCw, Sparkles } from "lucide-react";

import type { EngineInput } from "@/lib/engine/v1_macro";
import { buildAiPlaybook, type Playbook } from "@/lib/scenarios/playbooks";
import {
  suggestPlaybooks,
  type SuggestedPlay,
} from "@/lib/scenarios/suggest-playbooks.functions";
import { PlayCardButton } from "./PlaybookCard";

const AI_ACCENTS = ["--sector-02", "--sector-05", "--sector-07", "--sector-08", "--sector-03"];

export function AiPlaySuggestions({
  countryCode,
  ministrySlug,
  leverDefs,
  activeIds,
  onToggle,
}: {
  countryCode: string;
  ministrySlug: string | null;
  leverDefs: EngineInput["leverDefs"];
  activeIds: Set<string>;
  onToggle: (p: Playbook) => void;
}) {
  const [focus, setFocus] = useState("");
  const [nonce, setNonce] = useState(0);

  const query = useQuery({
    queryKey: ["scenario-ai-plays", countryCode, ministrySlug ?? "", nonce, leverDefs.length],
    queryFn: () =>
      suggestPlaybooks({
        data: {
          countryCode,
          ministrySlug: ministrySlug || null,
          focus: focus || undefined,
          leverDefs: leverDefs.map((d) => ({
            slug: d.slug,
            sector_code: d.sector_code,
            response_fn_ref: d.response_fn_ref,
            bounds: d.bounds,
          })),
          count: 3,
        },
      }),
    enabled: leverDefs.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const regenerate = useMutation({
    mutationFn: () => {
      setNonce((n) => n + 1);
      return Promise.resolve();
    },
  });

  const builtPlays = useMemo<Array<{ play: Playbook; source: SuggestedPlay }>>(() => {
    const list = query.data?.plays ?? [];
    return list.map((s) => ({
      play: buildAiPlaybook(s.id, s.label, s.blurb, s.lever_moves, s.thesis, s.citations),
      source: s,
    }));
  }, [query.data]);

  if (leverDefs.length === 0) return null;

  return (
    <div className="mt-6 space-y-3 border-t border-line-200 pt-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
          <Sparkles size={11} /> AI-suggested plays
        </p>
        <button
          type="button"
          onClick={() => regenerate.mutate()}
          disabled={query.isFetching}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500 hover:text-ink-950 disabled:opacity-40"
        >
          <RefreshCw size={11} className={query.isFetching ? "animate-spin" : ""} />
          {query.isFetching ? "Thinking…" : "Regenerate"}
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-500">
        Grounded in this country's KPIs, sector mix, ministry mandate, and recent signals. Stack
        them with presets — plays compose.
      </p>

      <textarea
        value={focus}
        onChange={(e) => setFocus(e.target.value)}
        onBlur={() => query.isFetched && setNonce((n) => n + 1)}
        placeholder="Optional focus — e.g. 'lean into blue economy, avoid new taxes'"
        rows={2}
        className="w-full border border-line-200 bg-paper-0 px-2 py-1.5 text-[11px] leading-relaxed focus:border-ink-950 focus:outline-none"
      />

      {query.isLoading && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="min-h-[104px] animate-pulse border border-line-200 bg-paper-100/40" />
          ))}
        </div>
      )}

      {query.isError && (
        <p className="border border-line-200 bg-paper-100/60 px-2 py-2 text-[11px] italic text-ink-500">
          AI suggestions unavailable — {(query.error as Error).message}. Presets still work above.
        </p>
      )}

      {!query.isLoading && !query.isError && builtPlays.length === 0 && (
        <p className="border border-line-200 bg-paper-100/60 px-2 py-2 text-[11px] italic text-ink-500">
          No AI plays returned{query.data?.note ? ` — ${query.data.note}` : "."} Try Regenerate or
          add a focus above.
        </p>
      )}

      {builtPlays.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {builtPlays.map(({ play, source }, i) => (
            <div key={play.id} className="relative">
              <PlayCardButton
                play={play}
                active={activeIds.has(play.id)}
                accent={AI_ACCENTS[i % AI_ACCENTS.length]}
                changed={source.lever_moves.length}
                ai
                onClick={() => onToggle(play)}
              />
              {source.thesis && (
                <details className="group mt-1 border border-line-200/60 bg-paper-100/40 px-2 py-1.5">
                  <summary className="cursor-pointer font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
                    Why this play
                  </summary>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-700">{source.thesis}</p>
                  {source.citations.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1">
                      {source.citations.map((c, ci) => (
                        <li
                          key={ci}
                          className="border border-line-200 bg-paper-0 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500"
                          title={c.ref}
                        >
                          {c.kind}: {c.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
