import { createFileRoute, Link, Outlet, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listInstanceBindings } from "@/lib/ledger.functions";
import { getMyCountryStatus } from "@/lib/country-admin.functions";
import { Wordmark } from "@/components/marketing/Wordmark";
import { supabase } from "@/integrations/supabase/client";

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
    <div className="min-h-dvh bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <div className="flex items-center gap-10">
          <Link to="/instrument"><Wordmark /></Link>
          <nav className="flex items-center gap-6 text-[11px] font-mono uppercase tracking-[0.2em] text-ink-500">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/instrument" }}
                activeProps={{ className: "text-ink-950" }}
                className="hover:text-ink-950"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-6 text-[11px] font-mono uppercase tracking-[0.2em] text-ink-500">
          <Link to="/codex" className="hover:text-ink-950">Codex</Link>
          <Link to="/config" className="hover:text-ink-950">Config</Link>
          <Link to="/admin" className="hover:text-ink-950">Admin</Link>
          <span data-numeric>{defaultCode}</span>
          <button onClick={signOut} className="hover:text-ink-950">Sign out</button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
