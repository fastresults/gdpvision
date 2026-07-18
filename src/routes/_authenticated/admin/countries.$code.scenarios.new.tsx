import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Lock, LockOpen, RotateCcw } from "lucide-react";

import {
  getScenario,
  listMinistries,
  runScenarioEngine,
  saveScenario,
  type EngineRunResult,
} from "@/lib/scenarios.functions";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";
import { GdpFanChart } from "@/components/scenarios/GdpFanChart";
import { SectorWaterfall } from "@/components/scenarios/SectorWaterfall";
import { AttributionStack } from "@/components/scenarios/AttributionStack";
import { TornadoStrip, type TornadoRow } from "@/components/scenarios/TornadoStrip";
import { PlaybookChips } from "@/components/scenarios/PlaybookChips";
import { NarrativePanel } from "@/components/scenarios/NarrativePanel";
import { PLAYBOOKS } from "@/lib/scenarios/playbooks";
import { writePins, readPins } from "./countries.$code.scenarios";

const NewSearch = z.object({
  ministry: z.string().optional(),
  fork: z.string().uuid().optional(),
});

function ministriesQuery(code: string) {
  return queryOptions({
    queryKey: ["scenarios-ministries", code],
    queryFn: () => listMinistries({ data: { countryCode: code } }),
  });
}
function initRunQuery(code: string) {
  return queryOptions({
    queryKey: ["engine-init", code],
    queryFn: () => runScenarioEngine({ data: { countryCode: code, horizonYears: 5, levers: {} } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/scenarios/new")({
  head: ({ params }) => ({
    meta: [
      { title: `New scenario · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s) => NewSearch.parse(s),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(ministriesQuery(params.code)),
      context.queryClient.ensureQueryData(initRunQuery(params.code)),
    ]);
  },
  component: Builder,
});

function Builder() {
  const { code } = Route.useParams();
  const search = useSearch({ from: "/_authenticated/admin/countries/$code/scenarios/new" });
  const navigate = useNavigate();

  const { data: ministries } = useSuspenseQuery(ministriesQuery(code));
  const { data: init } = useSuspenseQuery(initRunQuery(code));

  const fork = useQuery({
    queryKey: ["scenario-fork", search.fork],
    queryFn: () => (search.fork ? getScenario({ data: { id: search.fork } }) : null),
    enabled: Boolean(search.fork),
  });

  const [title, setTitle] = useState("Untitled scenario");
  const [ministrySlug, setMinistrySlug] = useState<string>(search.ministry ?? "");
  const [horizonYears, setHorizonYears] = useState(5);
  const [levers, setLevers] = useState<Record<string, number>>({});
  const [locks, setLocks] = useState<Record<string, boolean>>({});
  const [assumptionsNote, setAssumptionsNote] = useState("");
  const [activePlaybook, setActivePlaybook] = useState<string | null>("baseline");
  const seededRef = useRef(false);

  // Seed defaults once.
  useEffect(() => {
    if (seededRef.current) return;
    if (init.leverDefs.length === 0) return;
    seededRef.current = true;
    const seeded: Record<string, number> = {};
    for (const d of init.leverDefs) seeded[d.slug] = d.bounds.default ?? d.bounds.min;
    setLevers(seeded);
  }, [init.leverDefs]);

  // Apply fork on load.
  useEffect(() => {
    if (!fork.data) return;
    setTitle(`${fork.data.title} (fork)`);
    setHorizonYears(fork.data.horizon_years);
    setLevers({ ...fork.data.lever_settings });
    setActivePlaybook(null);
  }, [fork.data]);

  // Debounced live engine.
  const preview = useMutation({
    mutationFn: (payload: { levers: Record<string, number>; horizonYears: number }) =>
      runScenarioEngine({
        data: { countryCode: code, horizonYears: payload.horizonYears, levers: payload.levers },
      }),
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleRun(next: Record<string, number>, hy: number) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      preview.mutate({ levers: next, horizonYears: hy });
    }, 250);
  }

  function updateLever(slug: string, value: number) {
    if (locks[slug]) return;
    setActivePlaybook(null);
    const next = { ...levers, [slug]: value };
    setLevers(next);
    scheduleRun(next, horizonYears);
  }
  function updateHorizon(v: number) {
    setHorizonYears(v);
    scheduleRun(levers, v);
  }
  function applyPlaybook(id: string, next: Record<string, number>) {
    // Respect locks: keep locked lever values.
    const merged = { ...next };
    for (const [slug, locked] of Object.entries(locks)) if (locked) merged[slug] = levers[slug];
    setActivePlaybook(id);
    setLevers(merged);
    scheduleRun(merged, horizonYears);
  }
  function resetDefaults() {
    const d: Record<string, number> = {};
    for (const def of init.leverDefs) d[def.slug] = def.bounds.default ?? def.bounds.min;
    setActivePlaybook("baseline");
    setLevers(d);
    scheduleRun(d, horizonYears);
  }

  const current: EngineRunResult = preview.data ?? init;
  const year1 = current.output.gdpGrowthPath[0]?.p50 ?? 0;
  const yearEnd =
    current.output.gdpGrowthPath[current.output.gdpGrowthPath.length - 1]?.p50 ?? 0;
  const exposureEnd = current.output.exposurePath?.slice(-1)[0]?.p50 ?? null;

  // Sensitivity sweep for top-6 attributed levers.
  const [tornado, setTornado] = useState<TornadoRow[]>([]);
  const [sweeping, setSweeping] = useState(false);
  async function runSensitivity() {
    setSweeping(true);
    try {
      const top = [...current.output.attribution]
        .filter((a) => !locks[a.lever_slug])
        .sort((a, b) => Math.abs(b.contribution_pp) - Math.abs(a.contribution_pp))
        .slice(0, 6);
      const base = current.output.gdpGrowthPath[0]?.p50 ?? 0;
      const results = await Promise.all(
        top.map(async (a) => {
          const def = init.leverDefs.find((d) => d.slug === a.lever_slug);
          if (!def) return null;
          const range = def.bounds.max - def.bounds.min;
          const cur = levers[a.lever_slug] ?? def.bounds.default ?? def.bounds.min;
          const lo = Math.max(def.bounds.min, cur - range * 0.25);
          const hi = Math.min(def.bounds.max, cur + range * 0.25);
          const [r1, r2] = await Promise.all([
            runScenarioEngine({
              data: {
                countryCode: code,
                horizonYears,
                levers: { ...levers, [a.lever_slug]: lo },
              },
            }),
            runScenarioEngine({
              data: {
                countryCode: code,
                horizonYears,
                levers: { ...levers, [a.lever_slug]: hi },
              },
            }),
          ]);
          return {
            slug: a.lever_slug,
            low: r1.output.gdpGrowthPath[0]?.p50 ?? base,
            high: r2.output.gdpGrowthPath[0]?.p50 ?? base,
            base,
          } as TornadoRow;
        }),
      );
      setTornado(results.filter((r): r is TornadoRow => Boolean(r)));
    } finally {
      setSweeping(false);
    }
  }

  // Save.
  const save = useMutation({
    mutationFn: (opts: { pin?: boolean } = {}) =>
      saveScenario({
        data: {
          countryCode: code,
          ministrySlug: ministrySlug || null,
          sectorCode: null,
          title,
          horizonYears,
          levers,
          assumptions: {
            note: assumptionsNote,
            playbook: activePlaybook,
            locks,
          },
        },
      }).then((res) => ({ ...res, ...opts })),
    onSuccess: ({ id, pin }) => {
      if (pin) {
        const cur = readPins(code);
        if (!cur.includes(id)) writePins(code, [id, ...cur].slice(0, 4));
        window.dispatchEvent(new Event("chamber03:pins"));
      }
      navigate({ to: "/admin/countries/$code/scenarios/$id", params: { code, id } });
    },
  });

  // Group levers by sector.
  const grouped = useMemo(() => {
    const g: Record<string, typeof init.leverDefs> = {};
    for (const d of init.leverDefs) (g[d.sector_code] ??= []).push(d);
    return g;
  }, [init.leverDefs]);

  return (
    <div className="grid grid-cols-1 gap-0 xl:grid-cols-[320px_360px_1fr]">
      {/* Column A · Framing */}
      <aside className="border-r border-line-200 p-6">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full border-b border-line-200 bg-transparent py-1 font-serif text-xl outline-none focus:border-ink-950"
          />
        </label>

        <label className="mt-6 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Portfolio scope
          </span>
          <select
            value={ministrySlug}
            onChange={(e) => setMinistrySlug(e.target.value)}
            className="mt-2 w-full border border-line-200 bg-paper-0 px-2 py-1.5 text-sm focus:border-ink-950 focus:outline-none"
          >
            <option value="">Cross-portfolio</option>
            {ministries.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-6 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Horizon
          </span>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={10}
              value={horizonYears}
              onChange={(e) => updateHorizon(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-10 text-right font-mono text-sm tabular-nums">{horizonYears}y</span>
          </div>
        </label>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Playbooks
          </p>
          <div className="mt-2">
            <PlaybookChips
              defs={init.leverDefs}
              activeId={activePlaybook}
              onPick={applyPlaybook}
            />
          </div>
          <button
            onClick={resetDefaults}
            className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
          >
            <RotateCcw size={11} /> Reset to defaults
          </button>
          {activePlaybook && (
            <p className="mt-3 text-xs text-ink-500">
              {PLAYBOOKS.find((p) => p.id === activePlaybook)?.blurb}
            </p>
          )}
        </div>

        <label className="mt-6 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Assumptions & so-what
          </span>
          <textarea
            value={assumptionsNote}
            onChange={(e) => setAssumptionsNote(e.target.value)}
            placeholder="Frame the strategic question this scenario answers…"
            rows={5}
            className="mt-2 w-full border border-line-200 bg-paper-0 px-2 py-1.5 text-xs leading-relaxed focus:border-ink-950 focus:outline-none"
          />
        </label>
      </aside>

      {/* Column B · Levers */}
      <aside className="border-r border-line-200 p-6">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Policy levers
        </h3>
        {init.leverDefs.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">
            No levers configured for {code} yet. Define them in Data Stewards' onboarding.
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {Object.entries(grouped).map(([sectorCode, defs]) => {
              const meta = CANONICAL_SECTORS.find((c) => c.slug === sectorCode);
              return (
                <div key={sectorCode}>
                  <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-500">
                    <span
                      className="inline-block h-3 w-1"
                      style={{ backgroundColor: `var(${meta?.cssVar ?? "--ink-500"})` }}
                    />
                    {meta?.label ?? sectorCode}
                  </p>
                  <div className="mt-2 space-y-4">
                    {defs.map((def) => {
                      const value = levers[def.slug] ?? def.bounds.default ?? def.bounds.min;
                      const dflt = def.bounds.default ?? def.bounds.min;
                      const delta = value - dflt;
                      const locked = locks[def.slug];
                      return (
                        <div key={def.slug} className="border-t border-line-200/60 pt-3">
                          <div className="flex items-baseline justify-between gap-2">
                            <label
                              htmlFor={`lv-${def.slug}`}
                              className="min-w-0 truncate text-xs text-ink-950"
                              title={def.slug}
                            >
                              {def.slug}
                            </label>
                            <div className="flex items-center gap-2">
                              {Math.abs(delta) > 0.001 && (
                                <span
                                  className="font-mono text-[10px] tabular-nums"
                                  style={{
                                    color: delta > 0 ? "var(--sector-06)" : "var(--sector-04)",
                                  }}
                                >
                                  {delta > 0 ? "+" : ""}
                                  {delta.toFixed(1)}
                                </span>
                              )}
                              <span className="font-mono text-xs tabular-nums text-ink-950">
                                {value.toFixed(1)}
                              </span>
                              <button
                                onClick={() =>
                                  setLocks((p) => ({ ...p, [def.slug]: !p[def.slug] }))
                                }
                                className="text-ink-500 hover:text-ink-950"
                                aria-label={locked ? "Unlock lever" : "Lock lever"}
                              >
                                {locked ? <Lock size={11} /> : <LockOpen size={11} />}
                              </button>
                            </div>
                          </div>
                          <input
                            id={`lv-${def.slug}`}
                            type="range"
                            min={def.bounds.min}
                            max={def.bounds.max}
                            step={0.5}
                            value={value}
                            disabled={locked}
                            onChange={(e) => updateLever(def.slug, Number(e.target.value))}
                            className="mt-2 w-full disabled:opacity-40"
                          />
                          <div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">
                            <span>{def.bounds.min}</span>
                            <span>{def.bounds.max}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </aside>

      {/* Column C · Projection canvas */}
      <section className="p-6">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <Stat
            label="Year 1 · P50 GDP growth"
            value={`${year1 >= 0 ? "+" : ""}${year1.toFixed(2)}%`}
            delta={year1 - 2.0}
          />
          <Stat
            label={`Year ${horizonYears} · P50`}
            value={`${yearEnd >= 0 ? "+" : ""}${yearEnd.toFixed(2)}%`}
            delta={yearEnd - 2.0}
          />
          <Stat
            label="Exposure index end"
            value={exposureEnd === null ? "—" : exposureEnd.toFixed(1)}
          />
        </div>

        <section className="mt-8">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Projected GDP growth · P10 / P50 / P90
          </h3>
          <div className="mt-3">
            <GdpFanChart years={current.output.years} path={current.output.gdpGrowthPath} />
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Sector waterfall (Δ pp)
            </h3>
            <div className="mt-3">
              <SectorWaterfall impacts={current.output.sectorImpacts} />
            </div>
          </div>
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Attribution — lever contribution
            </h3>
            <div className="mt-3">
              <AttributionStack items={current.output.attribution} />
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Sensitivity (tornado)
            </h3>
            <button
              onClick={runSensitivity}
              disabled={sweeping}
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:underline underline-offset-4 disabled:opacity-50"
            >
              {sweeping ? "Sweeping…" : "Run sweep →"}
            </button>
          </div>
          {tornado.length > 0 ? (
            <div className="mt-3">
              <TornadoStrip rows={tornado} />
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-500">
              Sweep the top-6 attributed levers to reveal which ones move the outcome most.
            </p>
          )}
        </section>

        <section className="mt-10">
          <NarrativePanel
            initial={null}
            payload={{
              livePayload: {
                countryCode: code,
                title,
                horizonYears,
                levers,
                engineOutput: current.output as unknown as Record<string, unknown>,
              },
            }}
          />
        </section>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line-200 bg-paper-0/95 py-4 backdrop-blur">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {preview.isPending ? "Recomputing…" : "Live · engine v1_macro"}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={resetDefaults}
              className="border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
            >
              Reset
            </button>
            <button
              onClick={() => save.mutate({ pin: true })}
              disabled={save.isPending}
              className="border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 hover:border-ink-950 hover:text-ink-950 disabled:opacity-50"
            >
              Save & pin for compare
            </button>
            <button
              onClick={() => save.mutate({})}
              disabled={save.isPending}
              className="border border-ink-950 bg-ink-950 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save as draft"}
            </button>
          </div>
        </div>
        {save.error && (
          <p className="mt-3 text-xs text-red-600">{(save.error as Error).message}</p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="border-t border-line-200 pt-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <p className="mt-1 font-serif text-3xl text-ink-950" data-numeric>
        {value}
      </p>
      {typeof delta === "number" && Math.abs(delta) > 0.001 && (
        <p
          className="mt-1 font-mono text-[10px] tabular-nums"
          style={{ color: delta >= 0 ? "var(--sector-06)" : "var(--sector-04)" }}
        >
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(2)} pp vs baseline
        </p>
      )}
    </div>
  );
}
