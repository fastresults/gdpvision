import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowUpRight, Mail, Phone, Globe, Twitter, Linkedin } from "lucide-react";

import { getPortfolio } from "@/lib/scenarios.functions";
import { listMinistryProfiles } from "@/lib/country-data/manage.functions";
import { getVizOverview } from "@/lib/country-viz/viz.functions";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";
import { KpiSmallMultiples } from "@/components/viz/KpiSmallMultiples";

function portfolioQuery(code: string, slug: string) {
  return queryOptions({
    queryKey: ["portfolio", code, slug],
    queryFn: () => getPortfolio({ data: { countryCode: code, slug } }),
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

export const Route = createFileRoute("/_authenticated/admin/countries/$code/portfolio/$ministry")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.ministry} · Portfolio · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(portfolioQuery(params.code, params.ministry)),
      context.queryClient.ensureQueryData(profilesQuery(params.code)),
      context.queryClient.ensureQueryData(vizQuery(params.code)),
    ]);
  },
  errorComponent: ({ error }) => (
    <div className="px-8 py-16 text-sm text-red-600">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-8 py-16 text-sm text-ink-500">Portfolio not found.</div>
  ),
  component: PortfolioDetail,
});

type MinisterProfile = {
  name?: string | null;
  title?: string | null;
  party?: string | null;
  appointed_at?: string | null;
  bio?: string | null;
  portrait_url?: string | null;
  contact?: {
    email?: string | null;
    office_phone?: string | null;
    website?: string | null;
    office_address?: string | null;
  };
  socials?: {
    twitter?: string | null;
    linkedin?: string | null;
  };
};

function PortfolioDetail() {
  const { code, ministry } = Route.useParams();
  const { data } = useSuspenseQuery(portfolioQuery(code, ministry));
  const { data: profiles } = useSuspenseQuery(profilesQuery(code));
  const { data: viz } = useSuspenseQuery(vizQuery(code));

  const profileRow = profiles.find((p) => p.ministry_slug === ministry);
  const minister = (profileRow?.minister_profile ?? {}) as MinisterProfile;
  const sectorCodes = new Set(data.ministry.sectors.map((s) => s.sector_code));

  const scopedSectors = viz.sectors.filter((s) => sectorCodes.has(s.code));
  const scopedSeries = viz.sectorKpiSeries.filter((s) => sectorCodes.has(s.sector_code));

  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  return (
    <div className="px-8 py-10">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            {code} · Ministry
          </p>
          <h2 className="mt-1 font-serif text-3xl text-ink-950">{data.ministry.name}</h2>
        </div>
        <Link
          to="/admin/countries/$code/data"
          params={{ code }}
          search={{ tab: "ministries" }}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
        >
          Edit in Data Stores →
        </Link>
      </div>

      {/* Minister card */}
      <section className="mt-8 grid grid-cols-1 gap-6 border border-line-200 bg-paper-0 p-6 md:grid-cols-[120px_1fr]">
        <div>
          {minister.portrait_url ? (
            <img
              src={minister.portrait_url}
              alt={minister.name ?? "Minister portrait"}
              className="h-28 w-28 border border-line-200 object-cover"
            />
          ) : (
            <div className="grid h-28 w-28 place-items-center border border-line-200 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              No portrait
            </div>
          )}
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            Minister
          </p>
          <p className="mt-1 font-serif text-xl text-ink-950">
            {minister.name ?? "Not on record"}
          </p>
          {(minister.title || minister.party) && (
            <p className="mt-1 text-xs text-ink-500">
              {[minister.title, minister.party].filter(Boolean).join(" · ")}
            </p>
          )}
          {minister.bio && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-700">{minister.bio}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-4 font-mono text-[11px] text-ink-500">
            {minister.contact?.email && (
              <a
                href={`mailto:${minister.contact.email}`}
                className="inline-flex items-center gap-1 hover:text-ink-950"
              >
                <Mail size={12} /> {minister.contact.email}
              </a>
            )}
            {minister.contact?.office_phone && (
              <span className="inline-flex items-center gap-1">
                <Phone size={12} /> {minister.contact.office_phone}
              </span>
            )}
            {minister.contact?.website && (
              <a
                href={minister.contact.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-ink-950"
              >
                <Globe size={12} /> Website
              </a>
            )}
            {minister.socials?.twitter && (
              <a
                href={minister.socials.twitter}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-ink-950"
              >
                <Twitter size={12} /> Twitter
              </a>
            )}
            {minister.socials?.linkedin && (
              <a
                href={minister.socials.linkedin}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-ink-950"
              >
                <Linkedin size={12} /> LinkedIn
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Sectors table */}
      <section className="mt-12">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
          Sectors in this portfolio ({data.ministry.sectors.length})
        </h3>
        {data.ministry.sectors.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">
            No sectors mapped to this ministry yet.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm" data-numeric>
            <thead>
              <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
                <th className="py-2 font-normal">Sector</th>
                <th className="py-2 text-right font-normal">GDP share</th>
                <th className="py-2 text-right font-normal">Weight</th>
                <th className="py-2 text-right font-normal">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {data.ministry.sectors.map((s) => {
                const meta = CANONICAL_SECTORS.find((c) => c.slug === s.sector_code);
                const comp = data.composition.find((c) => c.sector_code === s.sector_code);
                return (
                  <tr key={s.sector_code} className="border-b border-line-200/60">
                    <td className="py-3">
                      <span
                        className="mr-3 inline-block h-3 w-1 align-middle"
                        style={{ backgroundColor: `var(${meta?.cssVar ?? "--ink-500"})` }}
                      />
                      {meta?.label ?? s.sector_code}
                    </td>
                    <td className="py-3 text-right font-mono">
                      {comp ? `${comp.share_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-3 text-right font-mono text-ink-500">
                      {s.weight.toFixed(0)}
                    </td>
                    <td className="py-3 text-right font-mono text-ink-500">
                      {comp?.confidence_grade ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* KPI strip */}
      {scopedSectors.length > 0 && (
        <section className="mt-12">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            Headline KPIs
          </h3>
          <div className="mt-4">
            <KpiSmallMultiples
              countryCode={code}
              sectors={scopedSectors}
              series={scopedSeries}
              allKpis={viz.allKpis}
              selected={selectedSector}
              onSelect={setSelectedSector}
            />
          </div>
        </section>
      )}

      {/* Scenarios */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            Scenarios ({data.scenarios.length})
          </h3>
          <Link
            to="/instrument/scenarios/new"
            search={{ ministry: data.ministry.slug }}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:underline underline-offset-4"
          >
            New scenario <ArrowUpRight size={12} />
          </Link>
        </div>
        {data.scenarios.length === 0 ? (
          <p className="mt-4 max-w-xl text-sm text-ink-500">
            No scenarios saved for this portfolio yet. Draft one from the Scenario Engine to begin
            modeling ripple effects on this ministry's sectors.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line-200 border-t border-line-200">
            {data.scenarios.map((s) => (
              <li key={s.id}>
                <Link
                  to="/instrument/scenarios/$id"
                  params={{ id: s.id }}
                  className="grid grid-cols-[1fr_auto] items-center gap-6 py-4 hover:bg-paper-100"
                >
                  <div>
                    <p className="text-ink-950">{s.title}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                      {s.status} · {new Date(s.updated_at).toISOString().slice(0, 10)}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
