import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { listMinistries } from "@/lib/scenarios.functions";
import { listMinistryProfiles } from "@/lib/country-data/manage.functions";
import { getVizOverview } from "@/lib/country-viz/viz.functions";

const ON_TRACK_PCT = 5;
const NEAR_TRACK_PCT = 15;

type TrackStatus = "on" | "near" | "off" | "no-target";

function classifyTrack(
  latest: number | null | undefined,
  target: number | null | undefined,
  direction?: string | null,
): TrackStatus {
  if (latest == null || target == null || target === 0) return "no-target";
  const dir = (direction ?? "higher").toLowerCase();
  const raw = ((latest - target) / Math.abs(target)) * 100;
  const signed = dir.startsWith("lower") ? -raw : raw;
  const absv = Math.abs(signed);
  if (signed >= 0 || absv <= ON_TRACK_PCT) return "on";
  if (absv <= NEAR_TRACK_PCT) return "near";
  return "off";
}

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
    ]);
  },
  component: PortfolioIndex,
});

function PortfolioIndex() {
  const { code } = Route.useParams();
  const { data: ministries } = useSuspenseQuery(ministriesQuery(code));
  const { data: profiles } = useSuspenseQuery(profilesQuery(code));
  const { data: viz } = useSuspenseQuery(vizQuery(code));

  const kpiIndex = new Map(viz.allKpis.map((k) => [k.kpi_code, k]));
  const profileBySlug = new Map(profiles.map((p) => [p.ministry_slug, p]));
  const compBySector = new Map(viz.sectors.map((s) => [s.code, s.share_pct]));

  const rows = useMemo(() => {
    return ministries.map((m) => {
      const sectorCodes = new Set(m.sectors.map((s) => s.sector_code));
      const scoped = viz.sectorKpiSeries.filter((s) => sectorCodes.has(s.sector_code));
      const counts = { on: 0, near: 0, off: 0, "no-target": 0 } as Record<TrackStatus, number>;
      let withSource = 0;
      for (const s of scoped) {
        const meta = kpiIndex.get(s.kpi_code);
        const t = classifyTrack(s.latest, s.target, meta?.direction);
        counts[t]++;
        if (meta?.provenance && meta.provenance !== "unknown") withSource++;
      }
      const gdp = m.sectors.reduce((sum, s) => sum + (compBySector.get(s.sector_code) ?? 0), 0);
      const prof = profileBySlug.get(m.slug) as { minister?: string | null; minister_profile?: { name?: string } | null } | undefined;
      const ministerName =
        prof?.minister_profile?.name ?? prof?.minister ?? null;
      const total = scoped.length;
      const evidence = total ? Math.round((withSource / total) * 100) : 0;
      const riskScore = counts.off * 3 + counts.near;
      return {
        slug: m.slug,
        name: m.name,
        minister: ministerName,
        sectorCount: m.sectors.length,
        gdp,
        counts,
        total,
        evidence,
        riskScore,
      };
    }).sort((a, b) => b.riskScore - a.riskScore || b.gdp - a.gdp);
  }, [ministries, viz, kpiIndex, profileBySlug, compBySector]);

  if (ministries.length === 0) {
    return (
      <div className="grid min-h-[60dvh] place-items-center px-8 py-16">
        <div className="max-w-md text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            Chamber 02
          </p>
          <h2 className="mt-3 font-serif text-2xl text-ink-950">
            No portfolios configured yet
          </h2>
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
          One row per ministerial portfolio, ordered by delivery risk. Open any row for the full delivery dossier.
          To model a hypothetical change, hand off to <em>Chamber 03 · Scenario Engine</em>.
        </p>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-sm" data-numeric>
          <thead>
            <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
              <th className="py-2 font-normal">Portfolio · Minister</th>
              <th className="py-2 text-right font-normal">Sectors</th>
              <th className="py-2 text-right font-normal">GDP owned</th>
              <th className="py-2 text-center font-normal">On / At risk / Off</th>
              <th className="py-2 text-right font-normal">Evidence</th>
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
                      {r.counts.near}
                    </span>
                    <span className="min-w-[28px] rounded-sm bg-red-50 px-1.5 py-0.5 text-center text-red-700">
                      {r.counts.off}
                    </span>
                  </div>
                </td>
                <td className="py-3 text-right font-mono tabular-nums text-ink-500">
                  {r.total ? `${r.evidence}%` : "—"}
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
