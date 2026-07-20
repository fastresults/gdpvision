// Inline "Synthesized work product" surface for Chamber 07 Stage 03.
// Renders the McKinsey-style summary + top themes for every study that
// has a report, right on the list page — no drill-in required.

import { Link } from "@tanstack/react-router";
import { ArrowUpRight, FlaskConical, Sparkles } from "lucide-react";

import { CitedMarkdown } from "@/components/citations/CitedMarkdown";

type Theme = { label?: string; prevalence?: number; quote?: string };

export type SynthesisDigestItem = {
  id: string;
  title: string;
  kind: string;
  status: string;
  created_at: string;
  segment_id: string | null;
  segment_label: string | null;
  persona_count: number;
  summary_md: string | null;
  themes: Theme[];
  // citations shape is opaque here — CitedMarkdown accepts unknown[]
  citations: unknown;
};

export function SynthesisDigest({
  items,
  code,
}: {
  items: SynthesisDigestItem[];
  code: string;
}) {
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
          <li key={s.id} className="px-4 py-4">
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
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  {s.kind.replace("_", " ")}
                  {s.segment_label ? ` · ${s.segment_label}` : ""}
                  {s.persona_count ? ` · ${s.persona_count} personas` : ""}
                </p>

                {s.summary_md && (
                  <CitedMarkdown
                    className="prose prose-sm mt-3 max-w-none text-ink-800 [&_h2]:mt-3 [&_h2]:font-serif [&_h2]:text-sm [&_h2]:uppercase [&_h2]:tracking-[0.12em] [&_h2]:text-ink-500 [&_p]:my-2"
                    source={s.summary_md}
                    citations={s.citations as never}
                  />
                )}

                {s.themes.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {s.themes.slice(0, 6).map((t, i) => (
                      <div
                        key={i}
                        className="border border-line-200 bg-paper-100/40 px-3 py-2"
                      >
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
        ))}
      </ul>
    </section>
  );
}
