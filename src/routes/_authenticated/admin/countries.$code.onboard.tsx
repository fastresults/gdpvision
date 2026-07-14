import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { PrettyJson } from "@/components/data/PrettyJson";
import {
  commitGdp,
  commitMinistries,
  commitMinistrySectorMap,
  commitProfile,
  commitSectorComposition,
  getOnboardingStatus,
  getPerplexityKeyStatus,
  runGdpAgent,
  runMinistriesAgent,
  runMinistrySectorMapAgent,
  runProfileAgent,
  runSectorCompositionAgent,
} from "@/lib/country-onboarding/agents.functions";
import {
  cleanInvalidCountrySources,
  commitKpis,
  commitMinistryDeepDive,
  commitSecondBrainSeed,
  commitSectorDossiers,
  commitSourceRegistry,
  commitCapitalFlows,
  getIngestKeysStatus,
  getRunProgress,
  runCorpusIngest,
  runKpiSeedAgent,
  runMinistryDeepDiveAgent,
  runSecondBrainSeedAgent,
  runSectorDossierAgent,
  runSourceRegistryAgent,
  runCapitalFlowsAgent,
} from "@/lib/country-onboarding/corpus.functions";
import {
  advanceCountryOnboarding,
  clearOnboardingLocks,
} from "@/lib/country-onboarding/orchestrator.functions";
import { generateStageSummary } from "@/lib/country-onboarding/summaries.functions";


type Stage =
  | "profile"
  | "gdp"
  | "sector_composition"
  | "ministries"
  | "ministry_sector_map"
  | "source_registry"
  | "kpi_seed"
  | "sector_dossier"
  | "ministry_deep_dive"
  | "corpus_ingest"
  | "second_brain_seed"
  | "capital_flows";

const STAGES: Array<{ key: Stage; label: string; short: string; desc: string }> = [
  { key: "profile", label: "1. Profile", short: "Profile", desc: "Currency, fiscal year, population, head of government." },
  { key: "gdp", label: "2. GDP", short: "GDP", desc: "Nominal GDP USD (cross-checked between WB and IMF)." },
  { key: "sector_composition", label: "3. Sectors", short: "Sectors", desc: "Share_pct per sector; sums ≈ 100%." },
  { key: "ministries", label: "4. Ministries", short: "Ministries", desc: "Canonical cabinet ministries with mandate." },
  { key: "ministry_sector_map", label: "5. Ministry×Sector", short: "M×S", desc: "Weight matrix from portfolios to sectors." },
  { key: "source_registry", label: "6. Source registry", short: "Sources", desc: "Canonical URLs (gov, regional, multilateral, media) with toggle." },
  { key: "kpi_seed", label: "7. KPI seed", short: "KPIs", desc: "Canonical macro/fiscal/social KPIs with latest values." },
  { key: "sector_dossier", label: "8. Sector dossiers", short: "Dossiers", desc: "Policy + comms + regional benchmark per sector." },
  { key: "ministry_deep_dive", label: "9. Ministry deep-dive", short: "M-Deep", desc: "Minister, mandate, flagship programmes per ministry." },
  { key: "corpus_ingest", label: "10. Corpus ingest", short: "Corpus", desc: "Firecrawl scrape + embed every active source." },
  { key: "second_brain_seed", label: "11. Second-brain seed", short: "Brain", desc: "Cabinet positions, audiences, outlets, facts, risks." },
  { key: "capital_flows", label: "12. Capital flows", short: "Flows", desc: "Sovereign Sankey ledger (BOP + fiscal, USD $M) with citations." },
];

// (Dependency map removed — the orchestrator loop below derives real deps
// from server-side committedTargets ground truth per pipeline level.)


const statusQuery = (code: string) =>
  queryOptions({
    queryKey: ["onboarding", "status", code],
    queryFn: () => getOnboardingStatus({ data: { countryCode: code } }),
  });

const keyStatusQuery = queryOptions({
  queryKey: ["onboarding", "key-status"],
  queryFn: () => getPerplexityKeyStatus(),
});

const ingestKeysQuery = queryOptions({
  queryKey: ["onboarding", "ingest-keys"],
  queryFn: () => getIngestKeysStatus(),
});


