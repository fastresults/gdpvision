import { Loader2 } from "lucide-react";

import { Explain } from "@/components/explain/Explain";
import type { Counsel } from "@/lib/calculator/counsel.server";

/**
 * The AI layer. It interprets the arithmetic; it never produces it. If the
 * model is unavailable the calculator is unaffected — only this panel changes.
 */
export function CounselPanel({
  counsel,
  loading,
  error,
}: {
  counsel: Counsel | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="border border-line-200 bg-paper-50">
      <div className="flex items-center justify-between border-b border-line-200 px-5 py-4 sm:px-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          <Explain id="calc.counsel" label="Counsel">
            Counsel · read against your configuration
          </Explain>
        </div>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-500" /> : null}
      </div>

      <div className="px-5 py-6 sm:px-6">
        {error ? (
          <p className="text-[14px] leading-relaxed text-ink-500">{error}</p>
        ) : !counsel ? (
          <p className="text-[14px] leading-relaxed text-ink-500">
            Move a slider and the counsel will read the configuration back to you.
          </p>
        ) : (
          <div className="space-y-7">
            <p className="max-w-3xl font-serif text-[22px] leading-[1.25] tracking-tight text-ink-950 md:text-[26px]">
              {counsel.verdict}
            </p>

            <p className="max-w-3xl text-[16px] leading-relaxed text-ink-700">{counsel.reading}</p>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="border-l-2 border-gold-500 pl-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                  Highest leverage
                </div>
                <p className="mt-3 text-[14.5px] leading-relaxed text-ink-700">
                  {counsel.highest_leverage}
                </p>
              </div>
              <div className="border-l-2 border-line-200 pl-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                  Weakest assumption
                </div>
                <p className="mt-3 text-[14.5px] leading-relaxed text-ink-700">
                  {counsel.weakest_assumption}
                </p>
              </div>
            </div>

            {counsel.sequencing.length > 0 ? (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                  Sequencing
                </div>
                <ol className="mt-4 divide-y divide-line-100 border-t border-line-100">
                  {counsel.sequencing.map((s, i) => (
                    <li key={`${s.horizon}-${i}`} className="grid gap-2 py-4 md:grid-cols-[160px_1fr_2fr] md:gap-6">
                      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">
                        {s.horizon}
                      </div>
                      <div className="text-[14.5px] text-ink-950">{s.chamber}</div>
                      <div className="text-[14px] leading-relaxed text-ink-700">{s.reason}</div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
