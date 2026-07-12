import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listOnboardingCountries } from "@/lib/country-onboarding/agents.functions";

const STAGES = [
  { key: "profile", label: "Profile" },
  { key: "gdp", label: "GDP" },
  { key: "sector_composition", label: "Sectors" },
  { key: "ministries", label: "Ministries" },
  { key: "ministry_sector_map", label: "Ministry×Sector" },
] as const;

const countriesQuery = queryOptions({
  queryKey: ["onboarding", "countries"],
  queryFn: () => listOnboardingCountries(),
});

export const Route = createFileRoute("/_authenticated/admin/countries/")({
  head: () => ({
    meta: [
      { title: "Country onboarding — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(countriesQuery),
  component: CountriesQueue,
});

function CountriesQueue() {
  const { data } = useSuspenseQuery(countriesQuery);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <header className="space-y-2">
        <Link to="/_authenticated/admin" className="text-xs text-muted-foreground hover:underline">
          ← Admin
        </Link>
        <h1 className="text-2xl font-semibold">Country onboarding</h1>
        <p className="text-sm text-muted-foreground">
          AI-first deep-research pipeline. Each country flows through five stages: profile → GDP →
          sector composition → ministries → ministry↔sector map. Every draft comes back with citations.
        </p>
      </header>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-4 py-2">Country</th>
              <th className="px-4 py-2">GDP</th>
              {STAGES.map((s) => (
                <th key={s.key} className="px-2 py-2 text-center text-xs">{s.label}</th>
              ))}
              <th className="px-4 py-2 text-right">Progress</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c: any) => {
              const done = new Set<string>(c.completed_stages ?? []);
              return (
                <tr key={c.code} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <Link
                      to="/_authenticated/admin/countries/$code/onboard"
                      params={{ code: c.code }}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{c.iso3 ?? c.code}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {c.gdp_current_usd
                      ? `$${(Number(c.gdp_current_usd) / 1e9).toFixed(2)}B (${c.gdp_year})`
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  {STAGES.map((s) => (
                    <td key={s.key} className="px-2 py-3 text-center">
                      {done.has(s.key) ? (
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      ) : (
                        <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30" />
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {done.size}/{STAGES.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
