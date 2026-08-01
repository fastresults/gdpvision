// @domain personas
// @ui src/components/personas/field/briefing/BriefingPanel.tsx
//
// Print-only rendering of the Chamber 07 Commencement Briefing. Hidden on
// screen, owns the page in `@media print`, so browser print-to-PDF produces a
// cover page, contents, page numbers and clean breaks with no JS dependency.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { PrintSurface } from "@/components/print/PrintSurface";
import type { CommencementBriefing } from "@/lib/personas/commencement-briefing.functions";

/** Surface id — pass to printSurface() to print the briefing and nothing else. */
export const BRIEFING_PRINT_SURFACE = "briefing";

export type BriefingPrintConfig = {
  classification: string;
  preparedFor: string;
  preparedBy: string;
  dateLabel: string;
  showPageNumbers: boolean;
  showCoverPage: boolean;
  
};

export const DEFAULT_BRIEFING_PRINT_CONFIG: BriefingPrintConfig = {
  classification: "Client · Confidential",
  preparedFor: "",
  preparedBy: "",
  dateLabel: new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
  showPageNumbers: true,
  showCoverPage: true,
  
};

function windowLabel(b: CommencementBriefing): string {
  const f = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "—";
  return `${f(b.window.starts_on)} → ${f(b.window.ends_on)}`;
}

