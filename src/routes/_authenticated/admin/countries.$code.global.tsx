import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { SovereignEyeWorkspace, sovereignEyeQuery } from "@/components/sovereign-eye/SovereignEyeWorkspace";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/global")({
  head: ({ params }) => ({
    meta: [
      { title: `Global view · ${params.code} — GDPVision` },
      { name: "description", content: `Globe centred on ${params.code} with the Caribbean basin, cited capital-flow partner arcs and live NOAA/USGS hazards.` },
      { property: "og:title", content: `Global view · ${params.code}` },
      { property: "og:description", content: `Globe centred on ${params.code} with the Caribbean basin, partner arcs and live hazards.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GlobalViewRoute,
  errorComponent: ({ error }) => (
    <SuperAdminShell wide crumbs={[{ label: "Countries", to: "/admin/countries" }, { label: "Global view" }]}>
      <p className="text-sm text-signal-negative">{error.message}</p>
    </SuperAdminShell>
  ),
});

function GlobalViewRoute() {
  const { code } = Route.useParams();
  const { data } = useSuspenseQuery(sovereignEyeQuery(code));
  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: data.country.name, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Global view" },
      ]}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Global view</p>
          <h1 className="font-serif text-2xl text-ink-950">{data.country.name} in the world</h1>
        </div>
        <Link to="/admin/countries/$code/godseye" params={{ code }} className="btn-secondary min-h-9 px-3 font-mono text-[10px] uppercase tracking-[0.16em]">
          Open full Sovereign Eye
        </Link>
      </div>
      <SovereignEyeWorkspace code={code} initialMode="globe" />
    </SuperAdminShell>
  );
}
