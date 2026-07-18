import { createFileRoute, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import {
  getScenario,
  listMinistries,
  runScenarioEngine,
  saveScenario,
  type EngineRunResult,
} from "@/lib/scenarios.functions";
import { composePlaybooks, PLAYBOOKS, type Playbook } from "@/lib/scenarios/playbooks";
import { runLocalEngine } from "@/lib/scenarios/local-engine";
import { GdpFanChart } from "@/components/scenarios/GdpFanChart";
import { SectorWaterfall } from "@/components/scenarios/SectorWaterfall";
import { AttributionStack } from "@/components/scenarios/AttributionStack";
import { StatStrip } from "@/components/scenarios/StatStrip";
import { CompensationLedger } from "@/components/scenarios/CompensationLedger";
import { computeCompensation } from "@/lib/scenarios/compensation";
import { NarrativePanel } from "@/components/scenarios/NarrativePanel";
import { EmptyLevers } from "@/components/scenarios/EmptyLevers";
import { CompareSlots } from "@/components/scenarios/CompareSlots";
import { LeversDrawer } from "@/components/scenarios/LeversDrawer";
import { GuidedRail } from "@/components/scenarios/GuidedRail";
import { CoachTip } from "@/components/scenarios/CoachTip";
import { AiRecommendDrawer } from "@/components/scenarios/AiRecommendDrawer";
import { buildAiPlaybook } from "@/lib/scenarios/playbooks";
import type { RecommendedScenario } from "@/lib/scenarios/recommend-scenario.functions";
import { Sparkles } from "lucide-react";
import { RouteError } from "@/components/state/RouteState";
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

function ScenarioRouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="px-6 py-16">
      <RouteError
        title="Scenario Engine could not load"
        description={error.message || "The builder hit a recoverable loading issue."}
        onRetry={() => {
          reset();
          void router.invalidate();
        }}
      />
    </div>
  );
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
  errorComponent: ScenarioRouteError,
  component: Builder,
});

