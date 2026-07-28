import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getMyCountryStatus } from "@/lib/country-admin.functions";

// Gate for every route under /admin/*.
//
// Two audiences now share these routes:
//   1. Global admins — everything.
//   2. Country users — ONLY the eight chamber surfaces of the country they are
//      bound to. Agency surfaces (countries index, second brain, users,
//      invitations, activity, audits, onboarding, data, ledger-QA) stay
//      super-admin only.
//
// Server functions re-check authority themselves (has_role / has_country_access);
// this gate only prevents the wrong person rendering the page.

const COUNTRY_SURFACES = new Set([
  "executive",
  "ledger",
  "portfolio",
  "scenarios",
  "studio",
  "narrative",
  "cabinet",
  "personas",
  "mandate-compact",
]);

/** `/admin/countries/KNA/ledger/...` → `{ code: "KNA", surface: "ledger" }` */
function parseCountrySurface(pathname: string): { code: string; surface: string } | null {
  const m = /^\/admin\/countries\/([A-Za-z]{2,4})\/([a-z-]+)/.exec(pathname);
  if (!m) return null;
  return { code: m[1].toUpperCase(), surface: m[2] };
}

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context, location }) => {
    const status = await context.queryClient.ensureQueryData({
      queryKey: ["my-country-status"],
      queryFn: () => getMyCountryStatus(),
    });

    if (status.isGlobalAdmin) return { adminAudience: "agency" as const, countryScope: null };

    const target = parseCountrySurface(location.pathname);
    const bound =
      target &&
      COUNTRY_SURFACES.has(target.surface) &&
      status.bindings.some((b) => b.country_code.toUpperCase() === target.code);

    if (bound) return { adminAudience: "country" as const, countryScope: target!.code };

    throw redirect({ to: "/home" });
  },
  component: () => <Outlet />,
});
