import { createFileRoute, Link, Outlet, useParams, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { CompareSlots } from "@/components/scenarios/CompareSlots";


import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { listScenarios } from "@/lib/scenarios.functions";

function scenariosQuery(code: string) {
  return queryOptions({
    queryKey: ["chamber03-scenarios", code],
    queryFn: () => listScenarios({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/scenarios")({
  head: ({ params }) => ({
    meta: [
      { title: `Scenario Engine · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(scenariosQuery(params.code)),
  component: ScenariosLayout,
});

const RAIL_KEY = (c: string) => `chamber03.rail.collapsed.${c}`;
const PINS_KEY = (c: string) => `chamber03.pins.${c}`;

export function readPins(code: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PINS_KEY(code));
    return raw ? (JSON.parse(raw) as string[]).slice(0, 4) : [];
  } catch {
    return [];
  }
}
export function writePins(code: string, pins: string[]) {
  window.localStorage.setItem(PINS_KEY(code), JSON.stringify(pins.slice(0, 4)));
}

function ScenariosLayout() {
  const { code } = Route.useParams();
  const params = useParams({ strict: false }) as { id?: string };
  const activeId = params.id;
  const router = useRouter();
  const { data: scenarios } = useSuspenseQuery(scenariosQuery(code));

  const [collapsed, setCollapsed] = useState(false);
  const [pinCount, setPinCount] = useState(0);
  useEffect(() => {
    setCollapsed(localStorage.getItem(RAIL_KEY(code)) === "1");
    setPinCount(readPins(code).length);
    const on = () => setPinCount(readPins(code).length);
    window.addEventListener("chamber03:pins", on);
    return () => window.removeEventListener("chamber03:pins", on);
  }, [code]);
  function toggle() {
    setCollapsed((v) => {
      const n = !v;
      localStorage.setItem(RAIL_KEY(code), n ? "1" : "0");
      return n;
    });
  }

  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const filt = scenarios.filter((s) => s.title.toLowerCase().includes(q.trim().toLowerCase()));
    const byStatus: Record<string, typeof scenarios> = {
      draft: [],
      shared: [],
      adopted: [],
      archived: [],
    };
    for (const s of filt) (byStatus[s.status] ??= []).push(s);
    return byStatus;
  }, [scenarios, q]);

  function preload(id: string) {
    router
      .preloadRoute({
        to: "/admin/countries/$code/scenarios/$id",
        params: { code, id },
      })
      .catch(() => {});
  }

  return (
    <SuperAdminShell
      wide
      eyebrow="Chamber 03 · Scenario Engine"

      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Scenarios" },
      ]}
    >
      <div className="min-h-dvh bg-paper-0 text-ink-950">
        <header className="mx-auto flex max-w-[1440px] flex-wrap items-baseline justify-between gap-4 border-b border-line-200 px-8 py-8">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
              {code} · Chamber 03
            </p>
            <h1 className="mt-2 font-serif text-3xl text-ink-950">The Scenario Engine</h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-500">
              Consequence-free rehearsal. Every lever change re-runs the pinned engine live.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
              engine v1_macro
            </span>
            <CompareSlots code={code} count={pinCount} />
            <Link
              to="/admin/countries/$code/scenarios/new"
              params={{ code }}
              className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-0 hover:bg-ink-700"
            >
              <Plus size={12} /> New scenario
            </Link>
          </div>
        </header>


        <div
          className="mx-auto grid max-w-[1440px] gap-0 border-t border-line-200"
          style={{ gridTemplateColumns: collapsed ? "56px 1fr" : "280px 1fr" }}
        >

          <aside className="sticky top-0 self-start border-r border-line-200 bg-paper-0">
            <div className="flex items-center justify-between px-3 py-3">
              {!collapsed && (
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  {scenarios.length} scenarios
                </span>
              )}
              <button
                onClick={toggle}
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
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="w-full border border-line-200 bg-transparent py-1.5 pl-6 pr-2 text-xs focus:border-ink-950 focus:outline-none"
                />
              </div>
            )}
            <div className="max-h-[calc(100dvh-13rem)] overflow-y-auto border-t border-line-200">
              {(["draft", "shared", "adopted", "archived"] as const).map((st) => {
                const items = groups[st] ?? [];
                if (collapsed && items.length === 0) return null;
                return (
                  <div key={st}>
                    {!collapsed && (
                      <p className="border-b border-line-200 bg-paper-100 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
                        {st} · {items.length}
                      </p>
                    )}
                    <ul>
                      {items.map((s) => {
                        const active = s.id === activeId;
                        return (
                          <li key={s.id}>
                            <Link
                              to="/admin/countries/$code/scenarios/$id"
                              params={{ code, id: s.id }}
                              onMouseEnter={() => preload(s.id)}
                              onFocus={() => preload(s.id)}
                              className={
                                "block border-b border-line-200/60 px-3 py-2.5 transition " +
                                (active
                                  ? "bg-paper-100 text-ink-950"
                                  : "text-ink-700 hover:bg-paper-100")
                              }
                              title={s.title}
                            >
                              {collapsed ? (
                                <span className="grid h-6 w-6 place-items-center border border-line-200 font-mono text-[9px]">
                                  {st[0].toUpperCase()}
                                </span>
                              ) : (
                                <>
                                  <p className="line-clamp-2 text-xs leading-snug">{s.title}</p>
                                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">
                                    {s.horizon_years}y ·{" "}
                                    {new Date(s.updated_at).toISOString().slice(0, 10)}
                                  </p>
                                </>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {scenarios.length === 0 && !collapsed && (
                <p className="px-3 py-6 text-center text-xs text-ink-500">
                  No scenarios yet. Draft the first.
                </p>
              )}
            </div>
          </aside>

          <section className="min-h-[60dvh]">
            <Outlet />
          </section>
        </div>
      </div>
    </SuperAdminShell>
  );
}
