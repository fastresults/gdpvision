import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { PrettyJson } from "@/components/data/PrettyJson";
import {
  listOnboardingCountries,
  listOnboardingRuns,
} from "@/lib/country-onboarding/agents.functions";
import {
  cancelMinisterBackfillRun,
  getMinisterBackfillRun,
  listMinisterBackfillRuns,
  startMinisterBackfill,
} from "@/lib/country-onboarding/minister-backfill.functions";
import {
  cancelPartyBackfillRun,
  getPartyBackfillRun,
  listPartyBackfillRuns,
  startPartyBackfill,
} from "@/lib/country-onboarding/party-backfill.functions";
import { ONBOARDING_STAGES } from "@/lib/country-onboarding/stages";

const BACKFILL_RUN_LS_KEY = "minister-backfill:active-run-id";
const PARTY_BACKFILL_RUN_LS_KEY = "party-backfill:active-run-id";

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

        <MinisterBackfillPanel countries={countries as Array<{ code: string; name: string }>} />
        <PartyBackfillPanel countries={countries as Array<{ code: string; name: string }>} />

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
                      <td key={s.key} title={s.title} className="px-1 py-3 text-center">
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

function MinisterBackfillPanel({ countries }: { countries: Array<{ code: string; name: string }> }) {
  const start = useServerFn(startMinisterBackfill);
  const fetchRun = useServerFn(getMinisterBackfillRun);
  const cancel = useServerFn(cancelMinisterBackfillRun);
  const fetchHistory = useServerFn(listMinisterBackfillRuns);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [force, setForce] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [runId, setRunId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(BACKFILL_RUN_LS_KEY);
  });
  const [error, setError] = useState<string | null>(null);

  // Poll the active run until terminal.
  const runQ = useQuery({
    queryKey: ["minister-backfill-run", runId],
    queryFn: () => fetchRun({ data: { run_id: runId! } }),
    enabled: !!runId,
    refetchInterval: (q) => {
      const status = (q.state.data as any)?.run?.status;
      return status && ["queued", "running"].includes(status) ? 3000 : false;
    },
  });

  const historyQ = useQuery({
    queryKey: ["minister-backfill-history"],
    queryFn: () => fetchHistory({ data: { limit: 10 } }),
    refetchInterval: runId ? 5000 : false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (runId) window.localStorage.setItem(BACKFILL_RUN_LS_KEY, runId);
    else window.localStorage.removeItem(BACKFILL_RUN_LS_KEY);
  }, [runId]);

  const status = (runQ.data as any)?.run?.status as string | undefined;
  const isActive = status === "queued" || status === "running";

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  async function handleStart() {
    setError(null);
    try {
      const r = await start({
        data: {
          country_codes: selected.size ? Array.from(selected) : undefined,
          force,
          dry_run: dryRun,
        },
      });
      setRunId(r.run_id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleCancel() {
    if (!runId) return;
    try {
      await cancel({ data: { run_id: runId } });
      runQ.refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const run = (runQ.data as any)?.run;
  const countryRuns = ((runQ.data as any)?.countries ?? []) as any[];
  const totals = (run?.totals ?? {}) as Record<string, number>;

  return (
    <details className="border border-line-200 bg-paper-100/40" open={!!runId}>
      <summary className="cursor-pointer px-4 py-3 text-[11px] font-mono uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
        Minister backfill · resolve minister names + profiles across countries
        {status && <span className="ml-2 text-ink-950">[{status}]</span>}
      </summary>
      <div className="space-y-4 border-t border-line-200 p-4">
        <div className="flex flex-wrap gap-2">
          {countries.map((c) => (
            <button
              key={c.code}
              onClick={() => toggle(c.code)}
              disabled={isActive}
              className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.18em] border ${
                selected.has(c.code)
                  ? "border-ink-950 bg-ink-950 text-paper-0"
                  : "border-line-200 text-ink-500 hover:text-ink-950"
              } disabled:opacity-50`}
            >
              {c.code}
            </button>
          ))}
          {selected.size > 0 && !isActive && (
            <button
              onClick={() => setSelected(new Set())}
              className="px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-ink-500 hover:text-ink-950"
            >
              clear
            </button>
          )}
        </div>
        <div className="text-xs text-ink-500">
          {selected.size === 0
            ? "No countries selected → will process ALL countries that have ministries."
            : `${selected.size} selected.`}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={isActive}
            />
            Dry run (no writes)
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              disabled={isActive}
            />
            Force refresh (re-resolve already-filled rows)
          </label>
          <div className="ml-auto flex items-center gap-2">
            {isActive ? (
              <button
                onClick={handleCancel}
                className="px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-red-600 text-red-600 hover:bg-red-600 hover:text-paper-0"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0"
              >
                {dryRun ? "Preview backfill" : "Run backfill"}
              </button>
            )}
            {runId && !isActive && (
              <button
                onClick={() => setRunId(null)}
                className="px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-line-200 text-ink-500 hover:text-ink-950"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        {run && (
          <div className="space-y-3">
            <div className="text-xs text-ink-500">
              run <span className="font-mono">{String(runId).slice(0, 8)}</span> · {status}
              {" · "}
              attempted {totals.attempted ?? 0} · resolved {totals.resolved ?? 0} · updated{" "}
              {totals.updated ?? 0} · skipped {totals.skipped ?? 0} · failed {totals.failed ?? 0}
              {run.error && <span className="text-red-600"> · {run.error}</span>}
            </div>
            <div className="border border-line-200">
              <table className="w-full text-xs">
                <thead className="bg-paper-100 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 text-left">
                  <tr>
                    <th className="px-3 py-2">Country</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Attempted</th>
                    <th className="px-3 py-2 text-right">Resolved</th>
                    <th className="px-3 py-2 text-right">Updated</th>
                    <th className="px-3 py-2 text-right">Skipped</th>
                    <th className="px-3 py-2 text-right">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {countryRuns.map((c) => (
                    <tr key={c.country_code} className="border-t border-line-200">
                      <td className="px-3 py-2 font-mono">{c.country_code}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            c.status === "succeeded"
                              ? "text-emerald-700"
                              : c.status === "running"
                              ? "text-amber-700"
                              : c.status === "failed"
                              ? "text-red-600"
                              : "text-ink-500"
                          }
                        >
                          {c.status}
                        </span>
                        {c.error && <span className="ml-2 text-red-600">{c.error}</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{c.attempted}</td>
                      <td className="px-3 py-2 text-right">{c.resolved}</td>
                      <td className="px-3 py-2 text-right">{c.updated}</td>
                      <td className="px-3 py-2 text-right">{c.skipped}</td>
                      <td className="px-3 py-2 text-right">{c.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-ink-500 hover:text-ink-950">
                Full per-ministry detail
              </summary>
              <PrettyJson value={countryRuns} />
            </details>
          </div>
        )}

        {(historyQ.data as any[])?.length ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-ink-500 hover:text-ink-950">
              Recent runs
            </summary>
            <ul className="mt-2 space-y-1">
              {((historyQ.data as any[]) ?? []).map((h) => (
                <li key={h.id} className="flex items-center gap-2 font-mono">
                  <button
                    onClick={() => setRunId(h.id)}
                    className="underline hover:text-ink-950"
                  >
                    {String(h.id).slice(0, 8)}
                  </button>
                  <span className="text-ink-500">{h.status}</span>
                  <span className="text-ink-500">
                    {new Date(h.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </details>
  );
}
