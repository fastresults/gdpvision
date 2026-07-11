import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { getScenario, promoteScenario } from "@/lib/scenarios.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";
import type { EngineOutput } from "@/lib/engine/v1_macro";

function scenarioQuery(id: string) {
  return queryOptions({
    queryKey: ["scenario", id],
    queryFn: () => getScenario({ data: { id } }),
  });
}

export const Route = createFileRoute("/_authenticated/instrument/scenarios/$id")({
  head: () => ({
    meta: [
      { title: "Scenario — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(scenarioQuery(params.id)),
  component: ScenarioDetail,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-8 py-24 text-ink-500">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em]">Scenario unavailable</p>
      <p className="mt-4 text-sm">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-8 py-24 text-ink-500">Scenario not found.</div>
  ),
});

function ScenarioDetail() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(scenarioQuery(id));
  const qc = useQueryClient();

  const promote = useMutation({
    mutationFn: (to: "draft" | "shared" | "adopted" | "archived") =>
      promoteScenario({ data: { id, toStatus: to } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenario", id] }),
  });

  const output = "years" in data.results ? (data.results as EngineOutput) : null;
  const nextStates: Array<"shared" | "adopted" | "archived"> =
    data.status === "draft" ? ["shared", "archived"]
    : data.status === "shared" ? ["adopted", "archived"]
    : data.status === "adopted" ? ["archived"]
    : [];

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
          eyebrow={`${data.country_code} · ${data.status.toUpperCase()} · ${data.model_version}`}
          title={data.title}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {nextStates.map((s) => (
          <button
            key={s}
            onClick={() => promote.mutate(s)}
            disabled={promote.isPending}
            className="border border-ink-950 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:opacity-50"
          >
            Promote to {s}
          </button>
        ))}
      </div>
      {promote.error ? (
        <p className="mt-4 text-sm text-red-600">
          {(promote.error as Error).message} — requires Cabinet Secretary or Admin role.
        </p>
      ) : null}

      <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-3">
        <Stat label="Horizon" value={`${data.horizon_years} years`} />
        <Stat
          label="Ministry"
          value={data.ministry ? data.ministry.name : "Cross-portfolio"}
        />
        <Stat
          label="Levers"
          value={String(Object.keys(data.lever_settings).length)}
        />
      </div>

      {output ? (
        <>
          <section className="mt-16">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              Projected GDP growth path (P10 · P50 · P90)
            </h3>
            <table className="mt-4 w-full text-sm" data-numeric>
              <thead>
                <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
                  <th className="py-2 font-normal">Year</th>
                  <th className="py-2 text-right font-normal">P10</th>
                  <th className="py-2 text-right font-normal">P50</th>
                  <th className="py-2 text-right font-normal">P90</th>
                </tr>
              </thead>
              <tbody>
                {output.years.map((y, i) => {
                  const p = output.gdpGrowthPath[i];
                  return (
                    <tr key={y} className="border-b border-line-200/60">
                      <td className="py-3 font-mono">{y}</td>
                      <td className="py-3 text-right font-mono text-ink-500">{p.p10.toFixed(2)}%</td>
                      <td className="py-3 text-right font-mono">{p.p50.toFixed(2)}%</td>
                      <td className="py-3 text-right font-mono text-ink-500">{p.p90.toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="mt-14">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              Sector impact
            </h3>
            <table className="mt-4 w-full text-sm" data-numeric>
              <thead>
                <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
                  <th className="py-2 font-normal">Sector</th>
                  <th className="py-2 text-right font-normal">Share end</th>
                  <th className="py-2 text-right font-normal">Δ pp</th>
                </tr>
              </thead>
              <tbody>
                {output.sectorImpacts.map((s) => {
                  const meta = CANONICAL_SECTORS.find((c) => c.slug === s.sector_code);
                  return (
                    <tr key={s.sector_code} className="border-b border-line-200/60">
                      <td className="py-3">
                        <span
                          className="mr-3 inline-block h-3 w-1 align-middle"
                          style={{ backgroundColor: `var(${meta?.cssVar ?? "--ink-500"})` }}
                        />
                        {meta?.label ?? s.sector_code}
                      </td>
                      <td className="py-3 text-right font-mono">{s.share_pct_end.toFixed(2)}%</td>
                      <td className="py-3 text-right font-mono">
                        {s.delta_pp > 0 ? "+" : ""}
                        {s.delta_pp.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <p className="mt-16 text-sm text-ink-500">
          Results snapshot missing on this artifact. Re-run from the builder to attach output.
        </p>
      )}

      <section className="mt-14">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          Promotion history
        </h3>
        {data.promotions.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">No promotions recorded.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line-200 border-t border-line-200">
            {data.promotions.map((p) => (
              <li key={p.id} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-6 py-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                  {new Date(p.created_at).toISOString().slice(0, 10)}
                </span>
                <span className="text-sm">
                  {p.from_status} → <span className="text-ink-950">{p.to_status}</span>
                  {p.note ? ` · ${p.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line-200 pt-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <p className="mt-2 font-serif text-3xl text-ink-950" data-numeric>
        {value}
      </p>
    </div>
  );
}