export const Route = createFileRoute("/_authenticated/admin/countries/$code/onboard")({
  head: ({ params }) => ({
    meta: [
      { title: `Onboard ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    const [status] = await Promise.all([
      context.queryClient.ensureQueryData(statusQuery(params.code)),
      context.queryClient.ensureQueryData(keyStatusQuery),
      context.queryClient.ensureQueryData(ingestKeysQuery),
    ]);
    if (!(status as any).country) throw notFound();
  },
  component: OnboardWizard,
  errorComponent: ({ error }) => (
    <SuperAdminShell crumbs={[{ label: "Countries", to: "/admin/countries" }, { label: "Onboard" }]}>
      <p className="text-sm text-red-600">{error.message}</p>
    </SuperAdminShell>
  ),
  notFoundComponent: () => (
    <SuperAdminShell crumbs={[{ label: "Countries", to: "/admin/countries" }, { label: "Not found" }]}>
      <p className="text-sm">That country is not in the registry.</p>
    </SuperAdminShell>
  ),
});

function OnboardWizard() {
  const { code } = Route.useParams();
  const { data } = useSuspenseQuery(statusQuery(code));
  const { data: keyStatus } = useSuspenseQuery(keyStatusQuery);
  const { data: ingestKeys } = useSuspenseQuery(ingestKeysQuery);
  // (durable-job UI removed — onboarding now runs one stage at a time from this page)
  const qc = useQueryClient();
  const [bulkRunning, setBulkRunning] = useState<false | "pending" | "rerun">(false);
  const [bulkErr, setBulkErr] = useState<string | null>(null);
  const [runErrors, setRunErrors] = useState<Array<{ stage: Stage; message: string }>>([]);
  const [skippedStages, setSkippedStages] = useState<Array<{ stage: Stage; waitingOn: Stage[] }>>([]);

  // Lifted so we can auto-open the accordion for the stage currently running.
  const [openStage, setOpenStage] = useState<string | null>(null);

  // One run banner state — visible while any stage's Run is in flight, then a
  // result banner is shown until the admin dismisses it.
  const [activeRun, setActiveRun] = useState<
    | { stage: Stage; label: string; startedAt: number; runId?: string }
    | null
  >(null);
  const [runProgress, setRunProgress] = useState<{
    phase?: string;
    processed?: number;
    total?: number;
    currentKpi?: string | null;
    lastUrl?: string | null;
    okCount?: number;
    failCount?: number;
    totalChunks?: number;
    filled?: number;
    missing?: number;
    updatedAt?: string;
    missingKpis?: string[];
  } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [runResult, setRunResult] = useState<
    | { stage: Stage; label: string; ok: true; text: string; meta?: any }
    | { stage: Stage; label: string; ok: false; text: string }
    | null
  >(null);

  // Elapsed-seconds ticker.
  useEffect(() => {
    if (!activeRun) return;
    setElapsed(0);
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - activeRun.startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [activeRun]);

  // Poll the run's plan every 3s so admin sees processed/total ticking.
  const pollProgress = useServerFn(getRunProgress);
  useEffect(() => {
    if (!activeRun) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const row = await pollProgress({
          data: activeRun.runId
            ? { runId: activeRun.runId }
            : { countryCode: code, stage: activeRun.stage },
        });
        if (!cancelled && row && (row as any).id && !activeRun.runId) {
          setActiveRun((prev) => (prev ? { ...prev, runId: (row as any).id } : prev));
        }
        if (!cancelled && row && (row as any).plan) setRunProgress((row as any).plan);
      } catch { /* best effort */ }
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [activeRun?.runId, activeRun?.stage, code, pollProgress]);


  const runnersRaw: Record<Stage, any> = {
    profile: useServerFn(runProfileAgent),
    gdp: useServerFn(runGdpAgent),
    sector_composition: useServerFn(runSectorCompositionAgent),
    ministries: useServerFn(runMinistriesAgent),
    ministry_sector_map: useServerFn(runMinistrySectorMapAgent),
    source_registry: useServerFn(runSourceRegistryAgent),
    kpi_seed: useServerFn(runKpiSeedAgent),
    sector_dossier: useServerFn(runSectorDossierAgent),
    ministry_deep_dive: useServerFn(runMinistryDeepDiveAgent),
    corpus_ingest: useServerFn(runCorpusIngest),
    second_brain_seed: useServerFn(runSecondBrainSeedAgent),
    capital_flows: useServerFn(runCapitalFlowsAgent),
  };
  const committers: Record<Stage, any> = {
    profile: useServerFn(commitProfile),
    gdp: useServerFn(commitGdp),
    sector_composition: useServerFn(commitSectorComposition),
    ministries: useServerFn(commitMinistries),
    ministry_sector_map: useServerFn(commitMinistrySectorMap),
    source_registry: useServerFn(commitSourceRegistry),
    kpi_seed: useServerFn(commitKpis),
    sector_dossier: useServerFn(commitSectorDossiers),
    ministry_deep_dive: useServerFn(commitMinistryDeepDive),
    // corpus_ingest auto-commits (no user review needed) — provide a no-op
    corpus_ingest: async () => ({ ok: true }),
    second_brain_seed: useServerFn(commitSecondBrainSeed),
    capital_flows: useServerFn(commitCapitalFlows),
  };
  const cleanInvalid = useServerFn(cleanInvalidCountrySources);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["onboarding", "status", code] }),
      qc.invalidateQueries({ queryKey: ["onboarding", "countries"] }),
      qc.invalidateQueries({ queryKey: ["onboarding", "runs"] }),
    ]);

  const drafts: any[] = (data as any).drafts ?? [];
  const committedDrafts: any[] = (data as any).committedDrafts ?? [];
  const runs: any[] = (data as any).runs ?? [];
  const country: any = (data as any).country;
  const summaries: any[] = (data as any).summaries ?? [];
  const committedTargets: Record<string, { rows: number }> = (data as any).committedTargets ?? {};
  const statusDiagnostics: Array<{ stage: Stage | string; message: string }> = (data as any).statusDiagnostics ?? [];
  const pipelineRuns: any[] = (data as any).pipelineRuns ?? [];
  const latestPipeline = pipelineRuns[0] ?? null;
  const genSummary = useServerFn(generateStageSummary);
  const advanceStep = useServerFn(advanceCountryOnboarding);
  const clearLocks = useServerFn(clearOnboardingLocks);

  // Wrap each runner: open the accordion for that stage, show the sticky
  // banner, poll progress, and emit a result banner on resolve/reject.
  const runners = Object.fromEntries(
    STAGES.map((s) => {
      const raw = runnersRaw[s.key];
      const wrapped = async (arg: { data: { countryCode: string } }) => {
        setRunResult(null);
        setRunProgress(null);
        setOpenStage(s.key);
        setActiveRun({ stage: s.key, label: s.label, startedAt: Date.now() });
        try {
          const res: any = await raw(arg);
          // Adopt the returned runId so we can poll progress rows.
          if (res && typeof res === "object" && typeof res.runId === "string") {
            setActiveRun((prev) => (prev ? { ...prev, runId: res.runId } : prev));
          }
          const text = summarizeRunResult(s.key, res);
          setRunResult({ stage: s.key, label: s.label, ok: true, text, meta: res });
          return res;
        } catch (e: any) {
          setRunResult({ stage: s.key, label: s.label, ok: false, text: e?.message ?? String(e) });
          throw e;
        } finally {
          setActiveRun(null);
        }
      };
      return [s.key, wrapped];
    }),
  ) as Record<string, any>;



  // SOURCE OF TRUTH: a stage is committed iff its target table has rows for
  // this country. `lastRun.status` is only for the activity line, never for
  // the commit badge.
  const committedStages = new Set<string>(
    STAGES.filter((s) => (committedTargets[s.key]?.rows ?? 0) > 0).map((s) => s.key),
  );


  // Cancel-flag for the sequential loop — click "Stop" to break after the
  // current stage finishes.
  const stopRef = useRef(false);

  async function findLatestDraftId(stage: Stage): Promise<string | null> {
    // Re-read status so we pick up the draft the runner just wrote.
    await qc.invalidateQueries({ queryKey: ["onboarding", "status", code] });
    const latest: any = await qc.fetchQuery(statusQuery(code));
    const stageDrafts: any[] = (latest?.drafts ?? []).filter((d: any) => d.stage === stage);
    const active = stageDrafts.find((d) => !d.superseded) ?? stageDrafts[0];
    return active?.id ?? null;
  }

  async function runSequential(mode: "pending" | "rerun") {
    setBulkErr(null);
    setRunErrors([]);
    setSkippedStages([]);
    setBulkRunning(mode);
    stopRef.current = false;
    const errors: Array<{ stage: Stage; message: string }> = [];
    try {
      // Loop: ask the server for the next safe action. If a ready draft already
      // exists, commit it before spending more AI on another generation run.
      for (let safety = 0; safety < STAGES.length + 2; safety++) {
        if (stopRef.current) break;
        const next: any = await advanceStep({ data: { countryCode: code, rerun: mode === "rerun" && safety === 0 } });
        if (next.done || !next.nextStage) break;
        const stage = next.nextStage as Stage;
        try {
          if (next.action === "commit_ready_draft" && next.draftId) {
            setRunResult(null);
            setOpenStage(stage);
            setActiveRun({ stage, label: `Committing ${stage}`, startedAt: Date.now() });
            const commitRes: any = await committers[stage]({ data: { draftId: next.draftId } });
            setRunResult({
              stage,
              label: `Committed ${stage}`,
              ok: true,
              text: summarizeCommitResult(stage, commitRes),
              meta: commitRes,
            });
            setActiveRun(null);
          } else {
            if (next.readyDraft && next.readyDraft.commit_eligible === false) {
              throw new Error(next.readyDraft.blocked_reason ?? "ready draft needs review before this stage can continue");
            }
            const runRes: any = await runners[stage]({ data: { countryCode: code } });
            if (stage === "capital_flows" && runRes?.coverageOk !== true) {
              throw new Error("capital-flow draft needs review before commit");
            }
            const draftId = await findLatestDraftId(stage);
            if (draftId) {
              await committers[stage]({ data: { draftId } });
            }
          }
        } catch (e: any) {
          setActiveRun(null);
          errors.push({ stage, message: e?.message ?? String(e) });
          setRunErrors([...errors]);
          setBulkErr(`Stopped at ${stage}: ${e?.message ?? String(e)}`);
          break;
        }
        await refresh();
      }
    } finally {
      await refresh();
      setBulkRunning(false);
    }
  }

  const runAllPending = () => runSequential("pending");
  const rerunAll = () => runSequential("rerun");
  const stopSequential = () => { stopRef.current = true; };

  async function advanceOne() {
    setBulkErr(null);
    setRunErrors([]);
    setBulkRunning("pending");
    stopRef.current = true;
    try {
      const next: any = await advanceStep({ data: { countryCode: code } });
      if (next.done || !next.nextStage) {
        setRunResult({ stage: "capital_flows", label: "Resume", ok: true, text: "All stages are committed." });
        return;
      }
      const stage = next.nextStage as Stage;
      if (next.action === "commit_ready_draft" && next.draftId) {
        setOpenStage(stage);
        setActiveRun({ stage, label: `Committing ${stage}`, startedAt: Date.now() });
        const commitRes: any = await committers[stage]({ data: { draftId: next.draftId } });
        setRunResult({ stage, label: `Committed ${stage}`, ok: true, text: summarizeCommitResult(stage, commitRes), meta: commitRes });
        return;
      }
      if (next.readyDraft && next.readyDraft.commit_eligible === false) {
        throw new Error(next.readyDraft.blocked_reason ?? "ready draft needs review before this stage can continue");
      }
      const runRes: any = await runners[stage]({ data: { countryCode: code } });
      if (stage === "capital_flows" && runRes?.coverageOk !== true) {
        throw new Error("capital-flow draft needs review before commit");
      }
      const draftId = await findLatestDraftId(stage);
      if (draftId) await committers[stage]({ data: { draftId } });
    } catch (e: any) {
      setBulkErr(e?.message ?? String(e));
    } finally {
      setActiveRun(null);
      setBulkRunning(false);
      await refresh();
    }
  }

  async function onClearLocks() {
    try {
      const res: any = await clearLocks({ data: { countryCode: code } });
      setRunResult({
        stage: "kpi_seed",
        label: "Clear onboarding locks",
        ok: true,
        text: res.cleared > 0
          ? `Cleared ${res.cleared} stale lock(s): ${res.stages.join(", ")}`
          : "No stale locks to clear.",
        meta: res,
      });
      await refresh();
    } catch (e: any) {
      setRunResult({
        stage: "kpi_seed",
        label: "Clear onboarding locks",
        ok: false,
        text: e?.message ?? String(e),
      });
    }
  }


  return (
    <SuperAdminShell
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: country?.name ?? code },
      ]}
    >
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-6">
          <div className="space-y-2">
            <h1 className="font-serif text-3xl">{country?.name}</h1>
            <p className="text-sm text-ink-500">
              {country?.iso3 ?? country?.code} · {country?.currency} · fiscal year starts month{" "}
              {country?.fiscal_year_start_month}
              {country?.gdp_current_usd
                ? ` · GDP $${(Number(country.gdp_current_usd) / 1e9).toFixed(2)}B (${country.gdp_year})`
                : ""}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {STAGES.map((s) => {
                const done = committedStages.has(s.key);
                return (
                  <span
                    key={s.key}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono uppercase tracking-[0.15em] border ${
                      done
                        ? "border-emerald-500 text-emerald-700"
                        : "border-line-200 text-ink-500"
                    }`}
                  >
                    {done ? "✓" : "○"} {s.short}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <button
              type="button"
              onClick={runAllPending}
              disabled={bulkRunning !== false || !keyStatus.configured}
              className="px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 hover:bg-ink-700 disabled:opacity-50"
            >
              {bulkRunning === "pending" ? "Running…" : "Run all pending"}
            </button>
            <button
              type="button"
              onClick={advanceOne}
              disabled={bulkRunning !== false || !keyStatus.configured}
              className="px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:opacity-50"
            >
              Resume one step
            </button>
            <button
              type="button"
              onClick={rerunAll}
              disabled={bulkRunning !== false || !keyStatus.configured}
              title="Re-run every stage, including those already committed. Existing drafts will be overwritten; committed data stays until you re-commit."
              className="px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:opacity-50"
            >
              {bulkRunning === "rerun" ? "Re-running…" : "Rerun all"}
            </button>

            <Link
              to="/admin/countries/$code/data"
              params={{ code }}
              className="px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-line-200 text-ink-500 hover:text-ink-950"
            >
              Manage data stores →
            </Link>

            <Link
              to="/admin/countries/$code/viz"
              params={{ code }}
              className="px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 hover:opacity-90"
            >
              GDP Visualizations →
            </Link>
          </div>
        </header>

        {!keyStatus.configured && (
          <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-700">
            <b>Perplexity API key not configured.</b> Agents cannot run until <code>PERPLEXITY_API_KEY</code> is set.
          </div>
        )}

        <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.15em]">
          <span className={`px-2 py-0.5 border ${ingestKeys.perplexity ? "border-emerald-500 text-emerald-700" : "border-red-500 text-red-700"}`}>
            Perplexity {ingestKeys.perplexity ? "✓" : "✕"}
          </span>
          <span className={`px-2 py-0.5 border ${ingestKeys.firecrawl ? "border-emerald-500 text-emerald-700" : "border-red-500 text-red-700"}`}>
            Firecrawl {ingestKeys.firecrawl ? "✓" : "✕"}
          </span>
          <span className={`px-2 py-0.5 border ${ingestKeys.lovable_ai ? "border-emerald-500 text-emerald-700" : "border-red-500 text-red-700"}`}>
            Lovable AI {ingestKeys.lovable_ai ? "✓" : "✕"}
          </span>
        </div>


        {bulkErr && (
          <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-700">
            Run all pending stopped: {bulkErr}
          </div>
        )}

        {skippedStages.length > 0 && (
          <div className="rounded border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-800 space-y-1">
            <div className="font-medium">Skipped (waiting on upstream commit):</div>
            {skippedStages.map((s) => (
              <div key={s.stage} className="font-mono">
                • {s.stage} — needs {s.waitingOn.join(", ")} committed
              </div>
            ))}
          </div>
        )}

        <PipelineHealthPanel
          stages={STAGES}
          committedTargets={committedTargets}
          drafts={drafts}
          runs={runs}
          diagnostics={statusDiagnostics}
          latestPipeline={latestPipeline}
        />

        <section className="border border-line-200 bg-paper-0 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-500">Sequential runner</div>
            <p className="mt-1 text-xs text-ink-500">
              {bulkRunning
                ? "Running one stage at a time. Keep this tab open; click Stop to pause after the current stage."
                : "Runs stages one by one, auto-committing each draft. Failures halt the loop — fix and re-run."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {bulkRunning && (
              <button
                type="button"
                onClick={stopSequential}
                className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest border border-red-500 text-red-700"
              >
                Stop after current stage
              </button>
            )}
            <button
              type="button"
              onClick={onClearLocks}
              disabled={bulkRunning !== false}
              className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest border border-line-200 text-ink-700 disabled:opacity-50"
            >
              Clear locks
            </button>
          </div>
        </section>

        {runErrors.length > 0 && (
          <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-700 space-y-1">
            <div className="font-medium">Stage failure — sequential run stopped here:</div>
            {runErrors.map((e) => (
              <div key={e.stage} className="font-mono break-words">
                • {e.stage}: {e.message}
              </div>
            ))}
          </div>
        )}

        {/* Sticky Run banner — visible while a stage is running. */}
        {activeRun && (
          <div className="sticky top-2 z-30 rounded border border-ink-950 bg-ink-950 text-paper-0 p-3 shadow-lg flex items-center gap-4">
            <div className="h-3 w-3 rounded-full bg-gold-500 animate-pulse" />
            <div className="flex-1 text-sm">
              <div className="font-medium">
                Running: {activeRun.label} · {elapsed}s elapsed
              </div>
              {runProgress && typeof runProgress.processed === "number" && (
                <div className="text-[11px] text-paper-0/70 font-mono mt-0.5">
                  {runProgress.phase && <>phase {runProgress.phase} · </>}
                  Processed {runProgress.processed}/{runProgress.total ?? "?"}
                  {typeof runProgress.okCount === "number" && (
                    <> · ok {runProgress.okCount} · fail {runProgress.failCount ?? 0}</>
                  )}
                  {typeof runProgress.filled === "number" && (
                    <> · filled {runProgress.filled} · missing {runProgress.missing ?? 0}</>
                  )}
                  {runProgress.currentKpi && <> · now {runProgress.currentKpi}</>}
                  {runProgress.lastUrl && <> · last: {truncateMiddle(runProgress.lastUrl, 60)}</>}
                </div>
              )}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-paper-0/60">
              Do not close this tab
            </span>
          </div>
        )}

        {/* Result banner — shown after a run resolves, until dismissed. */}
        {runResult && !activeRun && (
          <div
            className={`rounded border p-3 text-sm flex items-start gap-3 ${
              runResult.ok
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800"
                : "border-red-500/50 bg-red-500/10 text-red-700"
            }`}
          >
            <div className="flex-1">
              <div className="font-medium">
                {runResult.ok ? "✓" : "✕"} {runResult.label}
              </div>
              <div className="text-xs mt-1 whitespace-pre-wrap">{runResult.text}</div>
            </div>
            <button
              type="button"
              className="text-[10px] font-mono uppercase tracking-widest opacity-70 hover:opacity-100"
              onClick={() => setRunResult(null)}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="text-[10px] font-mono uppercase tracking-widest underline"
              onClick={() => setOpenStage(runResult.stage)}
            >
              Open stage
            </button>
          </div>
        )}

        <AccordionStages
          stages={STAGES}
          drafts={drafts}
          committedDrafts={committedDrafts}
          runs={runs}
          summaries={summaries}
          diagnostics={statusDiagnostics}
          committedTargets={committedTargets}
          countryName={country?.name ?? code}
          keyConfigured={keyStatus.configured}
          runners={runners}
          committers={committers}
          code={code}
          refresh={refresh}
          openStage={openStage}
          setOpenStage={setOpenStage}
          onCleanInvalidSources={async () => {
            try {
              const res: any = await cleanInvalid({ data: { countryCode: code } });
              setRunResult({
                stage: "corpus_ingest",
                label: "Clean invalid source URLs",
                ok: true,
                text: `Deactivated ${res.deactivated} source(s) with invalid URLs.`,
                meta: res,
              });
              await refresh();
            } catch (e: any) {
              setRunResult({
                stage: "corpus_ingest",
                label: "Clean invalid source URLs",
                ok: false,
                text: e?.message ?? String(e),
              });
            }
          }}
          onGenerateSummary={(stage) => genSummary({ data: { countryCode: code, stage } }).then(refresh)}
        />

      </div>

    </SuperAdminShell>
  );
}

function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(-half)}`;
}

function PipelineHealthPanel({
  stages,
  committedTargets,
  drafts,
  runs,
  diagnostics,
  latestPipeline,
}: {
  stages: { key: Stage; label: string; short: string; desc: string }[];
  committedTargets: Record<string, { rows: number }>;
  drafts: any[];
  runs: any[];
  diagnostics: Array<{ stage: Stage | string; message: string }>;
  latestPipeline: any;
}) {
  const latestResults: any[] = Array.isArray(latestPipeline?.results) ? latestPipeline.results : [];
  return (
    <section className="border border-line-200 bg-paper-0 p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-500">Pipeline health</div>
          {latestPipeline && (
            <p className="mt-1 text-xs text-ink-500">
              Latest workflow {latestPipeline.status} · {latestPipeline.mode} · {new Date(latestPipeline.started_at).toLocaleString()}
              {latestPipeline.error ? ` · ${latestPipeline.error}` : ""}
            </p>
          )}
        </div>
        {diagnostics.length > 0 && (
          <span className="border border-red-500 text-red-700 px-2 py-1 text-[10px] font-mono uppercase tracking-widest">
            {diagnostics.length} status issue{diagnostics.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {stages.map((s) => {
          const targetRows = committedTargets[s.key]?.rows ?? 0;
          const draft = drafts.find((d) => d.stage === s.key && !d.superseded);
          const run = runs.find((r) => r.stage === s.key);
          const diag = diagnostics.find((d) => d.stage === s.key);
          const result = latestResults.find((r) => r.stage === s.key);
          const plan = run?.plan && typeof run.plan === "object" ? run.plan : null;
          return (
            <div key={s.key} className="border border-line-200 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink-950">{s.short}</span>
                <span className={`font-mono text-[10px] ${diag ? "text-red-700" : targetRows > 0 ? "text-emerald-700" : draft ? "text-amber-700" : "text-ink-500"}`}>
                  {diag ? "check failed" : targetRows > 0 ? `${targetRows} committed` : draft ? "draft ready" : "pending"}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-ink-500 space-y-0.5">
                {run && <div>last run {run.status}</div>}
                {plan?.phase && (
                  <div className="font-mono text-[10px] text-ink-600">
                    {String(plan.phase)}
                    {typeof plan.processed === "number" && <> · {plan.processed}/{plan.total ?? "?"}</>}
                    {typeof plan.filled === "number" && <> · filled {plan.filled}</>}
                    {plan.currentKpi && <> · {String(plan.currentKpi)}</>}
                  </div>
                )}
                {result && <div>pipeline {result.status}{result.message ? ` — ${result.message}` : ""}</div>}
                {diag && <div className="text-red-700 break-words">{diag.message}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}


function summarizeRunResult(stage: Stage, res: any): string {
  if (!res) return "Completed.";
  if (stage === "corpus_ingest" && typeof res.okCount === "number") {
    return `Ingested ${res.totalChunks ?? 0} chunks across ${res.okCount} source(s) (${res.failCount ?? 0} failed).`;
  }
  if (stage === "kpi_seed" && res.coverage) {
    return `KPI draft ready: ${res.coverage.filled}/${res.coverage.total} required filled across ${res.attempts ?? 0} attempts${res.coverage.missing?.length ? `; missing ${res.coverage.missing.join(", ")}` : ""}.`;
  }
  if (typeof res.count === "number") return `Draft ready with ${res.count} item(s). Review below.`;
  if (typeof res.inserted === "number") return `Inserted ${res.inserted} row(s).`;
  return "Completed.";
}

function summarizeCommitResult(stage: Stage, res: any): string {
  if (stage === "capital_flows" && res?.reconciliation) {
    return `Committed ${res.upserted ?? 0} flow row(s); residual ${Number(res.reconciliation.residual ?? 0).toFixed(1)}.`;
  }
  if (typeof res?.upserted === "number") return `Committed ${res.upserted} row(s).`;
  if (typeof res?.inserted === "number" || typeof res?.updated === "number") {
    return `Committed ${res.inserted ?? 0} inserted, ${res.updated ?? 0} updated, ${res.skipped ?? 0} skipped.`;
  }
  return "Committed ready draft.";
}


function AccordionStages({
  stages,
  drafts,
  committedDrafts,
  runs,
  summaries,
  diagnostics,
  committedTargets,
  countryName,
  keyConfigured,
  runners,
  committers,
  code,
  refresh,
  openStage,
  setOpenStage,
  onCleanInvalidSources,
  onGenerateSummary,
}: {
  stages: { key: Stage; label: string; short: string; desc: string }[];
  drafts: any[];
  committedDrafts: any[];
  runs: any[];
  summaries: any[];
  diagnostics: Array<{ stage: Stage | string; message: string }>;
  committedTargets: Record<string, { rows: number }>;
  countryName: string;
  keyConfigured: boolean;
  runners: Record<string, any>;
  committers: Record<string, any>;
  code: string;
  refresh: () => void;
  openStage: string | null;
  setOpenStage: (s: string | null) => void;
  onCleanInvalidSources: () => Promise<void>;
  onGenerateSummary: (stage: Stage) => Promise<unknown>;
}) {
  return (
    <>
      {stages.map((s) => {
        const stageDrafts = drafts.filter((d) => d.stage === s.key);
        const draft = stageDrafts.find((d) => !d.superseded) ?? stageDrafts[0];
        const committedDraft = committedDrafts.find((d) => d.stage === s.key);
        const stageRuns = runs.filter((r) => r.stage === s.key);
        const lastRun = stageRuns[0];
        const lastCommitRun = stageRuns.find((r) => r.status === "committed");
        const summary = summaries.find((x) => x.stage === s.key);
        const diagnostic = diagnostics.find((x) => x.stage === s.key);
        const target = committedTargets[s.key] ?? { rows: 0 };
        return (
          <StageCard
            key={s.key}
            stage={s}
            countryName={countryName}
            draft={draft}
            committedDraft={committedDraft}
            lastRun={lastRun}
            lastCommitRun={lastCommitRun}
            targetRows={target.rows}
            summary={summary}
            diagnostic={diagnostic}
            keyConfigured={keyConfigured}
            isOpen={openStage === s.key}
            onToggle={() => setOpenStage(openStage === s.key ? null : s.key)}
            onRun={() => runners[s.key]({ data: { countryCode: code } }).then(refresh)}
            onCommit={(editedPayload) =>
              committers[s.key]({ data: { draftId: draft.id, editedPayload } }).then(refresh)
            }
            onGenerateSummary={() => onGenerateSummary(s.key)}
            onCleanInvalidSources={s.key === "corpus_ingest" ? onCleanInvalidSources : undefined}
          />
        );
      })}
    </>
  );
}




function StageCard({
  stage,
  countryName,
  draft,
  committedDraft,
  lastRun,
  lastCommitRun,
  targetRows,
  summary,
  diagnostic,
  keyConfigured,
  isOpen,
  onToggle,
  onRun,
  onCommit,
  onGenerateSummary,
  onCleanInvalidSources,
}: {
  stage: { key: Stage; label: string; short: string; desc: string };
  countryName: string;
  draft: any;
  committedDraft: any;
  lastRun: any;
  lastCommitRun: any;
  targetRows: number;
  summary: any;
  diagnostic?: { stage: Stage | string; message: string };
  keyConfigured: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onRun: () => Promise<unknown>;
  onCommit: (editedPayload: unknown) => Promise<unknown>;
  onGenerateSummary: () => Promise<unknown>;
  onCleanInvalidSources?: () => Promise<void>;
}) {

  const [running, setRunning] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [edited, setEdited] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      const el = sectionRef.current;
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY - 8;
      window.scrollTo({ top: y, behavior: "smooth" });
    });
  }, [isOpen]);


  // Ground truth: target table has rows for this country.
  const committed = targetRows > 0;
  const statusUnreliable = !!diagnostic;
  const commitAt = lastCommitRun?.finished_at ?? lastCommitRun?.started_at ?? null;
  // A draft that arrived AFTER the last commit — user re-ran and can re-commit.
  // Requires an actual prior commit; otherwise it's a first-time commit, not a re-commit.
  const hasNewerDraft =
    committed && !!draft && !!commitAt && new Date(draft.created_at) > new Date(commitAt);
  // Draft exists but stage has never been committed → surface a hint under the description.
  const draftItemCount: number | null = (() => {
    const p: any = draft?.payload;
    if (!p || typeof p !== "object") return null;
    if (Array.isArray(p)) return p.length;
    for (const k of ["kpis", "ministries", "sectors", "sources", "items", "mappings", "dossiers", "memories"]) {
      if (Array.isArray(p[k])) return p[k].length;
    }
    return null;
  })();
  const showDraftReadyHint = !committed && !!draft;
  const payload = draft?.payload;
  const citations: any[] = draft?.citations ?? [];
  const hasFlowSourceUrls =
    stage.key === "capital_flows" &&
    Array.isArray(payload?.flows) &&
    payload.flows.some((flow: any) => typeof flow?.source_url === "string" && /^https?:\/\//.test(flow.source_url));
  const capitalFlowsCoverage = stage.key === "capital_flows" ? payload?.coverage : null;
  const capitalFlowsNeedsReview =
    stage.key === "capital_flows" && !!capitalFlowsCoverage && capitalFlowsCoverage.coverageOk === false;
  const canCommitDraft =
    !!draft &&
    (citations.length > 0 || hasFlowSourceUrls) &&
    !capitalFlowsNeedsReview;
  const runActionLabel = running ? "Researching…" : draft || lastRun ? "Run again" : "Run AI research";
  const model = (lastRun?.model_stack && (lastRun.model_stack.research || Object.values(lastRun.model_stack)[0])) as
    | string
    | undefined;


  async function doRun() {
    setRunning(true);
    setErr(null);
    try {
      await onRun();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setRunning(false);
    }
  }

  async function doCommit() {
    setCommitting(true);
    setErr(null);
    let parsed: unknown = undefined;
    if (edited) {
      try {
        parsed = JSON.parse(edited);
      } catch {
        setErr("Edited JSON is invalid — commit aborted.");
        setCommitting(false);
        return;
      }
    }
    try {
      await onCommit(parsed);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setCommitting(false);
    }
  }

  async function doGenerateSummary() {
    setGeneratingSummary(true);
    setErr(null);
    try {
      await onGenerateSummary();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setGeneratingSummary(false);
    }
  }


  return (
    <section ref={sectionRef} className="border border-line-200 bg-paper-0 scroll-mt-2">
      <div className="flex items-stretch justify-between gap-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex-1 flex items-center gap-3 p-5 text-left hover:bg-paper-100/50"
        >
          <span
            aria-hidden
            className={`inline-block text-ink-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
          >
            ›
          </span>
          <span className="flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              {stage.label}
              {committed && !hasNewerDraft && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700">committed</span>
              )}
              {committed && hasNewerDraft && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-700">new draft</span>
              )}
              {!committed && draft && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-700">review</span>
              )}
            </h2>
            <p className="text-xs text-ink-500 mt-1">{stage.desc}</p>
            {showDraftReadyHint && (
              <p className="text-xs text-emerald-700 mt-1">
                Draft ready{draftItemCount != null ? ` with ${draftItemCount} item${draftItemCount === 1 ? "" : "s"}` : ""} — press Commit to write to <code>{draft?.target_table ?? "target table"}</code>.
              </p>
            )}
          </span>
        </button>
        <div className="flex items-center gap-2 pr-5">
          {committed && (
            <span
              className="text-sm px-3 py-1.5 border border-emerald-500 bg-emerald-500/10 text-emerald-700 inline-flex items-center gap-1"
              title={`Target table has ${targetRows} row(s) for this country${commitAt ? ` · committed ${new Date(commitAt).toLocaleString()}` : ""}`}
            >
              ✓ Committed{targetRows > 1 ? ` (${targetRows})` : ""}
            </span>
          )}
          {(!committed || hasNewerDraft) && !statusUnreliable && (
            <button
              type="button"
              className={`text-sm px-3 py-1.5 border disabled:opacity-50 ${
                hasNewerDraft
                  ? "border-amber-500 text-amber-700 hover:bg-amber-500/10"
                  : "border-emerald-500 text-emerald-700 hover:bg-emerald-500/10"
              }`}
              disabled={committing || !canCommitDraft}
              title={
                !draft
                  ? "Run AI research first to produce a draft"
                  : capitalFlowsNeedsReview
                    ? "Coverage incomplete — needs ≥3 inputs, ≥4 outputs, ≤10% residual"
                    : !canCommitDraft
                      ? "Draft has no citations — cannot commit"
                      : hasNewerDraft
                        ? "A newer draft is waiting — commit it to replace the currently-committed data"
                        : "Commit draft to database"
              }
              onClick={(e) => {
                e.stopPropagation();
                doCommit();
              }}
            >
              {committing
                ? "Committing…"
                : hasNewerDraft
                  ? `Re-commit to ${draft?.target_table ?? "target"}`
                  : draft
                    ? `Commit to ${draft.target_table}`
                    : "Run agent to create draft"}
            </button>
          )}

          <button
            type="button"
            className="text-sm px-3 py-1.5 border border-ink-950 bg-ink-950 text-paper-0 hover:bg-ink-700 disabled:opacity-50"
            disabled={running || !keyConfigured}
            onClick={(e) => {
              e.stopPropagation();
              doRun();
            }}
          >
            {runActionLabel}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="px-5 pb-5 space-y-4 border-t border-line-200 pt-4">
          {onCleanInvalidSources && (
            <CorpusIngestExtras
              lastRun={lastRun}
              onCleanInvalidSources={onCleanInvalidSources}
            />
          )}

          {/* Executive summary — the beautifully written natural result of this stage */}
          {committed && summary && (
            <div className="space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-500">
                Executive summary
              </div>
              <p className="font-serif text-[15px] leading-relaxed text-ink-950 whitespace-pre-wrap">
                {summary.summary_md}
              </p>
              {Array.isArray(summary.highlights) && summary.highlights.length > 0 && (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-1">
                  {summary.highlights.map((h: any, i: number) => (
                    <div key={i} className="flex items-baseline justify-between gap-3 border-b border-line-200/60 pb-1">
                      <dt className="text-xs text-ink-500 uppercase tracking-wide">{h.label}</dt>
                      <dd className="text-sm font-medium text-ink-950 text-right tabular-nums">{h.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="flex items-center gap-3 text-[11px] text-ink-500">
                <span>
                  Generated {new Date(summary.generated_at).toLocaleString()}
                  {summary.model && <> · <code>{summary.model}</code></>}
                </span>
                <button
                  type="button"
                  onClick={doGenerateSummary}
                  disabled={generatingSummary}
                  className="underline hover:text-ink-950 disabled:opacity-50"
                >
                  {generatingSummary ? "Regenerating…" : "Regenerate"}
                </button>
              </div>
            </div>
          )}

          {committed && !summary && (
            <div className="rounded border border-dashed border-line-200 p-3 space-y-2">
              <div className="text-xs text-ink-500">
                No executive summary yet for this stage.
              </div>
              <button
                type="button"
                onClick={doGenerateSummary}
                disabled={generatingSummary}
                className="text-sm px-3 py-1.5 border border-ink-950 text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:opacity-50"
              >
                {generatingSummary ? "Generating…" : "Generate executive summary"}
              </button>
            </div>
          )}

          {lastRun && (
            <div className="text-[11px] text-ink-500">
              Last run: {new Date(lastRun.started_at).toLocaleString()} · status {lastRun.status}
              {model && <> · model <code>{model}</code></>}
              {typeof lastRun.cost_cents === "number" && lastRun.cost_cents > 0 && (
                <> · cost ${(lastRun.cost_cents / 100).toFixed(3)}</>
              )}
              {lastRun.error && (
                <div className="mt-1 text-red-600 whitespace-pre-wrap">{lastRun.error}</div>
              )}
              <RunPlanSummary plan={lastRun.plan} />
            </div>
          )}

          {diagnostic && (
            <div className="rounded border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-700">
              Status check failed for this stage: {diagnostic.message}
            </div>
          )}

          {err && (
            <div className="rounded border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-700">{err}</div>
          )}

          {/* Capital-flows coverage checklist */}
          {stage.key === "capital_flows" && capitalFlowsCoverage && (
            <>
              <CapitalFlowsCoverage coverage={capitalFlowsCoverage} reconciliation={payload?.reconciliation} droppedFlows={payload?.dropped_flows} />
              <CapitalFlowsWorkbench payload={payload} citations={citations} />
            </>
          )}

          {/* Draft (review) UI — shown when a draft is awaiting commit */}
          {draft && (
            <>
              <div className="rounded border border-line-200 bg-paper-100/50 p-3 space-y-2">
                <div className="text-xs text-ink-500">
                  Draft payload · confidence {draft.confidence}
                </div>
                <PrettyJson value={payload} citations={citations as any} />
                <details className="text-xs">
                  <summary className="cursor-pointer text-ink-500 hover:text-ink-950">Edit raw JSON to override before commit</summary>
                  <textarea
                    className="mt-2 w-full font-mono text-xs bg-paper-0 border border-line-200 p-2 min-h-[180px]"
                    defaultValue={JSON.stringify(payload, null, 2)}
                    onChange={(e) => setEdited(e.target.value)}
                  />
                </details>
              </div>


              <div>
                <div className="text-xs font-medium mb-1">Citations ({citations.length})</div>
                {citations.length === 0 ? (
                  <div className="text-xs text-red-600">⚠ No citations — cannot commit.</div>
                ) : (
                  <ul className="text-xs space-y-1">
                    {citations.map((c) => (
                      <li key={c.id}>
                        <a href={c.url} target="_blank" rel="noreferrer" className="text-ink-950 underline hover:text-ink-700">
                          {c.domain || c.url}
                        </a>
                        {c.title && <span className="text-ink-500"> — {c.title}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

            </>
          )}

          {/* Committed payload — human-readable primary view + raw debug toggle */}
          {committed && (() => {
            const committedPayload = committedDraft?.payload ?? draft?.payload ?? summary?.highlights ?? {};
            const committedCitations = (committedDraft?.citations?.length ? committedDraft.citations : citations) as any[];
            return (
              <div className="space-y-2">
                <PrettyJson value={committedPayload} citations={committedCitations as any} />
                <details className="text-xs" open={showRaw} onToggle={(e) => setShowRaw((e.target as HTMLDetailsElement).open)}>
                  <summary className="cursor-pointer text-ink-500 hover:text-ink-950">View raw committed data (debug)</summary>
                  <pre className="mt-2 max-h-80 overflow-auto bg-paper-100/50 border border-line-200 p-2 font-mono text-[11px] whitespace-pre-wrap">
                    {JSON.stringify(committedPayload, null, 2)}
                  </pre>
                </details>
              </div>
            );
          })()}

          {!draft && !running && !committed && (
            <div className="text-xs text-ink-500">
              No draft yet. Click "Run AI research" to have the agent research {countryName} and produce a cited draft.
            </div>
          )}
        </div>
      )}

    </section>
  );
}

function RunPlanSummary({ plan }: { plan: any }) {
  if (!plan || typeof plan !== "object") return null;
  const missingKpis = Array.isArray(plan.missingKpis) ? plan.missingKpis : [];
  const updatedAt = typeof plan.updatedAt === "string" ? plan.updatedAt : null;
  const updatedText = updatedAt ? new Date(updatedAt).toLocaleTimeString() : null;
  if (!plan.phase && typeof plan.processed !== "number" && missingKpis.length === 0) return null;
  return (
    <div className="mt-2 rounded border border-line-200 bg-paper-100/50 p-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-600">
      {plan.phase && <span>phase {String(plan.phase)}</span>}
      {typeof plan.processed === "number" && (
        <span>{plan.phase ? " · " : ""}{plan.processed}/{plan.total ?? "?"} processed</span>
      )}
      {typeof plan.okCount === "number" && <span> · ok {plan.okCount} · fail {plan.failCount ?? 0}</span>}
      {typeof plan.filled === "number" && <span> · filled {plan.filled} · missing {plan.missing ?? 0}</span>}
      {plan.currentKpi && <span> · current {String(plan.currentKpi)}</span>}
      {updatedText && <span> · heartbeat {updatedText}</span>}
      {missingKpis.length > 0 && (
        <div className="mt-1 normal-case tracking-normal text-ink-500">
          Missing: {missingKpis.slice(0, 8).join(", ")}{missingKpis.length > 8 ? ` +${missingKpis.length - 8} more` : ""}
        </div>
      )}
    </div>
  );
}

function CorpusIngestExtras({
  lastRun,
  onCleanInvalidSources,
}: {
  lastRun: any;
  onCleanInvalidSources: () => Promise<void>;
}) {
  const [cleaning, setCleaning] = useState(false);
  // The ingest run stores its final { results, okCount, failCount, totalChunks }
  // in `plan` for finished runs (via the heartbeat writes) and in the committed
  // draft payload. Prefer plan; fall back to nothing if not present.
  const report: any = lastRun?.plan && typeof lastRun.plan === "object" ? lastRun.plan : null;
  const results: any[] = Array.isArray(report?.results) ? report.results : [];

  return (
    <div className="rounded border border-line-200 bg-paper-100/50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-500">
          Corpus ingest health
        </div>
        <button
          type="button"
          disabled={cleaning}
          onClick={async () => {
            setCleaning(true);
            try {
              await onCleanInvalidSources();
            } finally {
              setCleaning(false);
            }
          }}
          className="text-[11px] font-mono uppercase tracking-widest px-3 py-1 border border-ink-950 text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:opacity-50"
        >
          {cleaning ? "Cleaning…" : "Clean invalid URLs"}
        </button>
      </div>
      {report && (
        <div className="text-[11px] font-mono text-ink-700">
          {typeof report.okCount === "number" && (() => {
            const dedup = results.filter((r) => r.ok && (r.chunks ?? 0) === 0).length;
            const skipped = results.filter((r) => !r.ok && typeof r.error === "string" && r.error.startsWith("invalid url")).length;
            const failReal = (report.failCount ?? 0) - skipped;
            return (
              <>
                ok {report.okCount} · dedup {dedup} · fail {Math.max(failReal, 0)} · skipped {skipped}
                {typeof report.totalChunks === "number" && <> · chunks {report.totalChunks}</>}
                {typeof report.processed === "number" && typeof report.total === "number" && (
                  <> · processed {report.processed}/{report.total}</>
                )}
              </>
            );
          })()}
        </div>
      )}
      {results.length > 0 && (
        <div className="max-h-64 overflow-y-auto border border-line-200 divide-y divide-line-200">
          {results.map((r, i) => {
            const isInvalid = !r.ok && typeof r.error === "string" && r.error.startsWith("invalid url");
            const dot = r.ok ? "bg-emerald-500" : isInvalid ? "bg-ink-400" : "bg-red-500";
            return (
              <div key={i} className="p-2 flex items-start gap-3 text-xs">
                <span
                  className={`mt-0.5 inline-block h-2 w-2 rounded-full flex-shrink-0 ${dot}`}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-mono text-[11px] text-ink-700">{r.url}</div>
                  {r.ok ? (
                    <div className="text-[10px] text-ink-500 mt-0.5">
                      {typeof r.chunks === "number" ? `${r.chunks} chunks` : "ok"}
                    </div>
                  ) : isInvalid ? (
                    <div className="text-[10px] text-ink-500 mt-0.5">deactivated: invalid URL</div>
                  ) : (
                    <div className="text-[10px] text-red-600 mt-0.5 line-clamp-2">{r.error}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!report && (
        <p className="text-xs text-ink-500">
          No ingest run yet — click <b>Run AI research</b> to scrape and embed active sources.
        </p>
      )}
    </div>
  );
}

const CAPITAL_FLOW_NODE_LABELS: Record<string, string> = {
  TOURISM_SPEND: "Gross Tourism Spend",
  CBI_INFLOWS: "CBI Inflows",
  FDI_NET: "Foreign Direct Investment",
  REMITTANCES: "Remittances",
  ODA_GRANTS: "ODA & Grants",
  TAX_REVENUE: "Tax Revenue",
  WAGES_AGRI: "Local Wages / Agriculture",
  INFRA_CAPEX: "Public Works & Infrastructure",
  DEBT_SERVICE: "External Debt Service",
  DIGITAL_HEALTH_CAPEX: "Digital & Health CapEx",
  ENERGY_IMPORT: "Energy & Utilities Import",
  IMPORT_LEAKAGE: "Import Leakages",
};

function CapitalFlowsCoverage({
  coverage,
  reconciliation,
  droppedFlows,
}: {
  coverage: { inputs?: string[]; outputs?: string[]; missingInputs?: string[]; missingOutputs?: string[]; coverageOk?: boolean };
  reconciliation?: { sumIn?: number; sumOut?: number; residual_pct?: number };
  droppedFlows?: Array<{ node_key?: string; reason?: string; value_usd_m?: number }>;
}) {
  const inputs = coverage.inputs ?? [];
  const outputs = coverage.outputs ?? [];
  const missingInputs = coverage.missingInputs ?? [];
  const missingOutputs = coverage.missingOutputs ?? [];
  const ok = coverage.coverageOk === true;
  const resPct = reconciliation?.residual_pct != null ? Math.round(reconciliation.residual_pct * 100) : null;
  const chip = (key: string, populated: boolean) => (
    <span
      key={key}
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${
        populated ? "bg-emerald-500/15 text-emerald-700" : "bg-red-500/15 text-red-700"
      }`}
    >
      <span aria-hidden>{populated ? "✓" : "✗"}</span>
      {CAPITAL_FLOW_NODE_LABELS[key] ?? key}
    </span>
  );
  return (
    <div className={`rounded border p-3 space-y-2 ${ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/50 bg-amber-500/5"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-medium">
          {ok ? "✓ Coverage complete" : "⚠ Coverage incomplete — needs ≥3 inputs, ≥4 outputs, ≤10% residual"}
        </div>
        <div className="text-[11px] text-ink-500 tabular-nums">
          {inputs.length}/6 inputs · {outputs.length}/6 outputs
          {resPct != null && <span> · residual {resPct}%</span>}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-ink-500 mb-1">Inputs</div>
        <div className="flex flex-wrap gap-1">
          {inputs.map((k) => chip(k, true))}
          {missingInputs.map((k) => chip(k, false))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-ink-500 mb-1">Outputs</div>
        <div className="flex flex-wrap gap-1">
          {outputs.map((k) => chip(k, true))}
          {missingOutputs.map((k) => chip(k, false))}
        </div>
      </div>
      {Array.isArray(droppedFlows) && droppedFlows.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-ink-500 hover:text-ink-950">
            {droppedFlows.length} flow{droppedFlows.length === 1 ? "" : "s"} dropped during validation
          </summary>
          <ul className="mt-1 space-y-0.5 text-[11px] text-ink-500">
            {droppedFlows.map((d, i) => (
              <li key={i}>
                <span className="font-mono">{d.node_key ?? "?"}</span>
                {d.value_usd_m != null && <span className="tabular-nums"> · ${Math.round(Number(d.value_usd_m))}m</span>}
                {d.reason && <span> — {d.reason}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function formatUsdM(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}B`;
  return `$${Math.round(n)}M`;
}

function CapitalFlowsWorkbench({ payload, citations }: { payload: any; citations: any[] }) {
  const flows: any[] = Array.isArray(payload?.flows) ? payload.flows : [];
  const workbook = payload?.workbook;
  if (!flows.length && !workbook) return null;
  const sourceHref = (flow: any) =>
    typeof flow?.source_url === "string" && /^https?:\/\//.test(flow.source_url) ? flow.source_url : null;
  return (
    <div className="rounded border border-line-200 bg-paper-100/50 p-3 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-500">Capital-flow research workbook</div>
          <p className="mt-1 text-xs text-ink-500">
            Node-level values, formulas, assumptions, and source trail for the Sankey ledger.
          </p>
        </div>
        {workbook?.country_context && (
          <div className="text-[11px] font-mono text-ink-500 tabular-nums text-right">
            GDP {formatUsdM(workbook.country_context.gdp_usd_m)} · {workbook.country_context.kpi_count ?? 0} KPIs · {workbook.country_context.corpus_chunks_sampled ?? 0} chunks
          </div>
        )}
      </div>

      {flows.length > 0 && (
        <div className="overflow-x-auto border border-line-200 bg-paper-0">
          <table className="min-w-full text-xs">
            <thead className="bg-paper-100 text-[10px] font-mono uppercase tracking-[0.16em] text-ink-500">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Node</th>
                <th className="px-2 py-2 text-right font-medium">Value</th>
                <th className="px-2 py-2 text-left font-medium">Method</th>
                <th className="px-2 py-2 text-left font-medium">Formula / assumption</th>
                <th className="px-2 py-2 text-left font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-200">
              {flows.map((flow) => {
                const href = sourceHref(flow);
                return (
                  <tr key={flow.node_key}>
                    <td className="px-2 py-2 align-top">
                      <div className="font-medium text-ink-950">{CAPITAL_FLOW_NODE_LABELS[flow.node_key] ?? flow.node_key}</div>
                      <div className="font-mono text-[10px] text-ink-500">{flow.node_key} · {flow.period ?? payload?.period ?? "—"}</div>
                    </td>
                    <td className="px-2 py-2 align-top text-right font-mono tabular-nums text-ink-950">{formatUsdM(flow.value_usd_m)}</td>
                    <td className="px-2 py-2 align-top">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-700">{flow.method ?? "—"}</span>
                      <div className="mt-1 text-[10px] text-ink-500">Confidence {flow.confidence_grade ?? "—"}</div>
                      {flow.source_kind && <div className="mt-1 text-[10px] text-ink-500">{flow.source_kind}</div>}
                    </td>
                    <td className="px-2 py-2 align-top max-w-md">
                      {flow.formula && <div className="font-mono text-[11px] text-ink-700 leading-relaxed">{flow.formula}</div>}
                      {flow.notes && <div className="mt-1 text-[11px] text-ink-500 leading-relaxed">{flow.notes}</div>}
                      {flow.validation?.above_gdp_cap && (
                        <div className="mt-1 text-[10px] text-signal-caution">Above GDP plausibility cap — evidence retained for review.</div>
                      )}
                    </td>
                    <td className="px-2 py-2 align-top max-w-xs">
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-ink-950 break-all">
                          {flow.source_org || href}
                        </a>
                      ) : (
                        <span className="text-red-600">No source URL</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {workbook?.attempts_summary && (
        <div className="flex flex-wrap gap-2 text-[11px] text-ink-500">
          {Object.entries(workbook.attempts_summary).map(([k, v]) => (
            <span key={k} className="rounded border border-line-200 bg-paper-0 px-2 py-1 font-mono uppercase tracking-[0.14em]">
              {k}: {String(v)}
            </span>
          ))}
          {citations.length > 0 && (
            <span className="rounded border border-line-200 bg-paper-0 px-2 py-1 font-mono uppercase tracking-[0.14em]">
              citations: {citations.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}


