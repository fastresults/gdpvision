import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import {
  listOnboardingCountries,
  listOnboardingRuns,
} from "@/lib/country-onboarding/agents.functions";
import { ONBOARDING_STAGES } from "@/lib/country-onboarding/stages";

const STAGES = ONBOARDING_STAGES.map((s, i) => ({
  key: s.key,
  label: s.short,
  num: i + 1,
  title: `${s.label} — ${s.desc}`,
}));

const countriesQuery = queryOptions({
  queryKey: ["onboarding", "countries"],
  queryFn: () => listOnboardingCountries(),
});
const runsQuery = queryOptions({
  queryKey: ["onboarding", "runs"],
  queryFn: () => listOnboardingRuns(),
});

type StatusFilter = "all" | "not-started" | "in-progress" | "complete";

export const Route = createFileRoute("/_authenticated/admin/countries/")({
  head: () => ({
    meta: [
      { title: "Country onboarding — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(countriesQuery),
      context.queryClient.ensureQueryData(runsQuery),
    ]);
  },
  component: CountriesQueue,
  errorComponent: ({ error }) => (
    <SuperAdminShell crumbs={[{ label: "Countries" }]}>
      <p className="text-sm text-red-600">{error.message}</p>
    </SuperAdminShell>
  ),
  notFoundComponent: () => (
    <SuperAdminShell crumbs={[{ label: "Countries" }]}>
      <p className="text-sm">Not found.</p>
    </SuperAdminShell>
  ),
});

function CountriesQueue() {
  const { data: countries } = useSuspenseQuery(countriesQuery);
  const { data: runs } = useSuspenseQuery(runsQuery);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const lastActivityByCountry = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of runs as any[]) {
      if (!m.has(r.country_code)) m.set(r.country_code, r.started_at);
    }
    return m;
  }, [runs]);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (countries as any[])
      .filter((c) => {
        if (!qq) return true;
        return (
          c.name.toLowerCase().includes(qq) ||
          (c.iso3 ?? "").toLowerCase().includes(qq) ||
          c.code.toLowerCase().includes(qq)
        );
      })
      .filter((c) => {
        const doneCount = (c.completed_stages ?? []).length;
        if (filter === "not-started") return doneCount === 0;
        if (filter === "in-progress") return doneCount > 0 && doneCount < STAGES.length;
        if (filter === "complete") return doneCount === STAGES.length;
        return true;
      })
      .sort((a, b) => (b.completed_stages?.length ?? 0) - (a.completed_stages?.length ?? 0));
  }, [countries, q, filter]);

  const counts = useMemo(() => {
    let done = 0, started = 0, empty = 0;
    for (const c of countries as any[]) {
      const n = (c.completed_stages ?? []).length;
      if (n === 0) empty++;
      else if (n === STAGES.length) done++;
      else started++;
    }
    return { done, started, empty, total: countries.length };
  }, [countries]);

  return (
    <SuperAdminShell crumbs={[{ label: "Countries" }]}>
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="font-serif text-3xl">Country onboarding</h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-500">
              AI-first deep-research pipeline. Each country flows through five stages: profile → GDP →
              sector composition → ministries → ministry↔sector map. Every draft comes back with citations.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-right font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            <Stat label="Complete" value={counts.done} tone="emerald" />
            <Stat label="In progress" value={counts.started} tone="amber" />
            <Stat label="Not started" value={counts.empty} tone="muted" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, code, iso3…"
            className="flex-1 min-w-[240px] border border-line-200 bg-transparent px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
          />
          {(["all", "not-started", "in-progress", "complete"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border ${
                filter === f
                  ? "border-ink-950 bg-ink-950 text-paper-0"
                  : "border-line-200 text-ink-500 hover:text-ink-950"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="border border-line-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-100 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              <tr className="text-left">
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2">GDP</th>
                {STAGES.map((s) => (
                  <th key={s.key} title={s.title} className="px-1 py-2 text-center">{s.num}</th>
                ))}
                <th className="px-4 py-2 text-right">Progress</th>
                <th className="px-4 py-2 text-right">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c: any) => {
                const done = new Set<string>(c.completed_stages ?? []);
                const lastAt = lastActivityByCountry.get(c.code);
                return (
                  <tr key={c.code} className="border-t border-line-200 hover:bg-paper-100/50">
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/countries/$code/onboard"
                        params={{ code: c.code }}
                        className="font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                      <div className="text-xs text-ink-500">{c.iso3 ?? c.code}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.gdp_current_usd
                        ? `$${(Number(c.gdp_current_usd) / 1e9).toFixed(2)}B (${c.gdp_year})`
                        : <span className="text-ink-500">—</span>}
                    </td>
                    {STAGES.map((s) => (
                      <td key={s.key} className="px-2 py-3 text-center">
                        {done.has(s.key) ? (
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                        ) : (
                          <span className="inline-block h-2 w-2 rounded-full bg-ink-200" />
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-xs text-ink-500">
                      {done.size}/{STAGES.length}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-ink-500 whitespace-nowrap">
                      {lastAt ? new Date(lastAt).toLocaleDateString() : "—"}
                      {" · "}
                      <Link to="/admin/countries/$code/data" params={{ code: c.code }} className="underline hover:text-ink-950">Data</Link>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={STAGES.length + 4} className="px-4 py-8 text-center text-sm text-ink-500">
                    No countries match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "muted" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-700"
    : tone === "amber" ? "text-amber-700"
    : "text-ink-500";
  return (
    <div>
      <div className={`font-serif text-2xl ${toneClass}`} data-numeric>{value}</div>
      <div>{label}</div>
    </div>
  );
}