function Builder() {
  const { code } = Route.useParams();
  const search = useSearch({ from: "/_authenticated/admin/countries/$code/scenarios/new" });
  const navigate = useNavigate();

  const { data: ministries } = useSuspenseQuery(ministriesQuery(code));
  const { data: init } = useSuspenseQuery(initRunQuery(code));
  const queryClient = useQueryClient();

  const fork = useQuery({
    queryKey: ["scenario-fork", search.fork],
    queryFn: () => (search.fork ? getScenario({ data: { id: search.fork } }) : null),
    enabled: Boolean(search.fork),
  });

  const [step, setStep] = useState(1);
  const [furthest, setFurthest] = useState(1);
  const [title, setTitle] = useState("");
  const [ministrySlug, setMinistrySlug] = useState<string>(search.ministry ?? "");
  const [horizonYears, setHorizonYears] = useState(5);
  const [levers, setLevers] = useState<Record<string, number>>({});
  const [locks, setLocks] = useState<Record<string, boolean>>({});
  const [assumptionsNote, setAssumptionsNote] = useState("");
  const [activePlaybookIds, setActivePlaybookIds] = useState<Set<string>>(new Set());
  const [aiPlays, setAiPlays] = useState<Playbook[]>([]);
  const [showAllLevers, setShowAllLevers] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const [pinCount, setPinCount] = useState(0);
  const seededRef = useRef(false);

  // Ghost path — previous P50 curve so drag consequences are visible on the fan
  const [ghostPath, setGhostPath] = useState<EngineRunResult["output"]["gdpGrowthPath"] | null>(
    null,
  );

  // AI Recommend drawer
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiPreviewActive, setAiPreviewActive] = useState(false);

  function applyRecommendation(s: RecommendedScenario, mode: "preview" | "apply") {
    setGhostPath(current.output.gdpGrowthPath);
    const play = buildAiPlaybook(
      s.playbook.id,
      s.playbook.label,
      s.playbook.blurb,
      s.playbook.lever_moves,
      s.playbook.thesis,
      s.citations,
    );
    registerAiPlay(play);
    // respect locks — keep any locked lever at its current value
    const next = { ...s.levers };
    for (const [slug, locked] of Object.entries(locks)) if (locked) next[slug] = levers[slug];
    setLevers(next);
    setActivePlaybookIds(new Set([play.id]));
    if (mode === "apply") {
      if (s.title) setTitle(s.title);
      if (s.horizonYears) setHorizonYears(s.horizonYears);
      setAssumptionsNote(
        [
          s.thesis,
          s.assumptions.length ? `\n\nWhat must be true:\n- ${s.assumptions.join("\n- ")}` : "",
          s.risks.length ? `\n\nRisks:\n- ${s.risks.join("\n- ")}` : "",
        ]
          .join("")
          .slice(0, 4000),
      );
      setAiPreviewActive(false);
      setStep(3);
      setFurthest((f) => Math.max(f, 3));
    } else {
      setAiPreviewActive(true);
    }
  }

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
    setActivePlaybookIds(new Set());
    setFurthest(3);
  }, [fork.data]);

  // Real-time preview: the engine is pure and deterministic — compute it on
  // every state change so the fan chart, stat strip, waterfall and attribution
  // stack all bend within a single animation frame. Server `runScenarioEngine`
  // is only used to fetch the initial baseline + leverDefs and to persist on
  // save; results reconcile exactly because the same math runs both sides.
  const current: EngineRunResult = useMemo(
    () => runLocalEngine(init, levers, horizonYears),
    [init, levers, horizonYears],
  );
  useEffect(() => {
    setLastRunAt(Date.now());
  }, [current]);

  function updateLever(slug: string, value: number) {
    if (locks[slug]) return;
    setGhostPath((prev) => prev ?? current.output.gdpGrowthPath);
    setActivePlaybookIds(new Set()); // manual edits break the composition
    setLevers((prev) => ({ ...prev, [slug]: value }));
  }
  function updateHorizon(v: number) {
    setHorizonYears(v);
  }

  function registerAiPlay(p: Playbook) {
    setAiPlays((prev) => (prev.find((x) => x.id === p.id) ? prev : [...prev, p]));
  }

  function togglePlaybook(p: Playbook) {
    setActivePlaybookIds((prev) => {
      const next = new Set(prev);
      // Baseline is exclusive
      if (p.id === "baseline") {
        if (next.has("baseline")) next.delete("baseline");
        else {
          next.clear();
          next.add("baseline");
        }
      } else {
        if (next.has(p.id)) next.delete(p.id);
        else {
          next.delete("baseline");
          next.add(p.id);
        }
      }
      applyComposition(next);
      return next;
    });
  }

  function clearPlaybooks() {
    setActivePlaybookIds(new Set());
    // Reset levers to defaults but respect locks
    const d: Record<string, number> = {};
    for (const def of init.leverDefs) d[def.slug] = def.bounds.default ?? def.bounds.min;
    for (const [slug, locked] of Object.entries(locks)) if (locked) d[slug] = levers[slug];
    setGhostPath(current.output.gdpGrowthPath);
    setLevers(d);
  }

  function applyComposition(ids: Set<string>) {
    const byId = new Map<string, Playbook>();
    for (const p of PLAYBOOKS) byId.set(p.id, p);
    for (const p of aiPlays) byId.set(p.id, p);
    const selected: Playbook[] = [];
    for (const id of ids) {
      const p = byId.get(id);
      if (p) selected.push(p);
    }
    const { levers: composed } = composePlaybooks(init.leverDefs, selected);
    // respect locks
    for (const [slug, locked] of Object.entries(locks)) if (locked) composed[slug] = levers[slug];
    setGhostPath(current.output.gdpGrowthPath);
    setLevers(composed);
  }

  function resetDefaults() {
    const d: Record<string, number> = {};
    for (const def of init.leverDefs) d[def.slug] = def.bounds.default ?? def.bounds.min;
    setGhostPath(current.output.gdpGrowthPath);
    setActivePlaybookIds(new Set(["baseline"]));
    setLevers(d);
  }
  function resetLever(slug: string) {
    const def = init.leverDefs.find((d) => d.slug === slug);
    if (!def) return;
    const dflt = def.bounds.default ?? def.bounds.min;
    updateLever(slug, dflt);
  }
  function toggleLock(slug: string) {
    setLocks((p) => ({ ...p, [slug]: !p[slug] }));
  }

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

  const baselineY1 = init.output.gdpGrowthPath[0]?.p50 ?? 2.0;
  const baselineYEnd =
    init.output.gdpGrowthPath[init.output.gdpGrowthPath.length - 1]?.p50 ?? 2.0;
  const baselinePath = useMemo(() => {
    // Synthesize a flat baseline (do-nothing) path aligned to the current
    // horizon so the fan-chart overlay and ledger stay in sync when the
    // user changes horizon length.
    const b1 = init.output.gdpGrowthPath[0] ?? { p10: baselineY1 - 0.6, p50: baselineY1, p90: baselineY1 + 0.6 };
    return current.output.gdpGrowthPath.map(() => ({ p10: b1.p10, p50: b1.p50, p90: b1.p90 }));
  }, [init.output.gdpGrowthPath, current.output.gdpGrowthPath, baselineY1]);
  const compensation = useMemo(
    () => computeCompensation(baselinePath, current.output.gdpGrowthPath, current.output.years),
    [baselinePath, current.output.gdpGrowthPath, current.output.years],
  );

  const save = useMutation({
    mutationFn: (opts: { pin?: boolean } = {}) =>
      saveScenario({
        data: {
          countryCode: code,
          ministrySlug: ministrySlug || null,
          sectorCode: null,
          title: title.trim() || "Untitled scenario",
          horizonYears,
          levers,
          assumptions: {
            note: assumptionsNote,
            selected_playbook_ids: Array.from(activePlaybookIds),
            ai_playbooks: aiPlays
              .filter((p) => activePlaybookIds.has(p.id))
              .map((p) => ({ id: p.id, label: p.label, blurb: p.blurb, thesis: p.thesis })),
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

  const hasLevers = init.leverDefs.length > 0;
  const recomputedLabel = lastRunAt
    ? `Recomputed ${Math.max(0, Math.round((Date.now() - lastRunAt) / 100) / 10)}s ago`
    : "Live · engine v1_macro";

  function jumpToStep(n: number) {
    setStep(n);
    if (n > furthest) setFurthest(n);
    // Clear ghost when leaving tuning step so re-entry starts fresh
    if (n !== 3) setGhostPath(null);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))
        return;
      if (e.key === "ArrowRight" && step < 4) jumpToStep(step + 1);
      else if (e.key === "ArrowLeft" && step > 1) jumpToStep(step - 1);
      else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (e.shiftKey) save.mutate({ pin: true });
        else save.mutate({});
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, furthest]);

  return (
    <div className="mx-auto grid min-w-0 max-w-[1440px] grid-cols-1 gap-0 xl:grid-cols-[380px_minmax(0,1fr)]">
      {/* Column A · Guided rail */}
      <aside className="border-r border-line-200 xl:sticky xl:top-0 xl:h-dvh">
        <GuidedRail
          step={step}
          furthest={furthest}
          onStep={jumpToStep}
          countryCode={code}
          title={title}
          onTitle={setTitle}
          ministries={ministries}
          ministrySlug={ministrySlug}
          onMinistry={setMinistrySlug}
          horizonYears={horizonYears}
          onHorizon={updateHorizon}
          init={init}
          activePlaybookIds={activePlaybookIds}
          onTogglePlaybook={togglePlaybook}
          onClearPlaybooks={clearPlaybooks}
          aiPlays={aiPlays}
          onRegisterAiPlay={registerAiPlay}
          levers={levers}
          locks={locks}
          onLever={updateLever}
          onToggleLock={toggleLock}
          onResetLever={resetLever}
          onResetAll={resetDefaults}
          showAllLevers={showAllLevers}
          onToggleShowAll={() => setShowAllLevers((v) => !v)}
          current={current}
          assumptionsNote={assumptionsNote}
          onAssumptions={setAssumptionsNote}
          onSave={() => save.mutate({})}
          onSavePin={() => save.mutate({ pin: true })}
          savePending={save.isPending}
          saveError={save.error ? (save.error as Error).message : null}
          onLeversCommitted={() => {
            setShowAllLevers(true);
            setStep(3);
            setFurthest(3);
            void queryClient.invalidateQueries({ queryKey: ["engine-init", code] });
          }}
        />
      </aside>

      {/* Column B · Live canvas */}
      <section className="min-w-0">
        {/* Sticky status bar */}
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-line-200 bg-paper-0/95 px-6 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={
                "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] " +
                (false ? "text-ink-950" : "text-ink-500")
              }
            >
              <span
                className={
                  "inline-block h-1.5 w-1.5 rounded-full " +
                  (false ? "animate-pulse bg-ink-950" : "bg-emerald-500")
                }
              />
              {false ? "Recomputing…" : recomputedLabel}
            </span>
            <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500 md:inline">
              · {activeLeverCount} lever{activeLeverCount === 1 ? "" : "s"} off default
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAiDrawerOpen(true)}
              className="group relative inline-flex items-center gap-1.5 overflow-hidden border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-0 shadow-sm hover:bg-ink-700"
              title="Describe a challenge — AI designs a full scenario grounded in this country's second brain"
            >
              <Sparkles size={12} className="text-amber-300" />
              Ask AI to design this
            </button>
            {aiPreviewActive && (
              <span className="inline-flex items-center gap-1 border border-amber-400 bg-amber-50 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.22em] text-amber-900">
                <Sparkles size={10} /> AI preview active
              </span>
            )}
            <CompareSlots code={code} count={pinCount} />
            {step === 3 && hasLevers && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
              >
                Full lever board · {init.leverDefs.length}
              </button>
            )}
          </div>
        </div>

        {step === 1 && (
          <div className="mx-6 mt-6 border border-ink-950/20 bg-gradient-to-br from-paper-100/60 to-paper-0 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full border border-ink-950 bg-ink-950 p-1.5">
                <Sparkles size={14} className="text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                  Fastest path — let AI design it
                </p>
                <h3 className="mt-1 font-serif text-base text-ink-950">
                  Describe the challenge · get a Cabinet-ready scenario in one click
                </h3>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-700">
                  "Wind down CBI over 3 years", "Cat-4 hurricane in Q3", "Double stayovers by Y3" —
                  the recommender reads {code}'s sectors, KPIs, ministry mandate, and live signals
                  and returns exact lever moves with rationale &amp; citations.
                </p>
                <button
                  type="button"
                  onClick={() => setAiDrawerOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-0 hover:bg-ink-700"
                >
                  <Sparkles size={12} className="text-amber-300" /> Design scenario with AI
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-6">
          {/* Step-specific caption */}
          <div className="mb-4 flex items-baseline gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
              {stepCaption(step)}
            </p>
          </div>

          {/* Stat strip */}
          <StatStrip
            pending={false}
            cells={[
              {
                label: "Year 1 · P50 GDP growth",
                value: `${year1 >= 0 ? "+" : ""}${year1.toFixed(2)}%`,
                delta: year1 - baselineY1,
                sub: year1Band
                  ? `P10 ${year1Band.p10.toFixed(2)} · P90 ${year1Band.p90.toFixed(2)}`
                  : undefined,
              },
              {
                label: `Year ${horizonYears} · P50 GDP growth`,
                value: `${yearEnd >= 0 ? "+" : ""}${yearEnd.toFixed(2)}%`,
                delta: yearEnd - baselineYEnd,
                sub: yearEndBand
                  ? `P10 ${yearEndBand.p10.toFixed(2)} · P90 ${yearEndBand.p90.toFixed(2)}`
                  : undefined,
              },
              {
                label: "Net vs baseline · cumulative",
                value:
                  compensation.regime === "at_baseline"
                    ? "—"
                    : `${compensation.cumulativeEndPp >= 0 ? "+" : ""}${compensation.cumulativeEndPp.toFixed(2)} pp`,
                delta: compensation.cumulativeEndPp,
                sub:
                  compensation.regime === "surplus" && compensation.breakEvenYear
                    ? `Break-even Y${compensation.breakEvenYear}`
                    : compensation.regime === "deficit" && compensation.gapClosedPct !== null
                    ? `Gap closed ${compensation.gapClosedPct.toFixed(0)}%`
                    : compensation.regime === "break_even"
                    ? "At break-even"
                    : "Move a lever",
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
            <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
              Projected GDP growth · P10 / P50 / P90
              <CoachTip id="fan-bands" title="P10 / P50 / P90">
                P50 is the central estimate. P10/P90 are the pessimistic/optimistic tails —
                the shaded band is where the outcome is likely to land 80% of the time.
              </CoachTip>
              {step === 3 && ghostPath && (
                <span className="ml-2 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                  <span
                    className="inline-block h-px w-4"
                    style={{
                      borderTop: "1px dashed var(--ink-500)",
                    }}
                  />
                  previous P50
                </span>
              )}
            </h3>
            <div className="mt-3 min-w-0">
              <GdpFanChart
                years={current.output.years}
                path={current.output.gdpGrowthPath}
                ghostPath={step === 3 && ghostPath ? ghostPath : undefined}
                baselinePath={step >= 2 ? baselinePath : undefined}
              />
            </div>
            {step >= 2 && (
              <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-px w-4 bg-ink-950" /> Levered P50
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-px w-4"
                    style={{ borderTop: "1px dashed var(--ink-500)" }}
                  />
                  Do-nothing baseline
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-3"
                    style={{ background: "var(--sector-06)", opacity: 0.35 }}
                  />
                  Compensation area
                </span>
              </div>
            )}
            {step === 1 && (
              <p className="mt-2 text-[11px] italic text-ink-500">
                This is your <strong>do-nothing baseline</strong> over the current horizon —
                the reference you'll bend from in the next steps.
              </p>
            )}
            {step >= 2 && (
              <div className="mt-4">
                <CompensationLedger summary={compensation} />
              </div>
            )}
          </section>

          {/* Sector / attribution — visible from step 3 onward */}
          {!hasLevers ? (
            <section className="mt-10">
              <EmptyLevers code={code} />
            </section>
          ) : step >= 3 ? (
            <section className="mt-10 grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                  Sector waterfall · Δ pp
                  <CoachTip id="waterfall" title="Sector waterfall">
                    Where your projected growth actually lands — each bar is one sector's
                    contribution to the shift versus baseline.
                  </CoachTip>
                </h3>
                <div className="mt-3 min-w-0">
                  <SectorWaterfall impacts={current.output.sectorImpacts} />
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                  Why this moved · lever contribution
                  <CoachTip id="attribution" title="Attribution">
                    The engine attributes the projected shift to the levers you moved. Longer
                    bar = bigger role in the story.
                  </CoachTip>
                </h3>
                <div className="mt-3 min-w-0">
                  <AttributionStack items={current.output.attribution} />
                </div>
              </div>
            </section>
          ) : null}

          {/* Narrative on step 4 only */}
          {step === 4 && (
            <section className="mt-10">
              <NarrativePanel
                initial={null}
                payload={{
                  livePayload: {
                    countryCode: code,
                    title: title || "Untitled scenario",
                    horizonYears,
                    levers,
                    engineOutput: current.output as unknown as Record<string, unknown>,
                  },
                }}
              />
            </section>
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

function stepCaption(step: number): string {
  switch (step) {
    case 1:
      return "Step 1 · Your do-nothing baseline";
    case 2:
      return "Step 2 · Preview each play's central path";
    case 3:
      return "Step 3 · Drag to bend the future — dashed line = before your last change";
    case 4:
      return "Step 4 · The story · where growth lands · what caused it";
    default:
      return "";
  }
}
