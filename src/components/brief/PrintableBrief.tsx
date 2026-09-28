// The printed Decision Brief: four A4 pages in the country's flag palette.
//   1. The verdict, the waterfall to the capped total, the term.
//   2. What we know: every fact with its grade and source, where value is held up.
//   3. Where to start: the sequence with reasons, the peers, the counsel.
//   4. The arithmetic: conditions, pools, the cost rule, the approvals, sources.
// Hidden on screen; owns the page in print via <PrintSurface>.

import { useEffect, useState } from "react";

import { PrintSurface } from "@/components/print/PrintSurface";
import { APPROVALS } from "@/lib/business-case";
import type { Counsel } from "@/lib/calculator/counsel.server";
import type { CountryFacts } from "@/lib/calculator/facts.server";
import type { EvidenceCounts, EvidenceEntry } from "@/components/brief/EvidenceAssurance";
import {
  CHAMBER_COEFFICIENTS,
  FRAMING_QUESTIONS,
  POOL_LABEL,
  STANCE_LABEL,
  adoptionLabel,
  formatUsd,
  formatUsdExact,
  type PoolKey,
  type ValueInput,
  type ValueResult,
} from "@/lib/calculator/model";

import { HeldUp } from "./figures/HeldUp";
import { Peers } from "./figures/Peers";
import { Term } from "./figures/Term";
import { Waterfall } from "./figures/Waterfall";
import type { BriefPalette } from "./figures/shared";

export const BRIEF_PRINT_SURFACE = "decision-brief";

const PAGE_CSS = `
@media print {
  @page { size: A4 portrait; margin: 14mm 13mm; }
}
`;

const PRINT_CSS = `
@media print {
  #brief-print-root { position: static; width: auto; margin: 0; color: #111; font-family: Georgia, 'Times New Roman', serif; }
  #brief-print-root .page { break-after: page; }
  #brief-print-root .page:last-child { break-after: auto; }
  #brief-print-root .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.14em; text-transform: uppercase; font-size: 7.5pt; color: #444; }
  #brief-print-root h1 { font-size: 20pt; line-height: 1.1; margin: 3mm 0 0; }
  #brief-print-root h2 { font-size: 12pt; margin: 5mm 0 2mm; }
  #brief-print-root p, #brief-print-root li, #brief-print-root td, #brief-print-root th { font-size: 9pt; line-height: 1.42; overflow-wrap: anywhere; }
  #brief-print-root table { width: 100%; border-collapse: collapse; margin-top: 1.5mm; }
  #brief-print-root th, #brief-print-root td { border-bottom: 0.4pt solid #bbb; padding: 1.3mm 1mm 1.3mm 0; text-align: left; vertical-align: top; }
  #brief-print-root .num { text-align: right; white-space: nowrap; }
  #brief-print-root .verdict { font-size: 32pt; line-height: 1; margin-top: 2mm; }
  #brief-print-root figure { break-inside: avoid; margin: 4mm 0 0; }
  #brief-print-root figure h3 { font-size: 10.5pt; }
  #brief-print-root figcaption { font-size: 7.8pt; }
  #brief-print-root svg { max-height: 62mm; }
  #brief-print-root .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
}
`;

function Head({
  n,
  country,
  today,
  accent,
  title,
}: {
  n: number;
  country: string;
  today: string;
  accent: string;
  title: string;
}) {
  return (
    <>
      <div style={{ borderTop: `3pt solid ${accent}`, paddingTop: "2mm" }} className="mono">
        GDPVision · The Decision Brief · {country} · {today} · Page {n} of 4
      </div>
      <h1>{title}</h1>
    </>
  );
}