export function PrintableBriefing({
  briefing,
  config,
}: {
  briefing: CommencementBriefing;
  config: BriefingPrintConfig;
}) {
  return (
    <PrintSurface
      id={BRIEFING_PRINT_SURFACE}
      rootId="briefing-print-root"
      pageCss={pageCss(config, briefing)}
      rootProps={{ "data-page-numbers": config.showPageNumbers ? "on" : "off" }}
    >
      <style>{PRINT_CSS}</style>

      {config.showCoverPage && (
        <section className="cb-page cb-cover">
          <div className="cb-cover-top">
            <p className="cb-eyebrow">{config.classification}</p>
            <p className="cb-eyebrow-right">
              {briefing.countryCode} · v{briefing.version}
            </p>
          </div>
          <div className="cb-cover-body">
            <p className="cb-cover-kicker">Commencement Briefing</p>
            <h1 className="cb-cover-title">{briefing.title}</h1>
            <p className="cb-cover-subtitle">{briefing.subtitle}</p>
            <p className="cb-cover-headline">Fieldwork window · {windowLabel(briefing)}</p>
          </div>
          <div className="cb-cover-metrics">
            <MetricCell label="Phases" value={briefing.metrics.phases} />
            <MetricCell label="Participants" value={briefing.metrics.participants} />
            <MetricCell label="Questions" value={briefing.metrics.questions} />
            <MetricCell label="Waves" value={briefing.metrics.waves} />
          </div>
          <div className="cb-cover-foot">
            <FootCell label="Prepared for" value={config.preparedFor} />
            {config.preparedBy.trim().length > 0 && (
              <FootCell label="Prepared by" value={config.preparedBy} />
            )}
            <FootCell label="Date" value={config.dateLabel} />
            <FootCell label="Deliverables" value={String(briefing.metrics.deliverables)} />
          </div>
        </section>
      )}

      {briefing.sections.length >= 2 && (
        <section className="cb-page cb-toc">
          <p className="cb-eyebrow">Contents</p>
          <h2 className="cb-h2">What this document covers</h2>
          <ol className="cb-toc-list">
            {briefing.sections.map((s, i) => (
              <li key={s.id}>
                <span className="cb-toc-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="cb-toc-title">{s.heading}</span>
                <span className="cb-toc-leader" aria-hidden="true" />
                <span className="cb-toc-kind">{s.eyebrow}</span>
              </li>
            ))}
          </ol>

          <p className="cb-eyebrow cb-ready-head">Readiness at issue</p>
          <ul className="cb-ready">
            {briefing.readiness.map((r) => (
              <li key={r.label}>
                <span className="cb-ready-mark">{r.ready ? "✓" : "○"}</span>
                <span className="cb-ready-label">{r.label}</span>
                <span className="cb-ready-detail">{r.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}


      <section className="cb-body">
        {briefing.sections.map((s, i) => (
          <article className="cb-section" key={s.id}>
            <header className="cb-section-head">
              <p className="cb-eyebrow">{s.eyebrow}</p>
              <div className="cb-section-title-row">
                <span className="cb-section-num">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="cb-h3">{s.heading}</h3>
              </div>
            </header>
            <div className="cb-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.body_md}</ReactMarkdown>
            </div>
          </article>
        ))}
      </section>
    </PrintSurface>
  );
}

function MetricCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="cb-metric">
      <p className="cb-metric-label">{label}</p>
      <p className="cb-metric-value">{value}</p>
    </div>
  );
}

function FootCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="cb-foot-label">{label}</p>
      <p className="cb-foot-value">{value}</p>
    </div>
  );
}

/**
 * Sheet geometry and running footers. Installed only while this surface is the
 * one printing — `@page` is document-global, so it must never be declared by a
 * printable that is merely mounted.
 */
function pageCss(config: BriefingPrintConfig, briefing: CommencementBriefing): string {
  const footerLabel =
    `${briefing.programmeTitle || briefing.title} · Commencement Briefing`.replace(/["\\]/g, "");
  const footers = config.showPageNumbers
    ? `
    @bottom-right {
      content: counter(page) " / " counter(pages);
      font-family: "SFMono-Regular", "Menlo", "Consolas", monospace;
      font-size: 8pt;
      color: #6b6b6b;
      letter-spacing: 0.14em;
    }
    @bottom-left {
      content: "${footerLabel}";
      font-family: "SFMono-Regular", "Menlo", "Consolas", monospace;
      font-size: 8pt;
      color: #6b6b6b;
      letter-spacing: 0.14em;
    }`
    : "";
  return `
@media print {
  @page {
    size: Letter;
    margin: 18mm 16mm 22mm 16mm;${footers}
  }
  @page :first {
    margin: ${config.showCoverPage ? "0" : "18mm 16mm 22mm 16mm"};
    @bottom-right { content: none; }
    @bottom-left { content: none; }
  }
}
`;
}

const PRINT_CSS = `
@media print {
  html, body { background: #ffffff !important; }
  /*
   * Static flow, never absolute. An absolutely positioned root is sized
   * against the initial containing block — the on-screen viewport — not the
   * page content box, so the document laid out at window width and the paper
   * clipped whatever fell past the right trim.
   */
  #briefing-print-root {
    position: static;
    width: auto;
    margin: 0;
    color: #1a1a1a;
    font-family: "Iowan Old Style", "Georgia", "Times New Roman", serif;

    font-size: 10.5pt;
    line-height: 1.55;
  }
  #briefing-print-root img,
  #briefing-print-root pre,
  #briefing-print-root table { max-width: 100%; }
  #briefing-print-root p,
  #briefing-print-root li,
  #briefing-print-root td,
  #briefing-print-root th { overflow-wrap: anywhere; }

  .cb-eyebrow, .cb-eyebrow-right {
    font-family: "SFMono-Regular", "Menlo", "Consolas", monospace;
    font-size: 8pt;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #6b6b6b;
    margin: 0;
  }
  .cb-eyebrow-right { text-align: right; }

  .cb-page { break-after: page; }

  .cb-cover {
    padding: 22mm 18mm 18mm 18mm;
    min-height: 254mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: linear-gradient(180deg, #fafaf7 0%, #f3f1ea 100%);
  }
  .cb-cover-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid #d8d4c8;
    padding-bottom: 6mm;
  }
  .cb-cover-body { padding-top: 16mm; }
  .cb-cover-kicker {
    font-family: "SFMono-Regular", monospace;
    font-size: 9pt;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: #b8912a;
    margin: 0 0 6mm 0;
  }
  .cb-cover-title {
    font-size: 32pt;
    line-height: 1.1;
    font-weight: 500;
    color: #14140f;
    margin: 0 0 6mm 0;
  }
  .cb-cover-subtitle {
    font-size: 13pt;
    line-height: 1.45;
    color: #3a3a34;
    margin: 0 0 6mm 0;
    max-width: 140mm;
  }
  .cb-cover-headline {
    font-family: "SFMono-Regular", monospace;
    font-size: 9pt;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #b8912a;
    margin: 0;
  }
  .cb-cover-metrics {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-top: 1px solid #d8d4c8;
    border-bottom: 1px solid #d8d4c8;
  }
  .cb-metric { padding: 8mm 6mm; border-right: 1px solid #d8d4c8; }
  .cb-metric:last-child { border-right: none; }
  .cb-metric-label {
    font-family: "SFMono-Regular", monospace;
    font-size: 7.5pt;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #6b6b6b;
    margin: 0 0 3mm 0;
  }
  .cb-metric-value {
    font-size: 26pt;
    color: #14140f;
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .cb-cover-foot {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8mm;
    padding-top: 6mm;
  }
  .cb-foot-label {
    font-family: "SFMono-Regular", monospace;
    font-size: 7.5pt;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #6b6b6b;
    margin: 0 0 2mm 0;
  }
  .cb-foot-value { font-size: 10.5pt; color: #14140f; margin: 0; }

  .cb-h2 { font-size: 22pt; font-weight: 500; color: #14140f; margin: 3mm 0 10mm 0; }
  .cb-toc-list { list-style: none; padding: 0; margin: 0; border-top: 1px solid #e4e2da; }
  .cb-toc-list li {
    display: grid;
    grid-template-columns: 14mm 1fr auto;
    gap: 4mm;
    align-items: baseline;
    padding: 4mm 0;
    border-bottom: 1px solid #e4e2da;
  }
  .cb-toc-num { font-family: "SFMono-Regular", monospace; font-size: 9pt; color: #b8912a; }
  .cb-toc-title { font-size: 12pt; color: #14140f; }
  .cb-toc-kind {
    font-family: "SFMono-Regular", monospace;
    font-size: 8pt;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #6b6b6b;
  }
  .cb-ready-head { margin-top: 12mm; }
  .cb-ready { list-style: none; padding: 0; margin: 4mm 0 0 0; }
  .cb-ready li {
    display: grid;
    grid-template-columns: 6mm 45mm 1fr;
    gap: 3mm;
    padding: 2.5mm 0;
    border-bottom: 1px solid #f0eee7;
    font-size: 10pt;
  }
  .cb-ready-mark { color: #b8912a; }
  .cb-ready-detail { color: #55554c; }

  .cb-section { break-before: page; }
  .cb-section:first-child { break-before: auto; }
  .cb-section-head { border-bottom: 1px solid #d8d4c8; padding-bottom: 4mm; margin-bottom: 6mm; }
  .cb-section-title-row { display: flex; align-items: baseline; gap: 5mm; margin-top: 2mm; }
  .cb-section-num { font-family: "SFMono-Regular", monospace; font-size: 11pt; color: #b8912a; }
  .cb-h3 { font-size: 20pt; font-weight: 500; color: #14140f; margin: 0; }

  .cb-prose h3 {
    font-size: 12.5pt;
    font-weight: 600;
    color: #14140f;
    margin: 8mm 0 3mm 0;
    break-after: avoid;
  }
  .cb-prose p { margin: 0 0 3.5mm 0; orphans: 2; widows: 2; }
  .cb-prose ul, .cb-prose ol { margin: 0 0 4mm 5mm; padding: 0; }
  .cb-prose li { margin: 0 0 1.5mm 0; }
  .cb-prose strong { font-weight: 600; }
  .cb-prose em { color: #55554c; }
  .cb-prose hr { border: none; border-top: 1px solid #d8d4c8; margin: 8mm 0; }
  .cb-prose table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin: 0 0 6mm 0;
    font-size: 9pt;
    break-inside: auto;
  }
  .cb-prose thead { display: table-header-group; }
  .cb-prose tr { break-inside: avoid; }
  .cb-prose th {
    text-align: left;
    font-family: "SFMono-Regular", monospace;
    font-size: 7.5pt;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #6b6b6b;
    border-bottom: 1px solid #14140f;
    padding: 2mm 3mm 2mm 0;
    vertical-align: bottom;
  }
  .cb-prose td {
    border-bottom: 1px solid #e4e2da;
    padding: 2.5mm 3mm 2.5mm 0;
    vertical-align: top;
  }
}
`;
