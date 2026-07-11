import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { z } from "zod";

import { getScenario, type ScenarioArtifact } from "@/lib/scenarios.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";
import type { EngineOutput } from "@/lib/engine/v1_macro";

const CompareSearch = z.object({
  ids: z.string().min(1),
});

export const Route = createFileRoute("/_authenticated/instrument/scenarios/compare")({
  head: () => ({
    meta: [
      { title: "Compare scenarios — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s) => CompareSearch.parse(s),
  component: CompareScenarios,
});

function CompareScenarios() {
  const { ids } = useSearch({ from: "/_authenticated/instrument/scenarios/compare" });
  const idList = ids.split(",").filter(Boolean).slice(0, 4);

  const queries = useQueries({
    queries: idList.map((id: string) => ({
      queryKey: ["scenario", id],
      queryFn: () => getScenario({ data: { id } }),
    })),
  });

  const loaded = queries.every((q) => q.data);
  if (!loaded) {
    return (
      <main className="mx-auto max-w-7xl px-8 py-16 text-ink-500">Loading comparison…</main>
    );
  }

  const scenarios = queries.map((q) => q.data as ScenarioArtifact);

  if (!loaded) {
    return (
      <main className="mx-auto max-w-7xl px-8 py-16 text-ink-500">Loading comparison…</main>
    );
  }

  const scenarios = queries.map((q) => q.data!);

  // Union of all sectors touched by any scenario.
  const allSectors = Array.from(
    new Set(
      scenarios.flatMap((s) => {
        const out = "years" in s.results ? (s.results as EngineOutput) : null;
        return out ? out.sectorImpacts.map((i) => i.sector_code) : [];
      }),
    ),
  );

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <Link
        to="/instrument/scenarios"
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
      >
        ← Scenarios
      </Link>
      <div className="mt-6">
        <SectionHeader
          eyebrow={`${scenarios[0].country_code} · Compare ${scenarios.length}`}
          title="Side by side"
        />
      </div>

      <div className="mt-14 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm" data-numeric>
          <thead>
            <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
              <th className="py-2 font-normal">Metric</th>
              {scenarios.map((s) => (
                <th key={s.id} className="py-2 font-normal">
                  <Link
                    to="/instrument/scenarios/$id"
                    params={{ id: s.id }}
                    className="hover:underline underline-offset-4"
                  >
                    {s.title}
                  </Link>
                  <div className="mt-1 font-mono text-[10px] text-ink-500">
                    {s.status} · {s.horizon_years}y
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Year 1 P50 GDP growth">
              {scenarios.map((s) => {
                const out = "years" in s.results ? (s.results as EngineOutput) : null;
                return (
                  <td key={s.id} className="py-3 font-mono">
                    {out ? `${out.gdpGrowthPath[0].p50.toFixed(2)}%` : "—"}
                  </td>
                );
              })}
            </Row>
            <Row label="Horizon end P50 GDP growth">
              {scenarios.map((s) => {
                const out = "years" in s.results ? (s.results as EngineOutput) : null;
                const last = out?.gdpGrowthPath[out.gdpGrowthPath.length - 1];
                return (
                  <td key={s.id} className="py-3 font-mono">
                    {last ? `${last.p50.toFixed(2)}%` : "—"}
                  </td>
                );
              })}
            </Row>
            {allSectors.map((code) => {
              const meta = CANONICAL_SECTORS.find((c) => c.slug === code);
              return (
                <tr key={code} className="border-b border-line-200/60">
                  <td className="py-3">
                    <span
                      className="mr-3 inline-block h-3 w-1 align-middle"
                      style={{ backgroundColor: `var(${meta?.cssVar ?? "--ink-500"})` }}
                    />
                    {meta?.label ?? code} · Δ pp
                  </td>
                  {scenarios.map((s) => {
                    const out = "years" in s.results ? (s.results as EngineOutput) : null;
                    const impact = out?.sectorImpacts.find((i) => i.sector_code === code);
                    return (
                      <td key={s.id} className="py-3 font-mono">
                        {impact
                          ? `${impact.delta_pp > 0 ? "+" : ""}${impact.delta_pp.toFixed(2)}`
                          : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-line-200/60">
      <td className="py-3">{label}</td>
      {children}
    </tr>
  );
}
