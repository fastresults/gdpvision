import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { MinisterGdpExposureCurve } from "@/components/portfolio/MinisterGdpExposureCurve";
import { Explain } from "@/components/explain/Explain";
import { listMinistries } from "@/lib/scenarios.functions";
import { listMinistryProfiles } from "@/lib/country-data/manage.functions";
import { getVizOverview } from "@/lib/country-viz/viz.functions";
import { assessDelivery } from "@/lib/portfolio/accountability";
import { listPortfolioDeliveryKpis } from "@/lib/portfolio/accountability.functions";
import "@/lib/explain/portfolio-entries";

function ministriesQuery(code: string) {
  return queryOptions({
    queryKey: ["portfolio-ministries", code],
    queryFn: () => listMinistries({ data: { countryCode: code } }),
  });
}
function profilesQuery(code: string) {
  return queryOptions({
    queryKey: ["portfolio-minister-profiles", code],
    queryFn: () => listMinistryProfiles({ data: { countryCode: code } }),
  });
}
function vizQuery(code: string) {
  return queryOptions({
    queryKey: ["viz-overview", code],
    queryFn: () => getVizOverview({ data: { countryCode: code } }),
  });
}
function deliveryQuery(code: string) {
  return queryOptions({
    queryKey: ["portfolio-delivery-kpis", code],
    queryFn: () => listPortfolioDeliveryKpis({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/portfolio/")({
  head: ({ params }) => ({
    meta: [
      { title: `Portfolios · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(ministriesQuery(params.code)),
      context.queryClient.ensureQueryData(profilesQuery(params.code)),
      context.queryClient.ensureQueryData(vizQuery(params.code)),
      context.queryClient.ensureQueryData(deliveryQuery(params.code)),
    ]);
  },
  component: PortfolioIndex,
});

function PortfolioIndex() {
  const { code } = Route.useParams();
  const { data: ministries } = useSuspenseQuery(ministriesQuery(code));
  const { data: profiles } = useSuspenseQuery(profilesQuery(code));
  const { data: viz } = useSuspenseQuery(vizQuery(code));
  const { data: deliveryKpis } = useSuspenseQuery(deliveryQuery(code));

  const rows = useMemo(() => {
    const profileBySlug = new Map(profiles.map((p) => [p.ministry_slug, p]));
    const compBySector = new Map(viz.sectors.map((s) => [s.code, s.share_pct]));
    return ministries
      .map((m) => {
        const scoped = deliveryKpis.filter((kpi) => kpi.ministry_id === m.id);
        const counts = { on: 0, risk: 0, off: 0, unscored: 0 };
        for (const kpi of scoped) counts[assessDelivery(kpi).status]++;
        const gdp = m.sectors.reduce((sum, s) => sum + (compBySector.get(s.sector_code) ?? 0), 0);
        const prof = profileBySlug.get(m.slug) as
          | { minister?: string | null; minister_profile?: { name?: string } | null }
          | undefined;
        const ministerName = prof?.minister_profile?.name ?? prof?.minister ?? null;
        const total = scoped.length;
        const qualified = counts.on + counts.risk + counts.off;
        const readiness = total ? Math.round((qualified / total) * 100) : 0;
        const riskScore = counts.off * 3 + counts.risk;
        return {
          slug: m.slug,
          name: m.name,
          minister: ministerName,
          sectorCount: m.sectors.length,
          gdp,
          counts,
          total,
          qualified,
          readiness,
          riskScore,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore || b.gdp - a.gdp);
  }, [ministries, deliveryKpis, profiles, viz.sectors]);

  if (ministries.length === 0) {
    return (
      <div className="grid min-h-[60dvh] place-items-center px-8 py-16">
        <div className="max-w-md text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            Chamber 02
          </p>
          <h2 className="mt-3 font-serif text-2xl text-ink-950">No portfolios configured yet</h2>
          <p className="mt-3 text-sm text-ink-500">
            Finish Stage 09 in onboarding to populate this chamber.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-10">
      <div className="max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
          Cabinet accountability grid
        </p>
        <h2 className="mt-1 font-serif text-2xl text-ink-950">
          Who owns what — and how is it performing today?
        </h2>
        <p className="mt-2 text-sm text-ink-500">
          One row per ministerial portfolio, ordered by delivery risk. Open any row for the full
          delivery dossier. To model a hypothetical change, hand off to{" "}
          <em>Chamber 03 · Scenario Engine</em>.
        </p>
      </div>

      <MinisterGdpExposureCurve code={code} points={rows} />

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-sm" data-numeric>
          <thead>
            <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
              <th className="py-2 font-normal">Portfolio · Minister</th>
              <th className="py-2 text-right font-normal">Sectors</th>
              <th className="py-2 text-right font-normal">GDP exposure</th>
              <th className="py-2 text-center font-normal">
                <Explain
                  id="portfolio.delivery-status"
                  ctx={{
                    qualified:
                      deliveryKpis.length -
                      deliveryKpis.filter((k) => assessDelivery(k).status === "unscored").length,
                    unscored: deliveryKpis.filter((k) => assessDelivery(k).status === "unscored")
                      .length,
                  }}
                >
                  On / At risk / Off
                </Explain>
              </th>
              <th className="py-2 text-right font-normal">Readiness</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-b border-line-200/60">
                <td className="py-3">
                  <p className="text-ink-950">{r.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-500">
                    {r.minister ?? "Minister not on record"}
                  </p>
                </td>
                <td className="py-3 text-right font-mono tabular-nums text-ink-500">
                  {r.sectorCount}
                </td>
                <td className="py-3 text-right font-mono tabular-nums">
                  {r.gdp > 0 ? `${r.gdp.toFixed(1)}%` : "—"}
                </td>
                <td className="py-3">
                  <div className="flex items-center justify-center gap-1 font-mono text-[11px] tabular-nums">
                    <span className="min-w-[28px] rounded-sm bg-emerald-50 px-1.5 py-0.5 text-center text-emerald-700">
                      {r.counts.on}
                    </span>
                    <span className="min-w-[28px] rounded-sm bg-amber-50 px-1.5 py-0.5 text-center text-amber-700">
                      {r.counts.risk}
                    </span>
                    <span className="min-w-[28px] rounded-sm bg-red-50 px-1.5 py-0.5 text-center text-red-700">
                      {r.counts.off}
                    </span>
                  </div>
                  {r.counts.unscored > 0 && (
                    <p className="mt-1 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">
                      {r.counts.unscored} unscored
                    </p>
                  )}
                </td>
                <td className="py-3 text-right font-mono tabular-nums text-ink-500">
                  {r.total ? `${r.qualified}/${r.total} · ${r.readiness}%` : "Not set up"}
                </td>
                <td className="py-3 text-right">
                  <Link
                    to="/admin/countries/$code/portfolio/$ministry"
                    params={{ code, ministry: r.slug }}
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:underline underline-offset-4"
                  >
                    Open dossier →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
