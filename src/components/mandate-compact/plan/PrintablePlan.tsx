// @domain mandate-compact
// @ui src/components/mandate-compact/plan/PlanPanel.tsx
//
// Print-only rendering of the Transformational Plan. Rendered permanently
// in the DOM but hidden on screen — visible only in `@media print`. Uses
// paged-media CSS (@page + counter(page)) so browser print-to-PDF produces
// real cover page, page breaks, and page numbers with zero JS deps.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { PrintSurface } from "@/components/print/PrintSurface";
import type {
  TransformationalPlan,
  PlanSection,
} from "@/lib/mandate-compact/transformational-plan.functions";

/** Surface id — pass to printSurface() to print the plan alone. */
export const PLAN_PRINT_SURFACE = "mandate-plan";

export type PrintConfig = {
  classification: string;
  preparedFor: string;
  preparedBy: string;
  dateLabel: string;
  showPageNumbers: boolean;
  showCoverPage: boolean;
  showToc: boolean;
};

export const DEFAULT_PRINT_CONFIG: PrintConfig = {
  classification: "Cabinet · Confidential",
  preparedFor: "The Prime Minister & Cabinet",
  preparedBy: "GDPVision · Chamber 08",
  dateLabel: new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
  showPageNumbers: true,
  showCoverPage: true,
  showToc: true,
};

