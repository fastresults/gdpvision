import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listInstanceBindings } from "@/lib/ledger.functions";
import { getMyCountryStatus } from "@/lib/country-admin.functions";
import { Wordmark } from "@/components/marketing/Wordmark";
import { NavControls } from "@/components/nav/NavControls";
import { supabase } from "@/integrations/supabase/client";
import { scrollToTop } from "@/lib/utils";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

export const Route = createFileRoute("/_authenticated/instrument")({
  loader: async ({ context }) => {
    const bindings = await context.queryClient.ensureQueryData(bindingsQuery);
    if (!bindings || bindings.length === 0) {
      // Super admins land on the country onboarding dashboard, not the
      // country-picker used by country admins.
      const status = await getMyCountryStatus().catch(() => null);
      if (status?.isGlobalAdmin) throw redirect({ to: "/admin/countries" });
      throw redirect({ to: "/onboarding/country" });
    }
  },
  component: InstrumentShell,
});

function InstrumentShell() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { returnCode?: string };
  const returnCode = typeof search?.returnCode === "string" ? search.returnCode : null;
  const defaultCode =
    bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = [
    { to: "/instrument", label: "Overview" },
    { to: "/instrument/portfolio", label: "Portfolios" },
    { to: "/instrument/scenarios", label: "Scenarios" },
    { to: "/instrument/studio/gap", label: "Studio" },
    { to: "/instrument/mandate/scorecard", label: "Mandate" },
    { to: "/instrument/cabinet", label: "Cabinet" },
    { to: "/instrument/exposure", label: "Exposure" },
    { to: "/instrument/stewardship", label: "Stewardship" },
  ] as const;

  return (
    <div className="min-h-dvh overflow-x-clip bg-paper-0 text-ink-950">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 overflow-hidden border-b border-line-200 px-4 py-4 sm:px-8 lg:flex lg:justify-between lg:gap-8 lg:py-5">
        <div className="flex min-w-0 items-center gap-4 lg:gap-10">
          <Link to="/instrument" onClick={() => scrollToTop()} className="hidden shrink-0 xl:block">
            <Wordmark />
          </Link>
          <NavControls className="shrink-0" />
          <nav className="flex min-w-0 items-center gap-6 overflow-x-auto text-[11px] font-mono uppercase tracking-[0.2em] text-ink-500">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/instrument" }}
                activeProps={{ className: "text-ink-950" }}
                className="shrink-0 hover:text-ink-950"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden shrink-0 items-center gap-6 text-[11px] font-mono uppercase tracking-[0.2em] text-ink-500 xl:flex">
          {returnCode && (
            <Link
              to="/admin/countries/$code/onboard"
              params={{ code: returnCode }}
              className="border border-line-200 px-3 py-1 text-ink-950 hover:border-ink-950"
            >
              ← Back to {returnCode} chambers
            </Link>
          )}
          <Link to="/codex" className="hover:text-ink-950">
            Codex
          </Link>
          <Link to="/config" className="hover:text-ink-950">
            Config
          </Link>
          <Link to="/admin" className="hover:text-ink-950">
            Admin
          </Link>
          <span data-numeric>{defaultCode}</span>
          <button onClick={signOut} className="hover:text-ink-950">
            Sign out
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
