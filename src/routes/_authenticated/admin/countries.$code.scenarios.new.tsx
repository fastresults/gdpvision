import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { RotateCcw, SlidersHorizontal, Pin, Save } from "lucide-react";

import {
  getScenario,
  listMinistries,
  runScenarioEngine,
  saveScenario,
  type EngineRunResult,
} from "@/lib/scenarios.functions";
import { GdpFanChart } from "@/components/scenarios/GdpFanChart";
import { SectorWaterfall } from "@/components/scenarios/SectorWaterfall";
import { AttributionStack } from "@/components/scenarios/AttributionStack";
import { TornadoStrip, type TornadoRow } from "@/components/scenarios/TornadoStrip";
import { PlaybookChips } from "@/components/scenarios/PlaybookChips";
import { NarrativePanel } from "@/components/scenarios/NarrativePanel";
import { StatStrip } from "@/components/scenarios/StatStrip";
import { LeversDrawer } from "@/components/scenarios/LeversDrawer";
import { EmptyLevers } from "@/components/scenarios/EmptyLevers";
import { CompareSlots } from "@/components/scenarios/CompareSlots";
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const [pinCount, setPinCount] = useState(0);
  const seededRef = useRef(false);

  useEffect(() => {
    setPinCount(readPins(code).length);
    const on = () => setPinCount(readPins(code).length);
    window.addEventListener("chamber03:pins", on);
    return () => window.removeEventListener("chamber03:pins", on);
  }, [code]);

  useEffect(() => {
    if (seededRef.current) return;
    if (init.leverDefs.length === 0) return;
    seededRef.current = true;
    const seeded: Record<string, number> = {};
    for (const d of init.leverDefs) seeded[d.slug] = d.bounds.default ?? d.bounds.min;
    setLevers(seeded);
  }, [init.leverDefs]);

  useEffect(() => {
    if (!fork.data) return;
    setTitle(`${fork.data.title} (fork)`);
    setHorizonYears(fork.data.horizon_years);
    setLevers({ ...fork.data.lever_settings });
    setActivePlaybook(null);
  }, [fork.data]);

  const preview = useMutation({
    mutationFn: (payload: { levers: Record<string, number>; horizonYears: number }) =>
      runScenarioEngine({
        data: { countryCode: code, horizonYears: payload.horizonYears, levers: payload.levers },
      }),
    onSuccess: () => setLastRunAt(Date.now()),
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
  function toggleLock(slug: string) {
    setLocks((p) => ({ ...p, [slug]: !p[slug] }));
  }

  const current: EngineRunResult = preview.data ?? init;
  const year1 = current.output.gdpGrowthPath[0]?.p50 ?? 0;
  const yearEnd =
    current.output.gdpGrowthPath[current.output.gdpGrowthPath.length - 1]?.p50 ?? 0;
  const year1Band = current.output.gdpGrowthPath[0];
  const yearEndBand =
    current.output.gdpGrowthPath[current.output.gdpGrowthPath.length - 1];
  const exposureEnd = current.output.exposurePath?.slice(-1)[0]?.p50 ?? null;
  const activeLeverCount = useMemo(() => {
    let n = 0;
    for (const def of init.leverDefs) {
      const dflt = def.bounds.default ?? def.bounds.min;
      if (Math.abs((levers[def.slug] ?? dflt) - dflt) > 0.001) n++;
    }
    return n;
  }, [levers, init.leverDefs]);

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
              data: { countryCode: code, horizonYears, levers: { ...levers, [a.lever_slug]: lo } },
            }),
            runScenarioEngine({
              data: { countryCode: code, horizonYears, levers: { ...levers, [a.lever_slug]: hi } },
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
          assumptions: { note: assumptionsNote, playbook: activePlaybook, locks },
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

  const hasLevers = init.leverDefs.length > 0;
  const ministryName =
    ministries.find((m) => m.slug === ministrySlug)?.name ?? "Cross-portfolio";
  const recomputedLabel = lastRunAt
    ? `Recomputed ${Math.max(0, Math.round((Date.now() - lastRunAt) / 100) / 10)}s ago · engine v1_macro`
    : "Live · engine v1_macro";

  return (
    <div className="mx-auto grid min-w-0 max-w-[1440px] grid-cols-1 gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
      {/* Column A · Framing */}
      <aside className="border-r border-line-200 p-6">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full border-b border-line-200 bg-transparent py-1 font-serif text-xl outline-none focus:border-ink-950"
          />
        </label>

        <label className="mt-6 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            Portfolio scope
          </span>
          <select
            value={ministrySlug}
            onChange={(e) => setMinistrySlug(e.target.value)}
            className="mt-2 w-full truncate border border-line-200 bg-paper-0 px-2 py-1.5 text-sm focus:border-ink-950 focus:outline-none"
            title={ministryName}
          >
            <option value="">Cross-portfolio</option>
            {ministries.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block truncate text-[11px] text-ink-500" title={ministryName}>
            {ministryName}
          </span>
        </label>

        <label className="mt-6 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
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
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            Playbooks
          </p>
          <div className="mt-2">
            <PlaybookChips defs={init.leverDefs} activeId={activePlaybook} onPick={applyPlaybook} />
          </div>
          <button
            onClick={resetDefaults}
            className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500 hover:text-ink-950"
          >
            <RotateCcw size={11} /> Reset to defaults
          </button>
        </div>

        <label className="mt-6 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
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

      {/* Column B · Canvas */}
      <section className="min-w-0">
        {/* Sticky action bar */}
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-line-200 bg-paper-0/95 px-6 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={
                "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] " +
                (preview.isPending ? "text-ink-950" : "text-ink-500")
              }
            >
              <span
                className={
                  "inline-block h-1.5 w-1.5 rounded-full " +
                  (preview.isPending ? "animate-pulse bg-ink-950" : "bg-emerald-500")
                }
              />
              {preview.isPending ? "Recomputing…" : recomputedLabel}
            </span>
            <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500 md:inline">
              · {activeLeverCount} lever{activeLeverCount === 1 ? "" : "s"} off default
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              disabled={!hasLevers}
              className="inline-flex items-center gap-1.5 border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-700 hover:border-ink-950 hover:text-ink-950 disabled:opacity-40"
            >
              <SlidersHorizontal size={12} /> Adjust levers · {activeLeverCount}
            </button>
            <CompareSlots code={code} count={pinCount} />
            <button
              onClick={() => save.mutate({})}
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-700 hover:border-ink-950 hover:text-ink-950 disabled:opacity-50"
            >
              <Save size={12} /> Save draft
            </button>
            <button
              onClick={() => save.mutate({ pin: true })}
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-0 hover:bg-ink-700 disabled:opacity-50"
            >
              <Pin size={12} /> {save.isPending ? "Saving…" : "Save & pin"}
            </button>
          </div>
        </div>

        <div className="px-6 py-6">
          {/* Stat strip */}
          <StatStrip
            pending={preview.isPending}
            cells={[
              {
                label: "Year 1 · P50 GDP growth",
                value: `${year1 >= 0 ? "+" : ""}${year1.toFixed(2)}%`,
                delta: year1 - 2.0,
                sub: year1Band
                  ? `P10 ${year1Band.p10.toFixed(2)} · P90 ${year1Band.p90.toFixed(2)}`
                  : undefined,
              },
              {
                label: `Year ${horizonYears} · P50 GDP growth`,
                value: `${yearEnd >= 0 ? "+" : ""}${yearEnd.toFixed(2)}%`,
                delta: yearEnd - 2.0,
                sub: yearEndBand
                  ? `P10 ${yearEndBand.p10.toFixed(2)} · P90 ${yearEndBand.p90.toFixed(2)}`
                  : undefined,
              },
              {
                label: "Exposure index · end",
                value: exposureEnd === null ? "—" : exposureEnd.toFixed(1),
              },
              {
                label: "Levers off default",
                value: `${activeLeverCount}`,
                sub: `${init.leverDefs.length} defined`,
              },
            ]}
          />

          {/* Fan chart */}
          <section className="mt-8 min-w-0">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
              Projected GDP growth · P10 / P50 / P90
            </h3>
            <div className="mt-3 min-w-0">
              <GdpFanChart years={current.output.years} path={current.output.gdpGrowthPath} />
            </div>
          </section>

          {/* Levers empty state OR waterfall / attribution */}
          {!hasLevers ? (
            <section className="mt-10">
              <EmptyLevers code={code} />
            </section>
          ) : (
            <section className="mt-10 grid grid-cols-1 gap-8 min-w-0 lg:grid-cols-2">
              <div className="min-w-0">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                  Sector waterfall (Δ pp)
                </h3>
                <div className="mt-3 min-w-0">
                  <SectorWaterfall impacts={current.output.sectorImpacts} />
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                  Attribution — lever contribution
                </h3>
                <div className="mt-3 min-w-0">
                  <AttributionStack items={current.output.attribution} />
                </div>
              </div>
            </section>
          )}

          {hasLevers && (
            <section className="mt-10">
              <div className="flex items-baseline justify-between">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                  Sensitivity (tornado)
                </h3>
                <button
                  onClick={runSensitivity}
                  disabled={sweeping}
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-950 hover:underline underline-offset-4 disabled:opacity-50"
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
          )}

          {/* Narrative */}
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

          {save.error && (
            <p className="mt-6 text-xs text-red-600">{(save.error as Error).message}</p>
          )}
        </div>
      </section>

      <LeversDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        defs={init.leverDefs}
        values={levers}
        locks={locks}
        onChange={updateLever}
        onToggleLock={toggleLock}
        onReset={resetDefaults}
        activeCount={activeLeverCount}
      />
    </div>
  );
}
