// Renders a PRD as a document: a cover with contents, then the sections
// with a running head. Pure: no data fetching, no auth. Used by the admin
// document view and the public share page.

import { CitedMarkdown } from "@/components/citations/CitedMarkdown";
import { Kicker, Sheet, formatDate } from "@/components/investments/packages/parts";

import { MD_CLASS } from "./SectionEditor";

export interface PrdDocumentProps {
  title: string;
  countryName: string;
  version: number;
  status: string;
  approvedAt: string | null;
  platformName: string;
  accent: string;
  border: string;
  sections: Array<{ ordinal: number; heading: string; body_md: string; status?: string }>;
}

function printCss(runningHead: string): string {
  const head = runningHead.replace(/[\\"<>\n\r]/g, " ").slice(0, 120);
  return `
@page prd-cover { size: letter portrait; margin: 0.9in 0.85in; }
@page prd-body {
  size: letter portrait;
  margin: 0.9in 0.85in 0.8in;
  @top-left { content: "${head}"; font-family: "IBM Plex Mono", monospace; font-size: 7pt; letter-spacing: 0.14em; text-transform: uppercase; color: #48607f; }
  @bottom-right { content: counter(page); font-family: "IBM Plex Mono", monospace; font-size: 7.5pt; color: #48607f; }
}
@media print {
  .prd-no-print { display: none !important; }
  .prd-doc .pkg-sheet { border: 0 !important; padding: 0 !important; margin: 0 !important; max-width: none !important; min-height: 0 !important; box-shadow: none !important; }
  .prd-doc .prd-cover { page: prd-cover; break-after: page; }
  .prd-doc .prd-body { page: prd-body; }
  .prd-doc .prd-section h2 { break-after: avoid; }
  .prd-doc .prd-section p { orphans: 3; widows: 3; }
  .prd-doc tr { break-inside: avoid; }
}`;
}

export function PrdDocument(p: PrdDocumentProps) {
  const numbered = p.sections.map((s) => ({ ...s, n: String(s.ordinal).padStart(2, "0") }));
  const runningHead = `${p.title} · Product requirements`;
  return (
    <div className="prd-doc">
      <style>{printCss(runningHead)}</style>
      <div className="space-y-6 print:space-y-0">
        <Sheet className="prd-cover flex min-h-[9in] flex-col print:min-h-0">
          <div aria-hidden className="h-0 border-t-2" style={{ borderColor: p.accent }} />
          <Kicker className="mt-5">Product requirements · {p.countryName}</Kicker>
          <h1 className="mt-6 max-w-[20ch] font-display text-[40px] leading-[1.05] tracking-tight text-ink-950 print:text-[30pt]">
            {p.title}
          </h1>
          <div aria-hidden className="mt-6 w-16 border-t" style={{ borderColor: p.border }} />
          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            Version {p.version} · {p.status}
            {p.approvedAt ? ` · approved ${formatDate(p.approvedAt)}` : ""}
            {p.platformName ? ` · ${p.platformName}` : ""}
          </div>
          <nav aria-label="Contents" className="mt-12">
            <Kicker>Contents</Kicker>
            <ol className="mt-3 border-t border-line-200">
              {numbered.map((s) => (
                <li
                  key={s.ordinal}
                  className="grid grid-cols-[36px_1fr] border-b border-line-200 py-1.5 text-[13px] text-ink-950 print:text-[10pt]"
                >
                  <span className="font-mono text-[10px] leading-[1.9]" style={{ color: p.accent }}>
                    {s.n}
                  </span>
                  <span>{s.heading}</span>
                </li>
              ))}
            </ol>
          </nav>
          <p className="mt-auto pt-10 text-[10px] leading-snug text-ink-500 print:text-[7.5pt]">
            Written from the country's own corpus in GDPVision. Sections marked as gaps say what the
            corpus could not supply. This document is a specification, not a commitment to procure.
          </p>
        </Sheet>

        <Sheet className="prd-body">
          <div className="flex items-baseline justify-between gap-4 border-b border-line-200 pb-2 print:hidden">
            <Kicker className="truncate">{p.title}</Kicker>
            <Kicker className="shrink-0">Product requirements</Kicker>
          </div>
          <div className="mt-8 space-y-10 print:mt-0 print:space-y-7">
            {numbered.map((s) => (
              <section key={s.ordinal} className="prd-section" aria-labelledby={`prd-${s.ordinal}`}>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px]" style={{ color: p.accent }}>
                    {s.n}
                  </span>
                  <h2
                    id={`prd-${s.ordinal}`}
                    className="font-display text-[22px] leading-tight tracking-tight text-ink-950 print:text-[15pt]"
                  >
                    {s.heading}
                  </h2>
                </div>
                {s.status === "pending" ? (
                  <p className="mt-3 text-sm text-ink-500">Not yet drafted.</p>
                ) : (
                  <CitedMarkdown source={s.body_md} className={MD_CLASS} />
                )}
              </section>
            ))}
          </div>
        </Sheet>
      </div>
    </div>
  );
}
