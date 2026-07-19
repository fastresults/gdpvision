import { createFileRoute, redirect } from "@tanstack/react-router";

import { listInstanceBindings } from "@/lib/ledger.functions";
import { getMyCountryStatus } from "@/lib/country-admin.functions";

/**
 * Ambient `/narrative/*` is retired. Country identity for chamber routes
 * MUST live in the URL path — never fall back to bindings/defaults, or a
 * super-admin bouncing between chambers silently cross-contaminates
 * countries (e.g. KNA → LCA). Every request under `/narrative/*` is
 * redirected to the country-scoped `/admin/countries/$code/narrative/*`
 * tree, preserving deep links where an equivalent scoped route exists.
 */
export const Route = createFileRoute("/_authenticated/narrative")({
  beforeLoad: async ({ location }) => {
    const search = location.search as { code?: unknown; returnCode?: unknown };
    const fromQuery = typeof search?.code === "string" ? search.code.toUpperCase() : null;
    const fromReturn = typeof search?.returnCode === "string" ? search.returnCode.toUpperCase() : null;

    let code: string | null = null;
    if (fromQuery && /^[A-Z]{2,4}$/.test(fromQuery)) code = fromQuery;
    else if (fromReturn && /^[A-Z]{2,4}$/.test(fromReturn)) code = fromReturn;

    if (!code) {
      const bindings = await listInstanceBindings().catch(() => [] as Array<{ country_code: string; is_default?: boolean | null }>);
      code = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? null;
    }

    if (!code) {
      const status = await getMyCountryStatus().catch(() => null);
      if (status?.isGlobalAdmin) throw redirect({ to: "/admin/countries" });
      throw redirect({ to: "/onboarding/country" });
    }

    // Preserve deep links into signal detail; everything else lands on the
    // country-scoped Signal Desk.
    const signalMatch = location.pathname.match(/^\/narrative\/signal\/([^/]+)\/?$/);
    if (signalMatch) {
      throw redirect({
        to: "/admin/countries/$code/narrative/signal/$id",
        params: { code, id: signalMatch[1] },
      });
    }

    const libraryMatch = /^\/narrative\/(?:comms|library)(?:\/.*)?$/.test(location.pathname);
    if (libraryMatch) {
      throw redirect({
        to: "/admin/countries/$code/narrative/library",
        params: { code },
      });
    }

    throw redirect({
      to: "/admin/countries/$code/narrative",
      params: { code },
    });
  },
});
