import { Link } from "@tanstack/react-router";

import { Explain } from "@/components/explain/Explain";
import type { CalcCtx } from "@/lib/explain/calculator-entries";
import { adoptionLabel, formatUsd } from "@/lib/calculator/model";

interface ChamberValueEstimateProps {
  index: string;
  countryName: string;
  countryCode: string;
  config: string;
  usd: number;
  adoption: number;
  context: CalcCtx;
  loading?: boolean;
}

export function ChamberValueEstimate({
  index,
  countryName,
  countryCode,
  config,
  usd,
  adoption,
  context,
  loading = false,
}: ChamberValueEstimateProps) {
  const included = adoption > 0;

  return (
    <div className="mt-5 min-h-[92px] border-y border-line-100 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
        Estimated value · year three
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-28 animate-pulse bg-paper-100 motion-reduce:animate-none" />
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <Explain
              id={`calc.chamber.${index}`}
              label={`Estimated year-three value for ${countryName}`}
              ctx={context}
              className="font-serif text-[25px] leading-none text-ink-950"
              modalAction={
                <Link
                  to="/business-case/brief"
                  search={{ country: countryCode, cfg: config }}
                  className="btn-primary px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em]"
                >
                  Open this country’s Decision Brief →
                </Link>
              }
            >
              {included ? `+${formatUsd(usd)}` : "Not yet included"}
            </Explain>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">
              {included ? `Proposed · ${adoptionLabel(adoption)}` : "Proposed sequence"}
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
            {countryName} · central public estimate
          </p>
        </>
      )}
    </div>
  );
}
