import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

import { ThreatStepper } from "@/components/studio/ThreatStepper";
import { ThreatBriefCard } from "@/components/studio/ThreatBriefCard";
import { ExposureLedger } from "@/components/studio/ExposureLedger";
import { ReallocationMarimekko } from "@/components/studio/ReallocationMarimekko";
import { ResilienceActionsRail } from "@/components/studio/ResilienceActionsRail";
import { StagingTimeline } from "@/components/studio/StagingTimeline";
import { StressTestPanel } from "@/components/studio/StressTestPanel";
import { CommitBar } from "@/components/studio/CommitBar";
import { ExplainHover } from "@/components/studio/ExplainHover";
import { WorkbenchJourney, type JourneyStepKey } from "@/components/studio/WorkbenchJourney";
import { GuidanceBanner } from "@/components/studio/GuidanceBanner";
import { EmptyStrategyCoach } from "@/components/studio/EmptyStrategyCoach";
import { EXPLAIN } from "@/components/studio/explain-copy";
import { onsetLabel, threatTypeChip } from "@/components/studio/threat-presets";
import {
  getThreat,
  listStudioContext,
  promoteStrategyToPackages,
  promoteStrategyToScenario,
  regenerateThreatBrief,
  saveStrategy,
  suggestResilientStrategy,
  type Allocation,
  type AllocationEntry,
  type ResilienceAction,
  type StrategyMetrics,
} from "@/lib/fdi-resilience.functions";