export function PrintableBrief({
  input,
  result,
  facts,
  countryName,
  counsel,
  palette,
  order,
  why,
  reopenUrl,
  evidenceEntries,
  evidenceCounts,
}: {
  input: ValueInput;
  result: ValueResult;
  facts: CountryFacts | null;
  countryName: string;
  counsel: Counsel | null;
  palette: BriefPalette;
  order: string[];
  why: Record<string, string>;
  reopenUrl: string;
  evidenceEntries: EvidenceEntry[];
  evidenceCounts: EvidenceCounts;
}) {
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    );
  }, []);
  const title = (idx: string) => CHAMBER_COEFFICIENTS.find((c) => c.index === idx)?.short ?? idx;
  const sources = Array.from(new Set((facts?.facts ?? []).map((f) => f.source))).sort();

  return (
    <PrintSurface id={BRIEF_PRINT_SURFACE} rootId="brief-print-root" pageCss={PAGE_CSS}>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="page">
        <Head
          n={1}
          country={countryName}
          today={today}
          accent={palette.band}
          title={`What a decision taken on time is worth — ${countryName}`}
        />
        <div className="mono" style={{ marginTop: "5mm" }}>
          Modelled uplift, year three · {STANCE_LABEL[input.stance]} stance
        </div>
        <div className="verdict">{formatUsd(result.upliftUsd)}</div>
        <p>
          {result.upliftPpOfGdp.toFixed(2)} percentage points of GDP ·{" "}
          {result.returnMultiple.toFixed(1)}× the annual instrument cost of{" "}
          {formatUsdExact(result.annualCostUsd)}
          {result.paybackMonths != null && result.paybackMonths < 120
            ? ` · payback in ${Math.round(result.paybackMonths)} months`
            : ""}
          . Capped at 1.2% of GDP × stance. A decision-framing model, not a forecast.
        </p>
        <div style={{ border: "0.6pt solid #999", padding: "3mm", marginTop: "4mm" }}>
          <div className="mono">Evidence status · public indicative model</div>
          <p style={{ margin: "1.5mm 0 0" }}>
            {evidenceCounts.record} record-backed · {evidenceCounts.reference} reference-based ·{" "}
            {evidenceCounts.adjusted} user-adjusted. Reference assumptions and user adjustments require
            validation against authorised administrative data before this brief is relied upon for a formal
            government decision.
          </p>
        </div>
        <Waterfall input={input} result={result} order={order} palette={palette} n={1} />
        <Term
          input={input}
          result={result}
          termMonthsRemaining={facts?.termMonthsRemaining ?? null}
          palette={palette}
          n={2}
        />
      </div>

      <div className="page">
        <Head
          n={2}
          country={countryName}
          today={today}
          accent={palette.band}
          title="What we know, and what we assume"
        />
        <table>
          <thead>
            <tr>
              <th>Figure</th>
              <th>Value</th>
              <th>Grade</th>
              <th>Source</th>
              <th className="num">{facts?.region ?? "Region"} median</th>
            </tr>
          </thead>
          <tbody>
            {(facts?.facts ?? []).map((f) => (
              <tr key={f.key}>
                <td>{f.label}</td>
                <td>{f.display}</td>
                <td>{f.grade === "assumption" ? "Assumption" : f.grade}</td>
                <td className="mono" style={{ letterSpacing: 0, textTransform: "none" }}>
                  {f.source}
                </td>
                <td className="num">{f.regional?.display ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <HeldUp input={input} facts={facts} palette={palette} n={3} />
      </div>

      <div className="page">
        <Head
          n={3}
          country={countryName}
          today={today}
          accent={palette.band}
          title="Where to start"
        />
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Chamber</th>
              <th>Why here</th>
              <th>Depth</th>
              <th className="num">Year three</th>
            </tr>
          </thead>
          <tbody>
            {order.map((idx, i) => {
              const c = result.chambers.find((x) => x.index === idx);
              return (
                <tr key={idx}>
                  <td>{i + 1}</td>
                  <td>
                    {idx} · {title(idx)}
                  </td>
                  <td>{why[idx]}</td>
                  <td>{adoptionLabel(input.chambers[idx] ?? 0)}</td>
                  <td className="num">{c && c.usd > 0 ? formatUsd(c.usd) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Peers input={input} facts={facts} palette={palette} n={4} />
        {counsel ? (
          <>
            <h2>Counsel</h2>
            <p>
              <strong>{counsel.verdict}</strong> {counsel.reading}
            </p>
            <p>
              <em>Weakest assumption.</em> {counsel.weakest_assumption}
            </p>
          </>
        ) : null}
      </div>

      <div className="page">
        <Head
          n={4}
          country={countryName}
          today={today}
          accent={palette.band}
          title="The arithmetic, and its sources"
        />
        <div className="grid2">
          <div>
            <h2>Conditions</h2>
            <table>
              <tbody>
                <tr>
                  <td>Nominal GDP</td>
                  <td className="num">{formatUsdExact(input.gdpUsd)}</td>
                </tr>
                <tr>
                  <td>Public expenditure</td>
                  <td className="num">{input.publicSpendPct}% of GDP</td>
                </tr>
                {FRAMING_QUESTIONS.map((q) => (
                  <tr key={q.key}>
                    <td>{q.question}</td>
                    <td className="num">
                      {input[q.key]} {q.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h2>Pools the model acts on</h2>
            <table>
              <tbody>
                {(Object.keys(POOL_LABEL) as PoolKey[]).map((k) => (
                  <tr key={k}>
                    <td>{POOL_LABEL[k]}</td>
                    <td className="num">{formatUsd(result.pools[k])}</td>
                  </tr>
                ))}
                <tr>
                  <td>Sum before the ceiling</td>
                  <td className="num">{formatUsd(result.rawUsd)}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Year-three uplift after the ceiling</strong>
                  </td>
                  <td className="num">
                    <strong>{formatUsd(result.upliftUsd)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginTop: "2mm" }}>
              Cost: US$300,000 a year plus US$95,000 per chamber stood up; year one carries a 40%
              implementation uplift ({formatUsdExact(result.yearOneCostUsd)}). The national platform
              the Digital Government Studio specifies is built and hosted separately. Adoption ramps
              35 / 75 / 100 per cent over three years.
            </p>
          </div>
        </div>

        <h2>The five approvals</h2>
        <ol>
          {APPROVALS.map((a) => (
            <li key={a.label}>
              <strong>{a.label}.</strong> {a.body}
            </li>
          ))}
        </ol>

        <h2>Sources</h2>
        <p>
          Figures are read from the GDPVision record for {countryName} at the time of printing (
          {facts?.generatedAt?.slice(0, 10) ?? "—"}): only graded public figures and counts of
          approved, verified or published rows. Tables consulted: {sources.join(", ") || "none"}.
          Figures marked “Assumption” are regional medians standing in where the record is silent.
        </p>
        <h2>Evidence status and validation requirement</h2>
        <table>
          <thead>
            <tr>
              <th>Input</th>
              <th>Status</th>
              <th>Current basis</th>
              <th>Evidence required</th>
            </tr>
          </thead>
          <tbody>
            {evidenceEntries.map((entry) => (
              <tr key={entry.key}>
                <td>{entry.label}</td>
                <td>
                  {entry.state === "record"
                    ? `National record · Grade ${entry.grade}`
                    : entry.state === "reference"
                      ? "Reference assumption"
                      : "User-adjusted · unvalidated"}
                </td>
                <td>{entry.source}</td>
                <td>{entry.state === "record" ? "Confirm period and custodian" : entry.replacement}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Government engagement reconciles these inputs, records the source period and accountable
          custodian, and locks the approved evidence baseline and model version. User adjustments remain
          scenarios until that validation is complete.
        </p>
        <p className="mono" style={{ letterSpacing: 0, textTransform: "none", marginTop: "3mm" }}>
          Reopen this brief exactly as configured: {reopenUrl}
        </p>
        <p className="mono" style={{ marginTop: "3mm" }}>
          Model {result.model_version} · Prepared by OPEN Interactive · A decision-framing model,
          not a forecast
        </p>
      </div>
    </PrintSurface>
  );
}
