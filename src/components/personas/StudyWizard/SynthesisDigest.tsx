// Inline "Synthesized work product" surface for Chamber 07 Stage 03.
// Renders the McKinsey-style memo, themes, recommendations, and the
// exact questions each study asked — right on the list page.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, ChevronRight, FlaskConical, Sparkles } from "lucide-react";

import { CitedMarkdown } from "@/components/citations/CitedMarkdown";

type Theme = { label?: string; prevalence?: number; quote?: string };
type Recommendation = { move?: string; why?: string; owner?: string };
type Question = { ord?: number; prompt?: string; kind?: string };

export type SynthesisDigestItem = {
  id: string;
  title: string;
  kind: string;
  status: string;
  objective: string | null;
  created_at: string;
  segment_id: string | null;
  segment_label: string | null;
  segment_prompt: string | null;
  persona_count: number;
  summary_md: string | null;
  themes: Theme[];
  recommendations: Recommendation[];
  questions: Question[];
  citations: unknown;
};

const KIND_LABEL: Record<string, string> = {
  survey: "Survey",
  focus_group: "Focus group",
  creative_test: "Creative test",
};

export function SynthesisDigest({ items, code }: { items: SynthesisDigestItem[]; code: string }) {
  const synthesized = items.filter((s) => s.summary_md);
  if (synthesized.length === 0) return null;

  return (
    <section id="synthesized" className="border border-ink-950 bg-paper-0">
      <header className="flex items-center gap-2 border-b border-line-200 px-4 py-3">
        <span className="grid h-6 w-6 place-items-center border border-ink-950 bg-ink-950 text-paper-0">
          <Sparkles size={12} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            What we learned
          </p>
          <p className="font-serif text-lg leading-tight text-ink-950">
            {synthesized.length} synthesized {synthesized.length === 1 ? "study" : "studies"}
          </p>
        </div>
      </header>

      <ul className="divide-y divide-line-200">
        {synthesized.map((s) => (
          <DigestRow key={s.id} s={s} code={code} />
        ))}
      </ul>
    </section>
  );
}

function DigestRow({ s, code }: { s: SynthesisDigestItem; code: string }) {
  const [openQ, setOpenQ] = useState(false);
  return (
    <li className="px-4 py-4">
      <div className="flex items-start gap-3">
        <FlaskConical size={16} className="mt-1 text-ink-500" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="font-serif text-base text-ink-950">{s.title}</p>
            <Link
              to="/admin/countries/$code/personas/studies/$id"
              params={{ code, id: s.id }}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 hover:text-ink-950"
            >
              Open <ArrowUpRight size={11} />
            </Link>
          </div>

          {/* Instrument context row — always visible */}
          <div className="mt-1 flex flex-wrap gap-1.5">
            <ContextChip label="Method" value={KIND_LABEL[s.kind] ?? s.kind.replace("_", " ")} />
            {s.segment_label && <ContextChip label="Segment" value={s.segment_label} />}
            {s.persona_count > 0 && <ContextChip label="N" value={`${s.persona_count} personas`} />}
            {s.questions.length > 0 && <ContextChip label="Questions" value={`${s.questions.length}`} />}
          </div>

          {s.objective && (
            <p className="mt-2 border-l-2 border-line-200 pl-2 text-[12px] italic text-ink-700">
              Objective: {s.objective}
            </p>
          )}

          {s.questions.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setOpenQ((v) => !v)}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 hover:text-ink-950"
              >
                {openQ ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                Questions asked ({s.questions.length})
              </button>
              {openQ && (
                <ol className="mt-2 space-y-1 border-l border-line-200 pl-3 text-[12px] text-ink-800">
                  {s.questions.map((q, i) => (
                    <li key={i}>
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                        Q{(q.ord ?? i) + 1} · {q.kind ?? "open"}
                      </span>
                      <p className="mt-0.5">{q.prompt}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {s.summary_md && (
            <CitedMarkdown
              className="prose prose-sm mt-3 max-w-none text-ink-800 [&_h2]:mt-3 [&_h2]:font-serif [&_h2]:text-sm [&_h2]:uppercase [&_h2]:tracking-[0.12em] [&_h2]:text-ink-500 [&_p]:my-2"
              source={s.summary_md}
              citations={s.citations as never}
            />
          )}

          {s.recommendations.length > 0 && (
            <div className="mt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                Recommendations
              </p>
              <ul className="mt-1 space-y-1.5">
                {s.recommendations.slice(0, 4).map((r, i) => (
                  <li key={i} className="border border-line-200 bg-paper-100/40 px-3 py-2 text-[12px]">
                    <p className="font-serif text-[13px] text-ink-950">{r.move ?? "—"}</p>
                    {r.why && <p className="mt-0.5 text-ink-700">{r.why}</p>}
                    {r.owner && (
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                        Owner: {r.owner}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {s.themes.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {s.themes.slice(0, 6).map((t, i) => (
                <div key={i} className="border border-line-200 bg-paper-100/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-ink-950">
                      {t.label ?? `Theme ${i + 1}`}
                    </p>
                    {typeof t.prevalence === "number" && (
                      <span className="font-mono text-[10px] tabular-nums text-ink-500">
                        {Math.round(t.prevalence * 100)}%
                      </span>
                    )}
                  </div>
                  {t.quote && (
                    <p className="mt-1 text-[12px] italic leading-snug text-ink-700">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function ContextChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 border border-line-200 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-950">{value}</span>
    </span>
  );
}
