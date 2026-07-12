import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { assertSuperAdmin } from "@/lib/country-onboarding/agents.functions";

// Super-admin gate for every route under /admin/*.
// Server functions already re-check `has_role('admin')`; this prevents
// non-supers from even rendering the pages.
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    try {
      await assertSuperAdmin();
    } catch {
      throw redirect({ to: "/instrument" });
    }
  },
  component: () => <Outlet />,
});
