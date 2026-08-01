// @domain personas
// @ui src/components/personas/field/briefing/BriefingPanel.tsx
//
// Section 01 ("The brief") of the Commencement Briefing, rendered from the
// structured opener payload rather than generic markdown prose: a lede on a
// constrained measure, a key-parameters strip, an optional short quotation of
// the client's own words, and the objectives ledger.
//
// Two variants share one markup tree — `screen` styles with project tokens,
// `print` styles with the `.cb-*` sheet installed by PrintableBriefing.

import type { BriefOpener } from "@/lib/personas/commencement-briefing.functions";

export function BriefOpenerBlock({
  opener,
  variant,
}: {
  opener: BriefOpener;
  variant: "screen" | "print";
}) {
  return variant === "print" ? <PrintOpener opener={opener} /> : <ScreenOpener opener={opener} />;
}

// ── Screen ─────────────────────────────────────────────────────────────────

function ScreenOpener({ opener }: { opener: BriefOpener }) {
  return (
    <div className="mt-4">
      <p className="max-w-[62ch] font-serif text-[15px] leading-[1.7] text-ink-900">
        {opener.lede}
      </p>

      {opener.facts.length > 0 && (
        <dl className="mt-6 grid grid-cols-2 gap-px border-y border-line-200 bg-line-200 sm:grid-cols-3">
          {opener.facts.map((f) => (
            <div key={f.label} className="bg-paper-0 px-4 py-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                {f.label}
              </dt>
              <dd className="mt-1 text-sm tabular-nums text-ink-950">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}




      {opener.objectives.length > 0 && (
        <div className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            What counts as an answer
          </p>
          <ol className="mt-3 border-t border-line-200">
            {opener.objectives.map((o) => (
              <li
                key={o.n}
                className="grid grid-cols-[2rem_1fr] gap-x-3 border-b border-line-200 py-3 sm:grid-cols-[2rem_1fr_1fr] sm:gap-x-6"
              >
                <span className="font-mono text-[11px] text-gold-500">{o.n}</span>
                <span className="text-sm text-ink-950">{o.objective}</span>
                <span className="col-start-2 text-sm text-ink-600 sm:col-start-3">{o.why}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ── Print ──────────────────────────────────────────────────────────────────

function PrintOpener({ opener }: { opener: BriefOpener }) {
  return (
    <div className="cb-opener">
      <p className="cb-lede">{opener.lede}</p>

      {opener.facts.length > 0 && (
        <dl className="cb-facts">
          {opener.facts.map((f) => (
            <div className="cb-fact" key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}


      {opener.objectives.length > 0 && (
        <div className="cb-objectives">
          <p className="cb-objectives-head">What counts as an answer</p>
          <ol>
            {opener.objectives.map((o) => (
              <li key={o.n}>
                <span className="cb-obj-num">{o.n}</span>
                <span className="cb-obj-title">{o.objective}</span>
                <span className="cb-obj-why">{o.why}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
