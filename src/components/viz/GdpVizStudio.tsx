import { useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVizOverview } from "@/lib/country-viz/viz.functions";

import { MacroStrip } from "./MacroStrip";
import { GdpTreemap } from "./GdpTreemap";
import { MinistrySectorHeatmap } from "./MinistrySectorHeatmap";
import { KpiSmallMultiples } from "./KpiSmallMultiples";
import { DebtHorizon } from "./DebtHorizon";
import { EvidenceRail } from "./EvidenceRail";

const overviewQuery = (code: string, fetchFn: any) =>
  queryOptions({
    queryKey: ["viz", "overview", code],
    queryFn: () => fetchFn({ data: { countryCode: code } }),
    staleTime: 60_000,
  });

export function GdpVizStudio({ code }: { code: string }) {
  const fetchOverview = useServerFn(getVizOverview);
  const { data: overview } = useSuspenseQuery(overviewQuery(code, fetchOverview));
  const [sector, setSector] = useState<string | null>(null);

  const selectedSector = overview.sectors.find((s) => s.code === sector) ?? null;

  return (
    <div className="space-y-6">
      {overview.diagnostics.missing.length > 0 && (
        <div className="rounded border border-signal-negative/50 bg-signal-negative/5 p-3 text-xs text-signal-negative">
          <span className="font-mono uppercase tracking-wider">Missing dependencies · </span>
          {overview.diagnostics.missing.join(" · ")}
        </div>
      )}

      <MacroStrip kpis={overview.macro} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GdpTreemap sectors={overview.sectors} selected={sector} onSelect={setSector} />
        </div>
        <EvidenceRail countryCode={code} sector={selectedSector} />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Small multiples</div>
            <h3 className="font-serif text-lg">Sector-linked KPI trends</h3>
          </div>
          {sector && (
            <button onClick={() => setSector(null)} className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 hover:text-ink-950">
              Show all sectors ×
            </button>
          )}
        </div>
        <KpiSmallMultiples sectors={overview.sectors} series={overview.sectorKpiSeries} selected={sector} onSelect={setSector} />
      </div>

      <DebtHorizon series={overview.fiscalSeries} />

      <MinistrySectorHeatmap
        ministries={overview.ministries}
        sectors={overview.sectors}
        matrix={overview.ministrySectorMatrix}
        selected={sector}
        onSelectSector={setSector}
      />
    </div>
  );
}
