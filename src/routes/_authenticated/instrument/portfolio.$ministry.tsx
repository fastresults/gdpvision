import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getPortfolio } from "@/lib/scenarios.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function portfolioQuery(countryCode: string, slug: string) {
  return queryOptions({
    queryKey: ["portfolio", countryCode, slug],
    queryFn: () => getPortfolio({ data: { countryCode, slug } }),
  });
}

export const Route = createFileRoute("/_authenticated/instrument/portfolio/$ministry")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.ministry} — Portfolio — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: PortfolioPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-8 py-24 text-ink-500">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em]">Portfolio unavailable</p>
      <p className="mt-4 text-sm">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-8 py-24 text-ink-500">Portfolio not found.</div>
  ),
});

function PortfolioPage() {
  const { ministry } = Route.useParams();
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const defaultCode =
    bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const [countryCode] = useState(defaultCode);
  const { data } = useSuspenseQuery(portfolioQuery(countryCode, ministry));

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <Link
        to="/instrument/portfolio"
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
      >
        ← Portfolios
      </Link>
      <div className="mt-6">
        <SectionHeader eyebrow={`${countryCode} · Portfolio`} title={data.ministry.name} />
      </div>

      <div className="mt-16 grid grid-cols-1 gap-16 lg:grid-cols-[1fr_1fr]">
        <section>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            Sectors in this portfolio
          </h3>
          <table className="mt-6 w-full text-sm" data-numeric>
            <thead>
              <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
                <th className="py-2 font-normal">Sector</th>
                <th className="py-2 text-right font-normal">GDP share</th>
                <th className="py-2 text-right font-normal">Weight</th>
              </tr>
            </thead>
            <tbody>
              {data.ministry.sectors.map((s) => {
                const meta = CANONICAL_SECTORS.find((c) => c.slug === s.sector_code);
                const comp = data.composition.find((c) => c.sector_code === s.sector_code);
                return (
                  <tr key={s.sector_code} className="border-b border-line-200/60">
                    <td className="py-3">
                      <Link
                        to="/instrument/sector/$code"
                        params={{ code: s.sector_code }}
                        className="inline-flex items-center hover:underline underline-offset-4"
                      >
                        <span
                          className="mr-3 inline-block h-3 w-1"
                          style={{ backgroundColor: `var(${meta?.cssVar ?? "--ink-500"})` }}
                        />
                        {meta?.label ?? s.sector_code}
                      </Link>
                    </td>
                    <td className="py-3 text-right font-mono">
                      {comp ? `${comp.share_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-3 text-right font-mono text-ink-500">
                      {s.weight.toFixed(0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              Scenarios ({data.scenarios.length})
            </h3>
            <Link
              to="/instrument/scenarios/new"
              search={{ ministry: data.ministry.slug }}
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:underline underline-offset-4"
            >
              New scenario →
            </Link>
          </div>
          {data.scenarios.length === 0 ? (
            <p className="mt-6 text-sm text-ink-500">
              No scenarios saved for this portfolio yet. Draft one from the Scenario Builder to
              begin modeling ripple effects on this ministry's sectors.
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-line-200 border-t border-line-200">
              {data.scenarios.map((s) => (
                <li key={s.id}>
                  <Link
                    to="/instrument/scenarios/$id"
                    params={{ id: s.id }}
                    className="grid grid-cols-[1fr_auto] items-center gap-6 py-4 hover:bg-paper-100"
                  >
                    <div>
                      <p className="text-ink-950">{s.title}</p>
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                        {s.status} · {new Date(s.updated_at).toISOString().slice(0, 10)}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                      Open →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
