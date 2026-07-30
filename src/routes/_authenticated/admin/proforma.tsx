import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { ArithmeticDrawer } from "@/components/calculator/ArithmeticDrawer";
import { ExplainProvider } from "@/components/explain/ExplainProvider";
import { AssumptionsPanel } from "@/components/proforma/AssumptionsPanel";
import { ProformaBoard } from "@/components/proforma/ProformaBoard";
import { ProformaVerdict } from "@/components/proforma/ProformaVerdict";
import { ScenarioBar } from "@/components/proforma/ScenarioBar";
import {
  CARIBBEAN_FALLBACK,
  DEFAULT_PROFORMA_INPUT,
  runProforma,
  type MarketCountry,
  type ProformaInput,
} from "@/lib/proforma/model";
import { listMarketCountries } from "@/lib/proforma/scenarios.functions";
// Registers every pro forma rationale with the explain registry.
import type { ProformaCtx } from "@/lib/explain/proforma-entries";
import "@/lib/explain/proforma-entries";

export const Route = createFileRoute("/_authenticated/admin/proforma")({
  head: () => ({
    meta: [
      { title: "Agency pro forma — GDPVision" },
      {
        name: "description",
        content:
          "Model adoption across the Caribbean and beyond: revenue by quarter, year, three and five years, and the correlated sovereign GDP return.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="grid min-h-dvh place-items-center bg-paper-0 p-8 text-center">
      <p className="max-w-md text-sm text-[var(--signal-negative)]">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-dvh place-items-center bg-paper-0 p-8">
      <p className="text-sm text-ink-500">Nothing here.</p>
    </div>
  ),
  component: ProformaPage,
});

function ProformaPage() {
  const [input, setInput] = useState<ProformaInput>(DEFAULT_PROFORMA_INPUT);
  const [traceOpen, setTraceOpen] = useState(false);

  const fetchMarket = useServerFn(listMarketCountries);
  const market = useQuery({
    queryKey: ["proforma-market"],
    queryFn: () => fetchMarket(),
    staleTime: 10 * 60_000,
  });

  const caribbean: MarketCountry[] = market.data?.length ? market.data : CARIBBEAN_FALLBACK;
  const result = useMemo(() => runProforma(input, caribbean), [input, caribbean]);

  const ctx: ProformaCtx = { input, result };

  return (
    <SuperAdminShell eyebrow="Agency" wide>
      <ExplainProvider ctx={ctx}>
        <div className="mx-auto w-full max-w-[1360px] px-5 py-8 sm:px-8">
          <header className="max-w-3xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              Instrument · Pro forma v1
            </div>
            <div className="mt-4 h-px w-12 bg-ink-700" aria-hidden />
            <h1 className="mt-5 font-serif text-[30px] leading-[1.08] tracking-tight text-ink-950 sm:text-[38px]">
              What does taking this instrument to the Caribbean earn — and what does it put on the
              ground?
            </h1>
            <p className="mt-5 text-[16px] leading-relaxed text-ink-700">
              Set the pace of adoption, the price of a licence, and how deeply a typical state
              stands up the chambers. Both sides update together: agency revenue by quarter, year,
              three years and five, and the correlated sovereign GDP return computed through the
              same value engine the public calculator runs on.
            </p>
          </header>

          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="min-w-0 space-y-6">
              <AssumptionsPanel
                input={input}
                onChange={(patch) => setInput((prev) => ({ ...prev, ...patch }))}
                marketSize={result.totals.marketSize}
              />
              <ProformaBoard result={result} />
              <ArithmeticDrawer trace={result.trace} open={traceOpen} onOpenChange={setTraceOpen} />
              <ScenarioBar input={input} onLoad={(v) => setInput({ ...DEFAULT_PROFORMA_INPUT, ...v })} />
            </div>

            <div className="lg:sticky lg:top-6">
              <ProformaVerdict result={result} />
            </div>
          </div>
        </div>
      </ExplainProvider>
    </SuperAdminShell>
  );
}
