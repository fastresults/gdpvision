import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { SovereignEyeWorkspace, sovereignEyeQuery } from "@/components/sovereign-eye/SovereignEyeWorkspace";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/godseye")({
  head: ({ params }) => ({
    meta: [
      { title: `Sovereign Eye · ${params.code} — GDPVision` },
      {
        name: "description",
        content: `Country-scoped intelligence map for ${params.code}, combining corpus evidence, capital flows and live public feeds.`,
      },
      { property: "og:title", content: `Sovereign Eye · ${params.code}` },
      {
        property: "og:description",
        content: `Country-scoped intelligence map for ${params.code}, combining corpus evidence, capital flows and live public feeds.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SovereignEyeRoute,
  errorComponent: ({ error }) => (
    <SuperAdminShell wide crumbs={[{ label: "Countries", to: "/admin/countries" }, { label: "Sovereign Eye" }]}>
      <p className="text-sm text-signal-negative">{error.message}</p>
    </SuperAdminShell>
  ),
});

function SovereignEyeRoute() {
  const { code } = Route.useParams();
  const { data } = useSuspenseQuery(sovereignEyeQuery(code));
  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: data.country.name, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Sovereign Eye" },
      ]}
    >
      <SovereignEyeWorkspace code={code} />
    </SuperAdminShell>
  );
}