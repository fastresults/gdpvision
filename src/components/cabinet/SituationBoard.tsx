import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { MacroStrip } from "@/components/viz/MacroStrip";
import { GdpTreemap } from "@/components/viz/GdpTreemap";
import { SovereignSankey } from "@/components/viz/SovereignSankey";
import { getVizOverview } from "@/lib/country-viz/viz.functions";
import { useState } from "react";

function vizQuery(code: string) {
  return queryOptions({
    queryKey: ["cabinet","viz", code],
    queryFn: () => getVizOverview({ data: { countryCode: code } }),
  });
}

export function SituationBoard({ code }: { code: string }) {
  const { data } = useSuspenseQuery(vizQuery(code));
  const [sel, setSel] = useState<string | null>(null);
  const macro = data.macro.slice(0, 6);
  return (
    <section className="space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Situation Board</div>
          <h2 className="font-serif text-2xl">The picture cabinet is walking into</h2>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          {data.updated_at ? `refreshed ${new Date(data.updated_at).toLocaleDateString()}` : "live corpus"}
        </div>
      </header>
      <MacroStrip kpis={macro} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr,1fr]">
        <div className="border border-line-200 bg-paper-0">
          <GdpTreemap sectors={data.sectors} selected={sel} onSelect={setSel} />
        </div>
        <div className="border border-line-200 bg-paper-0 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Chart · Sovereign Capital Flow</div>
          <h3 className="font-serif text-lg">Where the money is coming and going</h3>
          <div className="mt-3">
            <SovereignSankey countryCode={code} />
          </div>
        </div>
      </div>
    </section>
  );
}
