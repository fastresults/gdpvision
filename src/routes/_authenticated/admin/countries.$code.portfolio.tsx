import { createFileRoute, Link, Outlet, useParams, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { listMinistries } from "@/lib/scenarios.functions";
import { listMinistryProfiles } from "@/lib/country-data/manage.functions";

function ministriesQuery(code: string) {
  return queryOptions({
    queryKey: ["portfolio-ministries", code],
    queryFn: () => listMinistries({ data: { countryCode: code } }),
  });
}
function profilesQuery(code: string) {
  return queryOptions({
    queryKey: ["portfolio-minister-profiles", code],
    queryFn: () => listMinistryProfiles({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/portfolio")({
  head: ({ params }) => ({
    meta: [
      { title: `Portfolios · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(ministriesQuery(params.code)),
      context.queryClient.ensureQueryData(profilesQuery(params.code)),
    ]);
  },
  errorComponent: ({ error }) => (
    <div className="min-h-dvh grid place-items-center bg-paper-0 p-8 text-center">
      <p className="max-w-md text-sm text-red-600">{error.message}</p>
    </div>
  ),
  component: PortfolioLayout,
});

const COLLAPSE_KEY = (code: string) => `chamber02.rail.collapsed.${code}`;

function PortfolioLayout() {
  const { code } = Route.useParams();
  const params = useParams({ strict: false }) as { ministry?: string };
  const activeSlug = params.ministry;
  const router = useRouter();

  const { data: ministries } = useSuspenseQuery(ministriesQuery(code));
  const { data: profiles } = useSuspenseQuery(profilesQuery(code));

  const profileBySlug = useMemo(
    () => new Map(profiles.map((p) => [p.ministry_slug, p])),
    [profiles],
  );

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY(code)) === "1");
  }, [code]);
  function toggleCollapse() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(COLLAPSE_KEY(code), next ? "1" : "0");
      return next;
    });
  }

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ministries;
    return ministries.filter(
      (m) => m.name.toLowerCase().includes(q) || m.slug.toLowerCase().includes(q),
    );
  }, [ministries, query]);

  function preload(slug: string) {
    router.preloadRoute({
      to: "/admin/countries/$code/portfolio/$ministry",
      params: { code, ministry: slug },
    }).catch(() => {});
  }

  return (
    <SuperAdminShell
      eyebrow="Chamber 02 · Portfolio Workspaces"
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Portfolios" },
      ]}
    >
      <div className="min-h-dvh bg-paper-0 text-ink-950">
        <header className="border-b border-line-200 px-8 py-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            {code} · Chamber 02
          </p>
          <h1 className="mt-2 font-serif text-3xl text-ink-950">Portfolio Workspaces</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-500">
            One workspace per ministerial portfolio. Select a ministry to open its minister,
            sectors, KPIs and scenarios.
          </p>
        </header>

        {ministries.length === 0 ? (
          <div className="px-8 py-16">
            <p className="max-w-xl text-sm text-ink-500">
              No portfolios configured for {code} yet. Finish Stage 09 (Ministry &amp; Portfolio
              Mapping) in{" "}
              <Link
                to="/admin/countries/$code/onboard"
                params={{ code }}
                className="underline underline-offset-4 hover:text-ink-950"
              >
                onboarding
              </Link>{" "}
              to populate this chamber.
            </p>
          </div>
        ) : (
          <div
            className="grid gap-0 border-t border-line-200"
            style={{ gridTemplateColumns: collapsed ? "56px 1fr" : "300px 1fr" }}
          >
            <aside className="sticky top-0 self-start border-r border-line-200 bg-paper-0">
              <div className="flex items-center justify-between px-3 py-3">
                {!collapsed && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    {filtered.length}/{ministries.length} ministries
                  </span>
                )}
                <button
                  onClick={toggleCollapse}
                  className="ml-auto grid h-7 w-7 place-items-center border border-line-200 text-ink-500 hover:text-ink-950"
                  aria-label={collapsed ? "Expand rail" : "Collapse rail"}
                >
                  {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
              </div>
              {!collapsed && (
                <div className="relative px-3 pb-3">
                  <Search
                    size={12}
                    className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink-500"
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    className="w-full border border-line-200 bg-transparent py-1.5 pl-6 pr-2 text-xs focus:border-ink-950 focus:outline-none"
                  />
                </div>
              )}
              <ul className="max-h-[calc(100dvh-11rem)] overflow-y-auto border-t border-line-200">
                {filtered.map((m) => {
                  const active = m.slug === activeSlug;
                  const prof = profileBySlug.get(m.slug);
                  const minister =
                    (prof?.minister_profile as { name?: string } | null)?.name ??
                    prof?.minister ??
                    null;
                  return (
                    <li key={m.id}>
                      <Link
                        to="/admin/countries/$code/portfolio/$ministry"
                        params={{ code, ministry: m.slug }}
                        onMouseEnter={() => preload(m.slug)}
                        onFocus={() => preload(m.slug)}
                        className={
                          "block border-b border-line-200/60 px-3 py-3 transition " +
                          (active
                            ? "bg-paper-100 text-ink-950"
                            : "text-ink-700 hover:bg-paper-100")
                        }
                        title={m.name}
                      >
                        {collapsed ? (
                          <span className="grid h-8 w-8 place-items-center border border-line-200 font-mono text-[10px]">
                            {m.slug.slice(0, 2).toUpperCase()}
                          </span>
                        ) : (
                          <>
                            <p className="text-sm leading-snug">{m.name}</p>
                            <p className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-500">
                              <span>{m.sectors.length} sector{m.sectors.length === 1 ? "" : "s"}</span>
                              {minister && <span className="truncate">· {minister}</span>}
                            </p>
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
                {filtered.length === 0 && (
                  <li className="px-3 py-6 text-center text-xs text-ink-500">No matches.</li>
                )}
              </ul>
            </aside>

            <section className="min-h-[60dvh]">
              <Outlet />
            </section>
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
