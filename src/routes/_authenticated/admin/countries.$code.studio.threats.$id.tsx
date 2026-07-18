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
import { threatLabel } from "@/components/studio/threat-presets";
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

  return (
    <div className="space-y-6 pb-24">
      <ThreatStepper active="stress" onSelect={() => {}} />
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Threat · {threatLabel(threat.threat_type)} · severity {threat.severity_pct}%
          </p>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            className="mt-1 w-full max-w-xl border-b border-transparent bg-transparent font-serif text-3xl text-ink-950 focus:border-line-200 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => suggestMut.mutate()}
          disabled={suggestMut.isPending}
          className="inline-flex items-center gap-2 border border-ink-950 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
        >
          <Sparkles size={13} />
          {suggestMut.isPending ? "Modelling…" : "Suggest resilient allocation"}
        </button>
      </div>

      <ThreatBriefCard brief={threat.brief} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <ReallocationMarimekko
            entries={entries}
            sectors={ctx.sectors}
            onChange={(next) => {
              setEntries(next);
              setDirty(true);
            }}
          />
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
          <StressTestPanel
            metrics={metrics}
            allocation={allocation}
            actions={actions}
            sectors={ctx.sectors}
          />
        </div>
        <div className="space-y-6">
          <ExposureLedger
            allocation={allocation}
            sectors={ctx.sectors}
            targets={threat.target_sector_codes}
          />
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

      {(saveMut.error || promotePackagesMut.error || promoteScenarioMut.error || suggestMut.error) && (
        <p className="text-sm text-red-600">
          {(saveMut.error || promotePackagesMut.error || promoteScenarioMut.error || suggestMut.error) instanceof Error
            ? ((saveMut.error || promotePackagesMut.error || promoteScenarioMut.error || suggestMut.error) as Error).message
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
