// Country Console layout — country-user chrome. Never mentions chambers.

import { useState } from "react";
import { createFileRoute, Link, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Menu, X } from "lucide-react";

import { getMyCountryStatus } from "@/lib/country-admin.functions";
import { flagUrl } from "@/lib/caricom-registry";
import { Wordmark } from "@/components/marketing/Wordmark";
import { useImpersonation } from "@/lib/impersonation";
import { supabase } from "@/integrations/supabase/client";

const statusQuery = queryOptions({
  queryKey: ["my-country-status"],
  queryFn: () => getMyCountryStatus(),
});

export const Route = createFileRoute("/_authenticated/console")({
  head: () => ({
    meta: [
      { title: "Your console — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(statusQuery);
    return null;
  },
  component: ConsoleLayout,
});

function ConsoleLayout() {
  const { data: status } = useSuspenseQuery(statusQuery);
  const params = useParams({ strict: false }) as { code?: string };
  const { state: viewAs, exit } = useImpersonation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Resolve which country this session is scoped to.
  const code =
    params.code ??
    viewAs?.country_code ??
    status.bindings.find((b) => b.is_default)?.country_code ??
    status.bindings[0]?.country_code ??
    null;

  const countryName = status.bindings.find((b) => b.country_code === code)?.name ?? null;

  const flag = code ? flagUrl(code, "w160") : null;

  const nav = code
    ? [
        { to: "/console/$code" as const, label: "Study", exact: true },
        { to: "/console/$code/requests" as const, label: "Requests" },
        { to: "/console/$code/request/new" as const, label: "Start a request", primary: true },
      ]
    : [];

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="min-h-screen bg-paper-50 text-ink-950">
      {viewAs?.country_code && (
        <div className="border-b border-line-200 bg-ink-950 text-paper-50">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2 text-xs uppercase tracking-[0.2em]">
            <span>Testing · viewing as country user for {viewAs.country_code}</span>
            <button
              onClick={() => {
                exit();
                window.location.href = "/home";
              }}
              className="border border-paper-50/30 px-3 py-1 text-[10px] hover:bg-paper-50 hover:text-ink-950"
            >
              Exit view-as
            </button>
          </div>
        </div>
      )}

      <header className="border-b border-line-200 bg-paper-0/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/console/$code" params={{ code: code ?? "" }} className="flex items-center gap-3">
            <Wordmark className="text-ink-950" />
            {flag && (
              <>
                <span className="text-line-200">·</span>
                <img src={flag} alt="" className="h-4 w-6 rounded-sm object-cover" />
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                  {countryName ?? code}
                </span>
              </>
            )}
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            {nav.map((item) => {
              const isActive = item.exact
                ? pathname === `/console/${code}`
                : pathname.startsWith(item.to.replace("$code", code ?? ""));
              const cls = item.primary
                ? "btn-primary px-4 py-2 text-sm"
                : `px-3 py-2 ${isActive ? "text-ink-950 underline underline-offset-4" : "text-ink-500 hover:text-ink-950"}`;
              return (
                <Link key={item.to} to={item.to} params={{ code: code ?? "" }} className={cls}>
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={signOut}
              className="ml-2 px-3 py-2 text-xs uppercase tracking-[0.15em] text-ink-500 hover:text-ink-950"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line-200 py-8 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
        A GDPVision instrument · operated by Open Interactive
      </footer>
    </div>
  );
}
