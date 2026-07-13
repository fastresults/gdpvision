import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
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
  commitKpis,
  commitMinistryDeepDive,
  commitSecondBrainSeed,
  commitSectorDossiers,
  commitSourceRegistry,
  getIngestKeysStatus,
  runCorpusIngest,
  runKpiSeedAgent,
  runMinistryDeepDiveAgent,
  runSecondBrainSeedAgent,
  runSectorDossierAgent,
  runSourceRegistryAgent,
} from "@/lib/country-onboarding/corpus.functions";
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
  | "second_brain_seed";

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
];

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
  const qc = useQueryClient();
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkErr, setBulkErr] = useState<string | null>(null);

  const runners: Record<Stage, any> = {
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
  };

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["onboarding", "status", code] }),
      qc.invalidateQueries({ queryKey: ["onboarding", "countries"] }),
      qc.invalidateQueries({ queryKey: ["onboarding", "runs"] }),
    ]);

  const drafts: any[] = (data as any).drafts ?? [];
  const runs: any[] = (data as any).runs ?? [];
  const country: any = (data as any).country;
  const summaries: any[] = (data as any).summaries ?? [];
  const genSummary = useServerFn(generateStageSummary);


  const committedStages = new Set<string>(
    runs.filter((r) => r.status === "committed").map((r) => r.stage),
  );

  async function runAllPending() {
    setBulkErr(null);
    setBulkRunning(true);
    try {
      for (const s of STAGES) {
        const hasDraft = drafts.some((d) => d.stage === s.key);
        if (committedStages.has(s.key) || hasDraft) continue;
        await runners[s.key]({ data: { countryCode: code } });
        await refresh();
      }
    } catch (e: any) {
      setBulkErr(e?.message ?? String(e));
    } finally {
      setBulkRunning(false);
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
              disabled={bulkRunning || !keyStatus.configured}
              className="px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 hover:bg-ink-700 disabled:opacity-50"
            >
              {bulkRunning ? "Running…" : "Run all pending"}
            </button>
            <Link
              to="/admin/countries/$code/data"
              params={{ code }}
              className="px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-line-200 text-ink-500 hover:text-ink-950"
            >
              Manage data stores →
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

        <AccordionStages
          stages={STAGES}
          drafts={drafts}
          runs={runs}
          countryName={country?.name ?? code}
          keyConfigured={keyStatus.configured}
          runners={runners}
          committers={committers}
          code={code}
          refresh={refresh}
        />

      </div>
    </SuperAdminShell>
  );
}

function AccordionStages({
  stages,
  drafts,
  runs,
  countryName,
  keyConfigured,
  runners,
  committers,
  code,
  refresh,
}: {
  stages: { key: Stage; label: string; short: string; desc: string }[];
  drafts: any[];
  runs: any[];
  countryName: string;
  keyConfigured: boolean;
  runners: Record<string, any>;
  committers: Record<string, any>;
  code: string;
  refresh: () => void;
}) {
  const [openStage, setOpenStage] = useState<string | null>(null);
  return (
    <>
      {stages.map((s) => {
        const draft = drafts.find((d) => d.stage === s.key);
        const stageRuns = runs.filter((r) => r.stage === s.key);
        const lastRun = stageRuns[0];
        return (
          <StageCard
            key={s.key}
            stage={s}
            countryName={countryName}
            draft={draft}
            lastRun={lastRun}
            keyConfigured={keyConfigured}
            isOpen={openStage === s.key}
            onToggle={() => setOpenStage(openStage === s.key ? null : s.key)}
            onRun={() => runners[s.key]({ data: { countryCode: code } }).then(refresh)}
            onCommit={(editedPayload) =>
              committers[s.key]({ data: { draftId: draft.id, editedPayload } }).then(refresh)
            }
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
  lastRun,
  keyConfigured,
  isOpen,
  onToggle,
  onRun,
  onCommit,
}: {
  stage: { key: Stage; label: string; short: string; desc: string };
  countryName: string;
  draft: any;
  lastRun: any;
  keyConfigured: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onRun: () => Promise<unknown>;
  onCommit: (editedPayload: unknown) => Promise<unknown>;
}) {

  const [running, setRunning] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [edited, setEdited] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const committed = lastRun?.status === "committed";
  const payload = draft?.payload;
  const citations: any[] = draft?.citations ?? [];
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

  return (
    <section className="border border-line-200 bg-paper-0">
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
              {committed && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700">committed</span>
              )}
              {draft && !committed && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-700">review</span>
              )}
            </h2>
            <p className="text-xs text-ink-500 mt-1">{stage.desc}</p>
          </span>
        </button>
        <div className="flex items-center pr-5">
          <button
            type="button"
            className="text-sm px-3 py-1.5 border border-ink-950 bg-ink-950 text-paper-0 hover:bg-ink-700 disabled:opacity-50"
            disabled={running || !keyConfigured}
            onClick={(e) => {
              e.stopPropagation();
              doRun();
            }}
          >
            {running ? "Researching…" : draft ? "Re-run agent" : "Run AI research"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="px-5 pb-5 space-y-4 border-t border-line-200 pt-4">
          {lastRun && (
            <div className="text-xs text-ink-500">
              Last run: {new Date(lastRun.started_at).toLocaleString()} · status {lastRun.status}
              {model && <> · model <code>{model}</code></>}
              {typeof lastRun.cost_cents === "number" && lastRun.cost_cents > 0 && (
                <> · cost ${(lastRun.cost_cents / 100).toFixed(3)}</>
              )}
              {lastRun.error && (
                <div className="mt-1 text-red-600 whitespace-pre-wrap">{lastRun.error}</div>
              )}
            </div>
          )}

          {err && (
            <div className="rounded border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-700">{err}</div>
          )}

          {draft && (
            <>
              <div className="rounded border border-line-200 bg-paper-100/50 p-3">
                <div className="text-xs text-ink-500 mb-2">
                  Draft payload (edit JSON below to override before commit) · confidence {draft.confidence}
                </div>
                <textarea
                  className="w-full font-mono text-xs bg-paper-0 border border-line-200 p-2 min-h-[180px]"
                  defaultValue={JSON.stringify(payload, null, 2)}
                  onChange={(e) => setEdited(e.target.value)}
                />
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

              {!committed && (
                <button
                  type="button"
                  className="text-sm px-3 py-1.5 border border-emerald-500 text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50"
                  disabled={committing || citations.length === 0}
                  onClick={doCommit}
                >
                  {committing ? "Committing…" : `Commit to ${draft.target_table}`}
                </button>
              )}
            </>
          )}

          {!draft && !running && (
            <div className="text-xs text-ink-500">
              No draft yet. Click "Run AI research" to have the agent research {countryName} and produce a cited draft.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

