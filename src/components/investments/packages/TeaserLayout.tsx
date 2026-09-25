// One-page teaser. Letter portrait in print.

import ledgerArt from "@/assets/illustrations/bc-ledger-cost.jpg.asset.json";
import { Illustration } from "@/components/marketing/Illustration";
import type { TeaserContent } from "@/lib/investments/package-schema";

import { GoldRule, HairlineTable, KeyFigure, Kicker, Sheet, formatDate, hostOf } from "./parts";

export function TeaserLayout({ c }: { c: TeaserContent }) {
  return (
    <Sheet className="pkg-teaser">
      <GoldRule />
      <header className="mt-5 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <Kicker>Investment opportunity · {c.country_name}</Kicker>
          <h1 className="mt-3 font-display text-[30px] leading-[1.1] tracking-tight text-ink-950 print:text-[21pt]">
            {c.headline}
          </h1>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            {c.project_title} · Prepared {formatDate(c.prepared_on)}
          </div>
        </div>
        <Illustration
          src={ledgerArt.url}
          variant="mark"
          className="hidden shrink-0 sm:block print:block"
        />
      </header>

      <p className="mt-5 max-w-[68ch] text-[14px] leading-relaxed text-ink-950 print:mt-4 print:text-[9.5pt]">
        {c.opportunity}
      </p>

      {c.key_figures.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-5 border-y border-line-200 py-5 sm:grid-cols-3 print:mt-4 print:grid-cols-3 print:py-3">
          {c.key_figures.map((f) => (
            <KeyFigure key={f.key} figure={f} />
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid gap-8 md:grid-cols-[1.15fr_1fr] print:mt-4 print:grid-cols-[1.15fr_1fr] print:gap-6">
        <div className="min-w-0">
          <h2 className="font-display text-[17px] text-ink-950 print:text-[12pt]">
            Investment highlights
          </h2>
          <ol className="mt-3 space-y-2.5 print:mt-2 print:space-y-1.5">
            {c.highlights.map((h, i) => (
              <li
                key={i}
                className="grid grid-cols-[22px_1fr] text-[13px] leading-snug text-ink-950 print:text-[9pt]"
              >
                <span className="font-mono text-[10px] text-gold-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{h}</span>
              </li>
            ))}
          </ol>

          {c.country_context.length > 0 ? (
            <>
              <h2 className="mt-6 font-display text-[17px] text-ink-950 print:mt-4 print:text-[12pt]">
                {c.country_name} in figures
              </h2>
              <ul className="mt-3 space-y-2 print:mt-2 print:space-y-1">
                {c.country_context.map((l, i) => {
                  const host = hostOf(l.figure?.source_url);
                  return (
                    <li key={i} className="text-[13px] leading-snug text-ink-950 print:text-[9pt]">
                      {l.text}
                      {l.figure?.period || host ? (
                        <span className="ml-1.5 font-mono text-[9.5px] tracking-[0.04em] text-ink-500">
                          ({[l.figure?.period, host].filter(Boolean).join(" · ")})
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>

        <div className="min-w-0">
          <h2 className="font-display text-[17px] text-ink-950 print:text-[12pt]">Key terms</h2>
          {/* The page's single red accent. */}
          <div aria-hidden className="mt-2 w-12 border-t border-narrative-500" />
          <HairlineTable
            className="mt-3"
            table={{
              columns: ["Term", "Detail"],
              rows: c.key_terms.map((t) => [t.label, t.value]),
            }}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 border-t border-line-200 pt-5 md:grid-cols-[1.15fr_1fr] print:mt-4 print:grid-cols-[1.15fr_1fr] print:pt-3">
        <div>
          <h2 className="font-display text-[17px] text-ink-950 print:text-[12pt]">Next steps</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-snug text-ink-950 marker:font-mono marker:text-[10px] marker:text-ink-500 print:text-[9pt]">
            {c.next_steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <div>
          <Kicker>Contact</Kicker>
          <div className="mt-2 text-[13px] text-ink-950 print:text-[9pt]">{c.contact}</div>
        </div>
      </div>

      <p className="mt-6 border-t border-line-200 pt-3 text-[9.5px] leading-snug text-ink-500 print:mt-4 print:text-[6.5pt]">
        {c.disclaimer}
      </p>
    </Sheet>
  );
}
