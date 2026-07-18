import { useMutation } from "@tanstack/react-query";
import { ArrowRight, RefreshCw, Sparkles, X, Eye, Check } from "lucide-react";
import { useEffect, useState } from "react";

import type { EngineInput } from "@/lib/engine/v1_macro";
import {
  recommendScenario,
  type RecommendedScenario,
} from "@/lib/scenarios/recommend-scenario.functions";

const EXAMPLES = [
  "Wind CBI down over 3 years without a fiscal shock",
  "Increase airlift & room capacity to double stayover arrivals by Y3",
  "Prepare for a Cat-4 hurricane strike in Q3 next year",
  "IMF-style fiscal consolidation — 2% of GDP over 2 years",
  "Blue economy push: fisheries, ports, cruise berthing",
  "Sudden 30% drop in remittances — cushion the household hit",
];

export function AiRecommendDrawer({
  open,
  onClose,
  countryCode,
  ministrySlug,
  leverDefs,
  horizonYears,
  onPreview,
  onApply,
  disabled,
  disabledReason,
}: {
  open: boolean;
  onClose: () => void;
  countryCode: string;
  ministrySlug: string | null;
  leverDefs: EngineInput["leverDefs"];
  horizonYears: number;
  onPreview: (s: RecommendedScenario) => void;
  onApply: (s: RecommendedScenario) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [challenge, setChallenge] = useState("");
  const [scenario, setScenario] = useState<RecommendedScenario | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [previewed, setPreviewed] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      recommendScenario({
        data: {
          countryCode,
          ministrySlug: ministrySlug || null,
          challenge: challenge.trim(),
          horizonYearsHint: horizonYears,
          leverDefs: leverDefs.map((d) => ({
            slug: d.slug,
            label: d.label,
            sector_code: d.sector_code,
            response_fn_ref: d.response_fn_ref,
            bounds: d.bounds,
          })),
        },
      }),
    onSuccess: (res) => {
      setScenario(res.scenario);
      setNote(res.note ?? null);
      setPreviewed(false);
    },
  });

  useEffect(() => {
    if (!open) {
      setScenario(null);
      setNote(null);
      setPreviewed(false);
    }
  }, [open]);

  if (!open) return null;

  const canGenerate = challenge.trim().length > 4 && !disabled;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-ink-950/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside className="relative flex h-full w-full max-w-[560px] flex-col overflow-hidden border-l border-line-200 bg-paper-0 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-line-200 px-5 py-4">
          <div>
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
              <Sparkles size={12} /> AI scenario designer
            </p>
            <h2 className="mt-1 font-serif text-lg text-ink-950">
              Describe the challenge · get a full scenario
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
              Grounded in {countryCode}'s sector mix, KPIs, ministry mandate, and live signals.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-500 hover:bg-paper-100 hover:text-ink-950"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {disabled && (
            <div className="mb-4 border border-dashed border-ink-950/40 bg-paper-100/60 p-3 text-[11px] leading-relaxed text-ink-700">
              {disabledReason ??
                "Activate or synthesize country levers first — the recommender needs a lever set to move."}
            </div>
          )}

          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
              Your challenge
            </span>
            <textarea
              autoFocus
              value={challenge}
              onChange={(e) => setChallenge(e.target.value)}
              placeholder="e.g. Wind down CBI over 3 years without a fiscal shock…"
              rows={4}
              className="mt-2 w-full resize-none border border-line-200 bg-paper-0 px-2 py-2 text-[13px] leading-relaxed focus:border-ink-950 focus:outline-none"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setChallenge(ex)}
                className="border border-line-200 bg-paper-100/60 px-2 py-1 text-[11px] text-ink-700 hover:border-ink-950 hover:text-ink-950"
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!canGenerate || mutation.isPending}
            className="mt-4 inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-paper-0 hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {mutation.isPending ? (
              <>
                <RefreshCw size={13} className="animate-spin" /> Designing…
              </>
            ) : scenario ? (
              <>
                <RefreshCw size={13} /> Regenerate
              </>
            ) : (
              <>
                <Sparkles size={13} /> Design scenario
              </>
            )}
          </button>

          {mutation.isError && (
            <p className="mt-3 border border-line-200 bg-paper-100/60 px-2 py-2 text-[11px] italic text-ink-500">
              {(mutation.error as Error).message}
            </p>
          )}
          {note && !mutation.isPending && (
            <p className="mt-3 border border-line-200 bg-paper-100/60 px-2 py-2 text-[11px] italic text-ink-500">
              {note}
            </p>
          )}

          {scenario && (
            <div className="mt-5 space-y-4 border-t border-line-200 pt-5">
              <section>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                  Recommended scenario
                </p>
                <h3 className="mt-1 font-serif text-base text-ink-950">{scenario.title}</h3>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-700">{scenario.thesis}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                  Horizon · {scenario.horizonYears}y · Play: {scenario.playbook.label}
                </p>
              </section>

              <section>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                  Lever moves ({scenario.moves.length})
                </p>
                <div className="mt-2 divide-y divide-line-200 border-y border-line-200">
                  {scenario.moves.map((m) => (
                    <div key={m.slug} className="grid grid-cols-[1fr_auto] gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] text-ink-950">{m.label}</p>
                        {m.rationale && (
                          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
                            {m.rationale}
                          </p>
                        )}
                      </div>
                      <div className="text-right font-mono text-[11px] tabular-nums text-ink-700">
                        {m.from.toFixed(2)} <ArrowRight size={10} className="mx-0.5 inline" />{" "}
                        <span className="text-ink-950">{m.to.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {scenario.risks.length > 0 && (
                <section>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                    Risks
                  </p>
                  <ul className="mt-1.5 list-disc pl-4 text-[12px] leading-relaxed text-ink-700">
                    {scenario.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </section>
              )}

              {scenario.assumptions.length > 0 && (
                <section>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                    What must be true
                  </p>
                  <ul className="mt-1.5 list-disc pl-4 text-[12px] leading-relaxed text-ink-700">
                    {scenario.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </section>
              )}

              {scenario.citations.length > 0 && (
                <section>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                    Grounded in
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {scenario.citations.map((c, i) => (
                      <li
                        key={i}
                        className="border border-line-200 bg-paper-0 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500"
                        title={c.ref}
                      >
                        {c.kind}: {c.label}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

        {scenario && (
          <footer className="flex items-center justify-between gap-2 border-t border-line-200 bg-paper-100/40 px-5 py-3">
            <button
              type="button"
              onClick={() => {
                onPreview(scenario);
                setPreviewed(true);
              }}
              className="inline-flex items-center gap-1.5 border border-line-200 bg-paper-0 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
            >
              <Eye size={12} /> {previewed ? "Preview updated" : "Preview on canvas"}
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(scenario);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-0 hover:bg-ink-700"
            >
              <Check size={12} /> Apply scenario
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
