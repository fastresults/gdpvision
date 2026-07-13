import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { GdpVizStudio } from "@/components/viz/GdpVizStudio";
import { getOnboardingStatus } from "@/lib/country-onboarding/agents.functions";

const statusQuery = (code: string) =>
  queryOptions({
    queryKey: ["onboarding", "status", code],
    queryFn: () => getOnboardingStatus({ data: { countryCode: code } }),
  });

export const Route = createFileRoute("/_authenticated/admin/countries/$code/viz")({
  head: ({ params }) => ({
    meta: [
      { title: `GDP Visualizations — ${params.code} — GDPVision` },
      { name: "description", content: `Executive-grade GDP visualization studio for ${params.code}.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    const status = await context.queryClient.ensureQueryData(statusQuery(params.code));
    if (!(status as any).country) throw notFound();
  },
  component: VizPage,
  errorComponent: ({ error }) => (
    <SuperAdminShell crumbs={[{ label: "Countries", to: "/admin/countries" }, { label: "GDP Visualizations" }]}>
      <p className="text-sm text-signal-negative">{error.message}</p>
    </SuperAdminShell>
  ),
  notFoundComponent: () => (
    <SuperAdminShell crumbs={[{ label: "Countries", to: "/admin/countries" }]}>
      <p className="text-sm">Not in the registry.</p>
    </SuperAdminShell>
  ),
});

function VizPage() {
  const { code } = Route.useParams();
  const { data: status } = useSuspenseQuery(statusQuery(code));
  const country: any = (status as any).country;

  return (
    <SuperAdminShell
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: country?.name ?? code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "GDP Visualizations" },
      ]}
    >
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl">{country?.name} · GDP Visualizations</h1>
            <p className="text-sm text-ink-500 mt-1">
              Sector composition, ministerial coverage, KPI trends and fiscal horizon — drawn live from the corpus and second brain.
            </p>
          </div>
          <Link
            to="/admin/countries/$code/data"
            params={{ code }}
            className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] border border-line-200 text-ink-500 hover:text-ink-950"
          >
            Back to data stores
          </Link>
        </header>

        <GdpVizStudio code={code} />
      </div>
    </SuperAdminShell>
  );
}
