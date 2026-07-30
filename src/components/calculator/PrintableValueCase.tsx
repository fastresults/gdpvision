import { useEffect, useState } from "react";

import type { Counsel } from "@/lib/calculator/counsel.server";
import { APPROVALS } from "@/lib/business-case";
import {
  STANCE_LABEL,
  formatUsd,
  formatUsdExact,
  type ValueInput,
  type ValueResult,
} from "@/lib/calculator/model";

const PRINT_CSS = `
#value-case-print-root { display: none; }

@media print {
  @page { size: A4 portrait; margin: 16mm 14mm; }
  body > *:not(#value-case-print-portal) { display: none !important; }
  #value-case-print-portal, #value-case-print-portal * { visibility: visible !important; }
  #value-case-print-root {
    display: block !important;
    position: absolute;
    inset: 0;
    width: 100%;
    color: #000;
    font-family: Georgia, 'Times New Roman', serif;
  }
  #value-case-print-root .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-size: 8pt;
    color: #444;
  }
  #value-case-print-root h1 { font-size: 22pt; line-height: 1.1; margin: 6mm 0 0; }
  #value-case-print-root h2 { font-size: 11pt; margin: 7mm 0 2mm; }
  #value-case-print-root p, #value-case-print-root li, #value-case-print-root td, #value-case-print-root th {
    font-size: 9.5pt; line-height: 1.45;
  }
  #value-case-print-root table { width: 100%; border-collapse: collapse; margin-top: 2mm; }
  #value-case-print-root th, #value-case-print-root td {
    border-bottom: 0.4pt solid #bbb; padding: 1.6mm 0; text-align: left;
  }
  #value-case-print-root td.num, #value-case-print-root th.num { text-align: right; }
  #value-case-print-root .rule { border-top: 0.8pt solid #000; margin: 4mm 0; }
  #value-case-print-root section { break-inside: avoid; }
  #value-case-print-root .verdict { font-size: 30pt; line-height: 1; margin-top: 2mm; }
}
`;

/**
 * Hidden on screen, owns the page in print. Produces the single sheet a
 * permanent secretary can carry into the room: the configuration, the verdict,
 * the attribution, the counsel, and the five approvals from the paper.
 */
export function PrintableValueCase({
  input,
  result,
  countryName,
  counsel,
  preparedFor,
}: {
  input: ValueInput;
  result: ValueResult;
  countryName: string;
  counsel: Counsel | null;
  preparedFor?: string;
}) {
  // Rendered after hydration only: server and client clocks/timezones differ.
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    );
  }, []);

  return (
    <div id="value-case-print-portal">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div id="value-case-print-root">
        <div className="mono">GDPVision · Sovereign value instrument · {today}</div>
        <h1>The value of instrumented decision-making — {countryName}</h1>
        <div className="rule" />

        <section>
          <div className="mono">Modelled uplift, year three · {STANCE_LABEL[input.stance]} stance</div>
          <div className="verdict">{formatUsd(result.upliftUsd)}</div>
          <p>
            {result.upliftPpOfGdp.toFixed(2)} percentage points of GDP · return of{" "}
            {result.returnMultiple.toFixed(1)}× against an annual instrument cost of{" "}
            {formatUsdExact(result.annualCostUsd)}
            {result.paybackMonths !== null && result.paybackMonths < 120
              ? ` · payback in ${Math.round(result.paybackMonths)} months`
              : ""}
            .
          </p>
        </section>

        <section>
          <h2>Stated conditions</h2>
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
              <tr>
                <td>GDP-moving decisions per quarter</td>
                <td className="num">{input.decisionsPerQuarter}</td>
              </tr>
              <tr>
                <td>Question to decision</td>
                <td className="num">{input.latencyMonths} months</td>
              </tr>
              <tr>
                <td>Programme spend with no measured outcome</td>
                <td className="num">{input.unmeasuredPct}%</td>
              </tr>
              <tr>
                <td>Output in the largest sector</td>
                <td className="num">{input.topSectorSharePct}%</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Attribution by chamber</h2>
          <table>
            <thead>
              <tr>
                <th>Chamber</th>
                <th className="num">Adoption</th>
                <th className="num">Year-three contribution</th>
              </tr>
            </thead>
            <tbody>
              {result.chambers.map((c) => (
                <tr key={c.index}>
                  <td>
                    {c.index} · {c.short}
                  </td>
                  <td className="num">{c.adoption}%</td>
                  <td className="num">{c.usd > 0 ? formatUsdExact(c.usd) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {counsel ? (
          <section>
            <h2>Counsel</h2>
            <p>
              <strong>{counsel.verdict}</strong>
            </p>
            <p>{counsel.reading}</p>
            <p>
              <em>Highest leverage.</em> {counsel.highest_leverage}
            </p>
            <p>
              <em>Weakest assumption.</em> {counsel.weakest_assumption}
            </p>
            {counsel.sequencing.length > 0 ? (
              <table>
                <tbody>
                  {counsel.sequencing.map((s, i) => (
                    <tr key={`${s.horizon}-${i}`}>
                      <td style={{ width: "28%" }}>{s.horizon}</td>
                      <td style={{ width: "28%" }}>{s.chamber}</td>
                      <td>{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        ) : null}

        <section>
          <h2>The five approvals</h2>
          <ol>
            {APPROVALS.map((a) => (
              <li key={a.label} style={{ marginBottom: "1.5mm" }}>
                <strong>{a.label}.</strong> {a.body}
              </li>
            ))}
          </ol>
        </section>

        <div className="rule" />
        <p className="mono">
          Prepared {preparedFor ? `for ${preparedFor} · ` : ""}by OPEN Interactive. Model{" "}
          {result.model_version}. A decision-framing model, not a forecast: coefficients are stated
          and bounded, and total claimed uplift is capped at 1.2 per cent of GDP.
        </p>
      </div>
    </div>
  );
}