export function PrintablePlan({
  plan,
  countryCode,
  config,
}: {
  plan: TransformationalPlan;
  countryCode: string;
  config: PrintConfig;
}) {
  return (
    <PrintSurface
      id={PLAN_PRINT_SURFACE}
      rootId="plan-print-root"
      pageCss={pageCss(config)}
      rootProps={{ "data-page-numbers": config.showPageNumbers ? "on" : "off" }}
    >
      <style>{PRINT_CSS}</style>

      {config.showCoverPage && (
        <section className="pp-page pp-cover">
          <div className="pp-cover-top">
            <p className="pp-eyebrow">{config.classification}</p>
            <p className="pp-eyebrow-right">
              {countryCode} · v{plan.version}
            </p>
          </div>
          <div className="pp-cover-body">
            <p className="pp-cover-kicker">Chamber 08 · Transformational Plan</p>
            <h1 className="pp-cover-title">{plan.title}</h1>
            {plan.subtitle && <p className="pp-cover-subtitle">{plan.subtitle}</p>}
            {plan.metrics.gdp_delta_headline && (
              <p className="pp-cover-headline">{plan.metrics.gdp_delta_headline}</p>
            )}
          </div>
          <div className="pp-cover-metrics">
            <MetricCell label="Pillars" value={plan.metrics.pillars} />
            <MetricCell label="Pledges" value={plan.metrics.pledges} />
            <MetricCell label="Deliverables" value={plan.metrics.deliverables} />
            <MetricCell label="Ministries" value={plan.metrics.ministries_engaged} />
          </div>
          <div className="pp-cover-foot">
            <div>
              <p className="pp-foot-label">Prepared for</p>
              <p className="pp-foot-value">{config.preparedFor}</p>
            </div>
            <div>
              <p className="pp-foot-label">Prepared by</p>
              <p className="pp-foot-value">{config.preparedBy}</p>
            </div>
            <div>
              <p className="pp-foot-label">Date</p>
              <p className="pp-foot-value">{config.dateLabel}</p>
            </div>
            <div>
              <p className="pp-foot-label">Horizon</p>
              <p className="pp-foot-value">{plan.metrics.horizon ?? "—"}</p>
            </div>
          </div>
        </section>
      )}

      {config.showToc && (
        <section className="pp-page pp-toc">
          <p className="pp-eyebrow">Contents</p>
          <h2 className="pp-h2">Table of contents</h2>
          <ol className="pp-toc-list">
            {plan.sections.map((s, i) => (
              <li key={s.id}>
                <span className="pp-toc-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="pp-toc-title">{s.heading}</span>
                <span className="pp-toc-kind">
                  {(s.eyebrow || s.kind).toString().replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="pp-body">
        {plan.sections.map((s, i) => (
          <PrintSection key={s.id} section={s} index={i + 1} />
        ))}
      </section>

      {plan.sources.length > 0 && (
        <section className="pp-page pp-sources">
          <p className="pp-eyebrow">Grounding</p>
          <h2 className="pp-h2">Sources & anchors</h2>
          <ol className="pp-src-list">
            {plan.sources.map((s, i) => (
              <li key={i}>
                <span className="pp-src-num">[{String(i + 1).padStart(2, "0")}]</span>
                <span>{s.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </PrintSurface>
  );
}

function MetricCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="pp-metric">
      <p className="pp-metric-label">{label}</p>
      <p className="pp-metric-value">{value}</p>
    </div>
  );
}

function PrintSection({ section, index }: { section: PlanSection; index: number }) {
  return (
    <article className="pp-section" id={`pp-${section.id}`}>
      <header className="pp-section-head">
        <p className="pp-eyebrow">{section.eyebrow || section.kind.replace(/_/g, " ")}</p>
        <div className="pp-section-title-row">
          <span className="pp-section-num">{String(index).padStart(2, "0")}</span>
          <h3 className="pp-h3">{section.heading}</h3>
        </div>
      </header>
      <div className="pp-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body_md}</ReactMarkdown>
      </div>
    </article>
  );
}

// ─── Print CSS ──────────────────────────────────────────────────────────────
// Hidden on screen; owns the entire visible page in print. Uses paged-media
// margin boxes for page numbers, matches the app's editorial aesthetic
// (serif titles, mono eyebrows, gold accents, ink/paper tokens).

/**
 * Sheet geometry and running footers. `@page` is document-global, so it is
 * installed only while the plan is the surface that owns the printed page.
 */
function pageCss(config: PrintConfig): string {
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
      content: "GDPVision · Chamber 08";
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
  #plan-print-root {
    position: absolute;
    inset: 0;
    top: 0;
    left: 0;
    width: 100%;
    color: #1a1a1a;
    font-family: "Iowan Old Style", "Georgia", "Times New Roman", serif;
    font-size: 10.5pt;
    line-height: 1.55;
  }

  .pp-eyebrow, .pp-eyebrow-right {
    font-family: "SFMono-Regular", "Menlo", "Consolas", monospace;
    font-size: 8pt;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #6b6b6b;
    margin: 0;
  }
  .pp-eyebrow-right { text-align: right; }

  .pp-page { break-after: page; }
  .pp-page:last-of-type { break-after: auto; }

  /* Cover — bleed to page edge */
  .pp-cover {
    padding: 22mm 18mm 18mm 18mm;
    height: 100vh;
    min-height: 254mm; /* letter minus none */
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: linear-gradient(180deg, #fafaf7 0%, #f3f1ea 100%);
  }
  .pp-cover-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid #d8d4c8;
    padding-bottom: 6mm;
  }
  .pp-cover-body { padding-top: 18mm; }
  .pp-cover-kicker {
    font-family: "SFMono-Regular", monospace;
    font-size: 9pt;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: #b8912a;
    margin: 0 0 6mm 0;
  }
  .pp-cover-title {
    font-family: "Iowan Old Style", "Georgia", serif;
    font-size: 34pt;
    line-height: 1.1;
    font-weight: 500;
    color: #14140f;
    margin: 0 0 6mm 0;
    letter-spacing: -0.01em;
  }
  .pp-cover-subtitle {
    font-family: "Iowan Old Style", "Georgia", serif;
    font-size: 14pt;
    line-height: 1.45;
    color: #3a3a34;
    margin: 0 0 6mm 0;
    max-width: 140mm;
  }
  .pp-cover-headline {
    font-family: "SFMono-Regular", monospace;
    font-size: 9pt;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #b8912a;
    margin: 0;
  }
  .pp-cover-metrics {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-top: 1px solid #d8d4c8;
    border-bottom: 1px solid #d8d4c8;
  }
  .pp-metric {
    padding: 8mm 6mm;
    border-right: 1px solid #d8d4c8;
  }
  .pp-metric:last-child { border-right: none; }
  .pp-metric-label {
    font-family: "SFMono-Regular", monospace;
    font-size: 7.5pt;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #6b6b6b;
    margin: 0 0 3mm 0;
  }
  .pp-metric-value {
    font-family: "Iowan Old Style", "Georgia", serif;
    font-size: 26pt;
    color: #14140f;
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .pp-cover-foot {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8mm;
    padding-top: 6mm;
  }
  .pp-foot-label {
    font-family: "SFMono-Regular", monospace;
    font-size: 7.5pt;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #6b6b6b;
    margin: 0 0 2mm 0;
  }
  .pp-foot-value {
    font-family: "Iowan Old Style", "Georgia", serif;
    font-size: 10.5pt;
    color: #14140f;
    margin: 0;
  }

  /* Table of contents */
  .pp-toc { }
  .pp-h2 {
    font-family: "Iowan Old Style", "Georgia", serif;
    font-size: 22pt;
    font-weight: 500;
    color: #14140f;
    margin: 3mm 0 10mm 0;
    letter-spacing: -0.005em;
  }
  .pp-toc-list {
    list-style: none;
    padding: 0;
    margin: 0;
    border-top: 1px solid #e4e2da;
  }
  .pp-toc-list li {
    display: grid;
    grid-template-columns: 14mm 1fr auto;
    gap: 4mm;
    align-items: baseline;
    padding: 4mm 0;
    border-bottom: 1px solid #e4e2da;
  }
  .pp-toc-num {
    font-family: "SFMono-Regular", monospace;
    font-size: 9pt;
    color: #b8912a;
    letter-spacing: 0.14em;
  }
  .pp-toc-title {
    font-family: "Iowan Old Style", "Georgia", serif;
    font-size: 12pt;
    color: #14140f;
  }
  .pp-toc-kind {
    font-family: "SFMono-Regular", monospace;
    font-size: 8pt;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #6b6b6b;
  }

  /* Body sections */
  .pp-body { }
  .pp-section {
    break-inside: avoid-page;
    break-before: page;
    padding-top: 4mm;
  }
  .pp-section:first-child { break-before: auto; }
  .pp-section-head {
    border-bottom: 1px solid #e4e2da;
    padding-bottom: 5mm;
    margin-bottom: 6mm;
  }
  .pp-section-title-row {
    display: flex;
    align-items: baseline;
    gap: 5mm;
    margin-top: 3mm;
  }
  .pp-section-num {
    font-family: "SFMono-Regular", monospace;
    font-size: 10pt;
    color: #b8912a;
    letter-spacing: 0.16em;
    font-variant-numeric: tabular-nums;
  }
  .pp-h3 {
    font-family: "Iowan Old Style", "Georgia", serif;
    font-size: 18pt;
    font-weight: 500;
    color: #14140f;
    margin: 0;
    letter-spacing: -0.005em;
  }
  .pp-prose { color: #26261f; }
  .pp-prose p {
    margin: 0 0 4mm 0;
    orphans: 3;
    widows: 3;
  }
  .pp-prose h2 {
    font-family: "Iowan Old Style", "Georgia", serif;
    font-size: 13pt;
    font-weight: 500;
    margin: 8mm 0 3mm 0;
    color: #14140f;
    break-after: avoid;
  }
  .pp-prose h3 {
    font-family: "SFMono-Regular", monospace;
    font-size: 8.5pt;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #6b6b6b;
    margin: 6mm 0 2mm 0;
    break-after: avoid;
  }
  .pp-prose ul, .pp-prose ol { padding-left: 6mm; margin: 0 0 4mm 0; }
  .pp-prose li { margin: 0 0 1.5mm 0; }
  .pp-prose strong { color: #14140f; font-weight: 600; }
  .pp-prose blockquote {
    border-left: 2px solid #b8912a;
    padding-left: 4mm;
    margin: 4mm 0;
    color: #3a3a34;
    font-style: italic;
  }
  .pp-prose table {
    width: 100%;
    border-collapse: collapse;
    margin: 4mm 0;
    font-size: 9.5pt;
  }
  .pp-prose th, .pp-prose td {
    border: 1px solid #d8d4c8;
    padding: 2mm 3mm;
    text-align: left;
    vertical-align: top;
  }
  .pp-prose th {
    background: #f3f1ea;
    font-family: "SFMono-Regular", monospace;
    font-size: 8pt;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #6b6b6b;
  }

  /* Sources */
  .pp-sources { break-before: page; }
  .pp-src-list { list-style: none; padding: 0; margin: 0; }
  .pp-src-list li {
    display: grid;
    grid-template-columns: 14mm 1fr;
    gap: 4mm;
    padding: 2.5mm 0;
    border-bottom: 1px solid #e4e2da;
    font-size: 10pt;
  }
  .pp-src-num {
    font-family: "SFMono-Regular", monospace;
    font-size: 8.5pt;
    color: #b8912a;
    letter-spacing: 0.14em;
  }
}
`;
