import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { listInstanceBindings } from "@/lib/ledger.functions";
import {
  runScenarioEngine,
  saveScenario,
  type EngineRunResult,
} from "@/lib/scenarios.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

const NewSearch = z.object({
  ministry: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/instrument/scenarios/new")({
  head: () => ({
    meta: [
      { title: "New scenario — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search) => NewSearch.parse(search),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: ScenarioBuilder,
});

function ScenarioBuilder() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const search = useSearch({ from: "/_authenticated/instrument/scenarios/new" });
  const navigate = useNavigate();
  const defaultCode =
    bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";

  const [countryCode] = useState(defaultCode);
  const [title, setTitle] = useState("Untitled scenario");
  const [horizonYears, setHorizonYears] = useState(5);
  const [levers, setLevers] = useState<Record<string, number>>({});

  const initialRun = queryOptions({
    queryKey: ["engine-init", countryCode],
    queryFn: () =>
      runScenarioEngine({
        data: { countryCode, horizonYears: 5, levers: {} },
      }),
  });
  const { data: init } = useSuspenseQuery(initialRun);

  // Seed lever defaults once when engine defs arrive.
  useEffect(() => {
    if (init.leverDefs.length === 0) return;
    setLevers((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const seeded: Record<string, number> = {};
      for (const d of init.leverDefs) seeded[d.slug] = d.bounds.default ?? d.bounds.min;
      return seeded;
    });
  }, [init.leverDefs]);


  const preview = useMutation({
    mutationFn: (payload: { levers: Record<string, number>; horizonYears: number }) =>
      runScenarioEngine({
        data: { countryCode, horizonYears: payload.horizonYears, levers: payload.levers },
      }),
  });

  const save = useMutation({
    mutationFn: () =>
      saveScenario({
        data: {
          countryCode,
          ministrySlug: search.ministry ?? null,
          sectorCode: null,
          title,
          horizonYears,
          levers,
          assumptions: { note: "Drafted from Scenario Builder v1" },
        },
      }),
    onSuccess: ({ id }) => navigate({ to: "/instrument/scenarios/$id", params: { id } }),
  });

  const current: EngineRunResult = preview.data ?? init;

  function updateLever(slug: string, value: number) {
    const next = { ...levers, [slug]: value };
    setLevers(next);
    preview.mutate({ levers: next, horizonYears });
  }

  function updateHorizon(v: number) {
    setHorizonYears(v);
    preview.mutate({ levers, horizonYears: v });
  }

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <SectionHeader
        eyebrow={`${countryCode} · Scenario Builder · Engine ${current.output.model_version}`}
        title="Model a policy move"
        lede="Every lever change re-runs the pinned engine live. Save to freeze results as an artifact."
      />

      <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-[420px_1fr]">
        <aside className="border-t border-line-200 pt-6">
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              Title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full border-b border-line-200 bg-transparent py-2 font-serif text-2xl outline-none focus:border-ink-950"
            />
          </label>

          <label className="mt-8 block">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              Horizon
            </span>
            <div className="mt-2 flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={10}
                value={horizonYears}
                onChange={(e) => updateHorizon(Number(e.target.value))}
                className="flex-1"
              />
              <span className="font-mono tabular-nums w-14 text-right">{horizonYears}y</span>
            </div>
          </label>

          <div className="mt-10">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              Policy levers
            </h3>
            {init.leverDefs.length === 0 ? (
              <p className="mt-4 text-sm text-ink-500">
                No levers defined for this instance yet. Data Stewards define levers with bounds
                and a response function in Phase 2 onboarding.
              </p>
            ) : (
              <div className="mt-4 space-y-6">
                {init.leverDefs.map((def) => {
                  const sector = CANONICAL_SECTORS.find((s) => s.slug === def.sector_code);
                  const value = levers[def.slug] ?? def.bounds.default ?? def.bounds.min;
                  return (
                    <div key={def.slug} className="border-t border-line-200/60 pt-4">
                      <div className="flex items-baseline justify-between">
                        <label htmlFor={`lever-${def.slug}`} className="text-ink-950">
                          <span
                            className="mr-3 inline-block h-3 w-1 align-middle"
                            style={{ backgroundColor: `var(${sector?.cssVar ?? "--ink-500"})` }}
                          />
                          {def.slug}
                        </label>
                        <span className="font-mono tabular-nums">{value.toFixed(1)}</span>
                      </div>
                      <input
                        id={`lever-${def.slug}`}
                        type="range"
                        min={def.bounds.min}
                        max={def.bounds.max}
                        step={1}
                        value={value}
                        onChange={(e) => updateLever(def.slug, Number(e.target.value))}
                        className="mt-3 w-full"
                        aria-valuemin={def.bounds.min}
                        aria-valuemax={def.bounds.max}
                        aria-valuenow={value}
                      />
                      <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-ink-500">
                        <span>{def.bounds.min}</span>
                        <span>{def.bounds.max}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="mt-10 w-full border border-ink-950 bg-ink-950 py-3 font-mono text-[11px] uppercase tracking-[0.25em] text-paper-0 hover:bg-ink-700 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save as draft"}
          </button>
          {save.error ? (
            <p className="mt-4 text-sm text-red-600">
              {(save.error as Error).message}
            </p>
          ) : null}
        </aside>

        <section>
          <ProjectionCanvas result={current} />
          <SectorImpactList result={current} />
          <AttributionList result={current} />
        </section>
      </div>
    </main>
  );
}

function ProjectionCanvas({ result }: { result: EngineRunResult }) {
  const path = useMemo(() => bandPath(result.output.gdpGrowthPath), [result.output.gdpGrowthPath]);
  const p50Val = result.output.gdpGrowthPath[0]?.p50 ?? 0;

  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
        Projected GDP growth (P10 · P50 · P90)
      </h3>
      <p className="mt-4 font-serif text-6xl text-ink-950" data-numeric>
        {p50Val >= 0 ? "+" : ""}
        {p50Val.toFixed(2)}%
        <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          Year 1 median
        </span>
      </p>
      <svg viewBox="0 0 600 200" className="mt-6 h-56 w-full">
        <rect x={0} y={0} width={600} height={200} fill="var(--paper-100)" />
        <path d={path.band} fill="var(--sector-03)" opacity={0.15} />
        <path d={path.median} fill="none" stroke="var(--ink-950)" strokeWidth={1.5} />
        <line x1={0} y1={path.zeroY} x2={600} y2={path.zeroY} stroke="var(--line-200)" strokeDasharray="3 4" />
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-ink-500">
        {result.output.years.map((y) => (
          <span key={y}>{y}</span>
        ))}
      </div>
    </div>
  );
}

function SectorImpactList({ result }: { result: EngineRunResult }) {
  const sorted = [...result.output.sectorImpacts].sort(
    (a, b) => Math.abs(b.delta_pp) - Math.abs(a.delta_pp),
  );
  return (
    <div className="mt-14">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
        Sector impact at horizon end
      </h3>
      <table className="mt-4 w-full text-sm" data-numeric>
        <thead>
          <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
            <th className="py-2 font-normal">Sector</th>
            <th className="py-2 text-right font-normal">Share</th>
            <th className="py-2 text-right font-normal">Δ pp</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 8).map((s) => {
            const meta = CANONICAL_SECTORS.find((c) => c.slug === s.sector_code);
            return (
              <tr key={s.sector_code} className="border-b border-line-200/60">
                <td className="py-3">
                  <span
                    className="mr-3 inline-block h-3 w-1 align-middle"
                    style={{ backgroundColor: `var(${meta?.cssVar ?? "--ink-500"})` }}
                  />
                  {meta?.label ?? s.sector_code}
                </td>
                <td className="py-3 text-right font-mono">{s.share_pct_end.toFixed(2)}%</td>
                <td
                  className="py-3 text-right font-mono"
                  style={{ color: s.delta_pp === 0 ? "var(--ink-500)" : undefined }}
                >
                  {s.delta_pp > 0 ? "+" : ""}
                  {s.delta_pp.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AttributionList({ result }: { result: EngineRunResult }) {
  if (result.output.attribution.length === 0) return null;
  return (
    <div className="mt-14">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
        Attribution — contribution to GDP growth
      </h3>
      <ul className="mt-4 divide-y divide-line-200 border-t border-line-200">
        {result.output.attribution.map((a) => (
          <li
            key={a.lever_slug}
            className="grid grid-cols-[1fr_auto] items-baseline gap-4 py-3"
            data-numeric
          >
            <span>{a.lever_slug}</span>
            <span className="font-mono tabular-nums">
              {a.contribution_pp >= 0 ? "+" : ""}
              {a.contribution_pp.toFixed(2)} pp
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function bandPath(path: Array<{ p10: number; p50: number; p90: number }>) {
  const w = 600;
  const h = 200;
  const all = path.flatMap((p) => [p.p10, p.p90, 0]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const y = (v: number) => h - ((v - min) / range) * h;
  const x = (i: number) => (i / Math.max(1, path.length - 1)) * w;

  const top = path.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.p90).toFixed(1)}`).join(" ");
  const bottomRev = path
    .slice()
    .reverse()
    .map(
      (p, idx) =>
        `L${x(path.length - 1 - idx).toFixed(1)},${y(p.p10).toFixed(1)}`,
    )
    .join(" ");
  const band = `${top} ${bottomRev} Z`;
  const median = path.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.p50).toFixed(1)}`).join(" ");
  return { band, median, zeroY: y(0) };
}