function threatQuery(id: string) {
  return queryOptions({
    queryKey: ["studio-threat", id],
    queryFn: () => getThreat({ data: { id } }),
  });
}
function ctxQuery(code: string) {
  return queryOptions({
    queryKey: ["studio-ctx", code],
    queryFn: () => listStudioContext({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute(
  "/_authenticated/admin/countries/$code/studio/threats/$id",
)({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(threatQuery(params.id)),
      context.queryClient.ensureQueryData(ctxQuery(params.code)),
    ]);
  },
  errorComponent: ({ error }) => (
    <p className="text-sm text-red-600">{error.message}</p>
  ),
  notFoundComponent: () => (
    <p className="text-sm text-ink-500">Threat not found.</p>
  ),
  component: StrategyWorkbench,
});

function emptyMetrics(): StrategyMetrics {
  return {
    exposure_closed_pp: 0,
    residual_risk_pp: 0,
    hhi_delta: 0,
    time_to_resilience_years: 0,
    ministries_engaged: 0,
  };
}

function computeLocalMetrics(
  allocation: Allocation,
  actions: ResilienceAction[],
): StrategyMetrics {
  const exposureClosed = actions.reduce((s, a) => s + (a.target_pp || 0), 0);
  const totalExposure = allocation.entries.reduce(
    (s, e) => s + Math.max(0, e.exposure_delta_pp),
    0,
  );
  const hhiCurrent =
    allocation.entries.reduce((s, e) => s + (e.current_pct / 100) ** 2, 0) *
    10000;
  const hhiResilient =
    allocation.entries.reduce((s, e) => s + (e.resilient_pct / 100) ** 2, 0) *
    10000;
  const maxYear = actions.reduce((m, a) => Math.max(m, a.staging_year || 0), 0);
  const ministries = new Set(
    actions.map((a) => a.sponsor_ministry_slug).filter(Boolean) as string[],
  );
  return {
    exposure_closed_pp: Number(exposureClosed.toFixed(2)),
    residual_risk_pp: Number(Math.max(0, totalExposure - exposureClosed).toFixed(2)),
    hhi_delta: Number((hhiResilient - hhiCurrent).toFixed(1)),
    time_to_resilience_years: maxYear,
    ministries_engaged: ministries.size,
  };
}

function StrategyWorkbench() {
  const { code, id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: bundle } = useSuspenseQuery(threatQuery(id));
  const { data: ctx } = useSuspenseQuery(ctxQuery(code));
  const { threat, strategies } = bundle;
  const strategy = strategies[0] ?? null;

  const suggestFn = useServerFn(suggestResilientStrategy);
  const saveFn = useServerFn(saveStrategy);
  const promotePackagesFn = useServerFn(promoteStrategyToPackages);
  const promoteScenarioFn = useServerFn(promoteStrategyToScenario);
  const regenBriefFn = useServerFn(regenerateThreatBrief);

  const [name, setName] = useState(
    strategy?.name ?? `Resilient strategy · ${threat.name}`,
  );
  const [entries, setEntries] = useState<AllocationEntry[]>(
    strategy?.allocation.entries ??
      ctx.sectors.map((s) => ({
        sector_code: s.code,
        current_pct: Number(s.share_pct.toFixed(2)),
        resilient_pct: Number(s.share_pct.toFixed(2)),
        exposure_delta_pp: threat.target_sector_codes.includes(s.code)
          ? Number((s.share_pct * (threat.severity_pct / 100)).toFixed(2))
          : 0,
      })),
  );
  const [actions, setActions] = useState<ResilienceAction[]>(strategy?.actions ?? []);
  const [dirty, setDirty] = useState(false);
  const [strategyId, setStrategyId] = useState<string | null>(strategy?.id ?? null);
  const [promoted, setPromoted] = useState<{
    packages: boolean;
    scenarioId: string | null;
  }>({
    packages: strategy?.status === "plan_of_record",
    scenarioId: strategy?.promoted_scenario_id ?? null,
  });

  useEffect(() => {
    setDirty(false);
  }, [strategy?.id]);

  const allocation: Allocation = useMemo(
    () => ({ entries, currency: "pct_of_fdi" }),
    [entries],
  );
  const metrics = useMemo(
    () => (dirty || !strategy ? computeLocalMetrics(allocation, actions) : strategy.metrics ?? emptyMetrics()),
    [allocation, actions, strategy, dirty],
  );

  const suggestMut = useMutation({
    mutationFn: () => suggestFn({ data: { threatId: id } }),
    onSuccess: (res) => {
      setEntries(res.allocation.entries);
      setActions(res.actions);
      setDirty(true);
    },
  });

  const regenBriefMut = useMutation({
    mutationFn: () => regenBriefFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-threat", id] });
    },
  });

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: strategyId ?? undefined,
          threatId: id,
          name,
          allocation: { entries, currency: "pct_of_fdi" },
          actions,
          status: promoted.packages ? "plan_of_record" : "draft",
        },
      }),
    onSuccess: (res) => {
      setStrategyId(res.id);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["studio-threat", id] });
    },
  });

  const promotePackagesMut = useMutation({
    mutationFn: () => promotePackagesFn({ data: { id: strategyId! } }),
    onSuccess: () => {
      setPromoted((p) => ({ ...p, packages: true }));
      qc.invalidateQueries({ queryKey: ["studio-threat", id] });
    },
  });

  const promoteScenarioMut = useMutation({
    mutationFn: () => promoteScenarioFn({ data: { id: strategyId! } }),
    onSuccess: (res) => {
      setPromoted((p) => ({ ...p, scenarioId: res.scenarioId }));
      navigate({
        to: "/admin/countries/$code/scenarios/$id",
        params: { code, id: res.scenarioId },
      });
    },
  });

  const canPromote = strategyId && !dirty;

  // Journey step state derived from live data
  const hasReallocation = entries.some(
    (e) => Math.abs(e.resilient_pct - e.current_pct) > 0.05,
  );
  const hasActions = actions.length > 0;
  const stagedCount = actions.filter((a) => (a.staging_year ?? 0) >= 1).length;
  const allStaged = hasActions && stagedCount === actions.length;
  const isSaved = !!strategyId && !dirty;

  let active: JourneyStepKey = "read";
  if (isSaved || allStaged) active = "commit";
  else if (hasActions) active = "stage";
  else if (hasReallocation) active = "reshape";

  const journeySteps = [
    {
      key: "read" as JourneyStepKey,
      title: "Read the threat",
      caption: "Review the AI briefing and exposure chips.",
      done: true,
      anchor: "briefing",
    },
    {
      key: "reshape" as JourneyStepKey,
      title: "Reshape the mix",
      caption: "Drag handles to reallocate FDI across sectors.",
      done: hasReallocation,
      anchor: "reallocation",
    },
    {
      key: "stage" as JourneyStepKey,
      title: "Stage the actions",
      caption: "Create actions, then drag each into a year.",
      done: allStaged,
      anchor: "staging",
    },
    {
      key: "commit" as JourneyStepKey,
      title: "Stress-test & commit",
      caption: "Review what breaks, then save or promote.",
      done: isSaved,
      anchor: "stress",
    },
  ];

  const showEmptyCoach = !hasActions && !hasReallocation && !strategy;

  let guidance: { message: string; tone?: "info" | "success" } | null = null;
  if (!hasActions && !hasReallocation) {
    guidance = {
      message:
        "Click Suggest resilient allocation for an AI-drafted plan, or add your first action manually.",
    };
  } else if (!allStaged) {
    const unstaged = actions.length - stagedCount;
    guidance = {
      message:
        unstaged > 0
          ? `Drag your ${unstaged} unstaged action${unstaged === 1 ? "" : "s"} into the year it lands.`
          : "Add at least one resilience action to your plan.",
    };
  } else if (dirty) {
    guidance = {
      message: "Plan looks complete. Review the stress test, then Save draft.",
    };
  } else if (isSaved && !promoted.packages && !promoted.scenarioId) {
    guidance = {
      message: "Saved. Promote to Plan of Record or model as a scenario.",
      tone: "success",
    };
  }

  function scrollTo(anchor: string) {
    document.getElementById(anchor)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="space-y-8 pb-24">
      <div className="border-b border-line-200/60 pb-2">
        <ThreatStepper active="stress" onSelect={() => {}} />
      </div>

      <WorkbenchJourney steps={journeySteps} active={active} />

      {guidance && (
        <GuidanceBanner
          message={guidance.message}
          tone={guidance.tone}
          cta={
            !hasActions && !hasReallocation
              ? {
                  label: suggestMut.isPending ? "Modelling…" : "Suggest plan",
                  onClick: () => suggestMut.mutate(),
                  icon: "sparkles",
                }
              : undefined
          }
        />
      )}


      <header className="space-y-4 border-b border-line-200 pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
          Threat briefing
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6">
          <ExplainHover copy={EXPLAIN.strategy_title} side="bottom">
            <label className="group relative block min-w-0">
              <span className="sr-only">Rename strategy</span>
              <textarea
                value={name}
                onChange={(e) => {
                  setName(e.target.value.replace(/\n/g, " "));
                  setDirty(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                rows={1}
                aria-label="Rename strategy"
                title={name}
                spellCheck={false}
                className="block w-full resize-none overflow-hidden break-words border-b border-transparent bg-transparent font-serif text-3xl leading-tight text-ink-950 outline-none transition-colors group-hover:border-line-200 focus-visible:border-line-200 focus-visible:ring-1 focus-visible:ring-ink-950/10 md:text-4xl"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
              <span className="pointer-events-none absolute -bottom-4 left-0 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                Click to rename
              </span>
            </label>
          </ExplainHover>
          <ExplainHover copy={EXPLAIN.suggest_allocation} side="left">
            <button
              type="button"
              onClick={() => suggestMut.mutate()}
              disabled={suggestMut.isPending}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap border border-ink-950 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950 transition-colors hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
            >
              <Sparkles size={13} />
              {suggestMut.isPending ? "Modelling…" : "Suggest resilient allocation"}
            </button>
          </ExplainHover>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="inline-flex items-center gap-1.5 border border-line-200 bg-paper-0 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-700">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: threatTypeChip(threat.threat_type).dot }}
            />
            {threatTypeChip(threat.threat_type).label}
          </span>
          <span className="inline-flex items-center gap-2 border border-line-200 bg-paper-0 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-700">
            Severity <span className="tabular-nums text-ink-950">{threat.severity_pct}%</span>
            <span className="relative inline-block h-1 w-10 bg-line-200">
              <span
                className="absolute inset-y-0 left-0 bg-ink-950"
                style={{ width: `${Math.min(100, Math.max(0, threat.severity_pct))}%` }}
              />
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 border border-line-200 bg-paper-0 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-700">
            Horizon <span className="tabular-nums text-ink-950">{threat.horizon_years}y</span>
          </span>
          <span className="inline-flex items-center gap-1.5 border border-line-200 bg-paper-0 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-700">
            {onsetLabel(threat.onset)}
          </span>
        </div>
      </header>


      <div id="briefing">
        <ThreatBriefCard
          brief={threat.brief}
          onRegenerate={() => regenBriefMut.mutate()}
          regenerating={regenBriefMut.isPending}
        />
      </div>

      {showEmptyCoach && (
        <EmptyStrategyCoach
          onSuggest={() => suggestMut.mutate()}
          onManual={() => scrollTo("actions")}
          suggesting={suggestMut.isPending}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div id="reallocation">
            <ReallocationMarimekko
              entries={entries}
              sectors={ctx.sectors}
              onChange={(next) => {
                setEntries(next);
                setDirty(true);
              }}
            />
          </div>
          <div id="staging">
            <StagingTimeline
              actions={actions}
              horizon={Math.max(3, threat.horizon_years)}
              sectors={ctx.sectors}
              onMove={(aid, year) => {
                setActions((list) =>
                  list.map((a) => (a.id === aid ? { ...a, staging_year: year } : a)),
                );
                setDirty(true);
              }}
            />
          </div>
          <div id="stress">
            <StressTestPanel
              metrics={metrics}
              allocation={allocation}
              actions={actions}
              sectors={ctx.sectors}
            />
          </div>
        </div>
        <div className="space-y-6">
          <ExposureLedger
            allocation={allocation}
            sectors={ctx.sectors}
            targets={threat.target_sector_codes}
          />
          <div id="actions">
            <ResilienceActionsRail
              actions={actions}
              onChange={(next) => {
                setActions(next);
                setDirty(true);
              }}
              sectors={ctx.sectors}
              ministries={ctx.ministries}
              horizon={Math.max(3, threat.horizon_years)}
            />
          </div>
        </div>
      </div>


      {(saveMut.error || promotePackagesMut.error || promoteScenarioMut.error || suggestMut.error || regenBriefMut.error) && (
        <p className="text-sm text-red-600">
          {(saveMut.error || promotePackagesMut.error || promoteScenarioMut.error || suggestMut.error || regenBriefMut.error) instanceof Error
            ? ((saveMut.error || promotePackagesMut.error || promoteScenarioMut.error || suggestMut.error || regenBriefMut.error) as Error).message
            : "Something went wrong"}
        </p>
      )}

      <CommitBar
        dirty={dirty}
        saving={saveMut.isPending}
        promoting={
          promotePackagesMut.isPending
            ? "packages"
            : promoteScenarioMut.isPending
            ? "scenario"
            : null
        }
        promoted={promoted}
        onSaveDraft={() => saveMut.mutate()}
        onPromotePackages={() => canPromote && promotePackagesMut.mutate()}
        onPromoteScenario={() => canPromote && promoteScenarioMut.mutate()}
      />
    </div>
  );
}
