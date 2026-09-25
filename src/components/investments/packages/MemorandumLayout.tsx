// Information memorandum: a cover with contents, then a flowing document with
// a running head. In print the running head moves into the page margin.

import type { MemorandumContent } from "@/lib/investments/package-schema";

import { GoldRule, HairlineTable, Kicker, Sheet, formatDate } from "./parts";

export function MemorandumLayout({ c }: { c: MemorandumContent }) {
  const numbered = c.sections.map((s, i) => ({ ...s, n: String(i + 1).padStart(2, "0") }));
  return (
    <div className="space-y-6 print:space-y-0">
      <Sheet className="pkg-memo-cover flex min-h-[9in] flex-col print:min-h-0">
        <GoldRule />
        <Kicker className="mt-5">Information memorandum · {c.country_name}</Kicker>
        <h1 className="mt-6 max-w-[20ch] font-display text-[40px] leading-[1.05] tracking-tight text-ink-950 print:text-[30pt]">
          {c.project_title}
        </h1>
        {/* The page's single red accent. */}
        <div aria-hidden className="mt-6 w-16 border-t border-narrative-500" />
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
          Prepared {formatDate(c.prepared_on)}
        </div>

        <nav aria-label="Contents" className="mt-12">
          <Kicker>Contents</Kicker>
          <ol className="mt-3 border-t border-line-200">
            {numbered.map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-[36px_1fr] border-b border-line-200 py-1.5 text-[13px] text-ink-950 print:text-[10pt]"
              >
                <span className="font-mono text-[10px] leading-[1.9] text-gold-500">{s.n}</span>
                <span>{s.heading}</span>
              </li>
            ))}
          </ol>
        </nav>

        <p className="mt-auto pt-10 text-[10px] leading-snug text-ink-500 print:text-[7.5pt]">
          Confidential. Prepared for prospective investors. This is not an offer or solicitation to
          invest.
        </p>
      </Sheet>

      <Sheet className="pkg-memo-body">
        <div className="pkg-runhead flex items-baseline justify-between gap-4 border-b border-line-200 pb-2 print:hidden">
          <Kicker className="truncate">{c.project_title}</Kicker>
          <Kicker className="shrink-0">Information memorandum</Kicker>
        </div>
        <div className="mt-8 space-y-10 print:mt-0 print:space-y-7">
          {numbered.map((s) => (
            <section key={s.id} className="pkg-memo-section" aria-labelledby={`memo-${s.id}`}>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] text-gold-500">{s.n}</span>
                <h2
                  id={`memo-${s.id}`}
                  className="font-display text-[22px] leading-tight tracking-tight text-ink-950 print:text-[15pt]"
                >
                  {s.heading}
                </h2>
              </div>
              <div
                className={
                  s.id === "disclaimer"
                    ? "mt-3 space-y-3 text-[12px] leading-relaxed text-ink-700 print:text-[8.5pt]"
                    : "mt-3 space-y-3 text-[14px] leading-relaxed text-ink-950 print:text-[10pt]"
                }
              >
                {s.paragraphs.map((p, i) => (
                  <p key={i} className="max-w-[68ch]">
                    {p}
                  </p>
                ))}
              </div>
              {s.table && s.table.rows.length > 0 ? (
                <HairlineTable className="mt-4" table={s.table} />
              ) : null}
            </section>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
