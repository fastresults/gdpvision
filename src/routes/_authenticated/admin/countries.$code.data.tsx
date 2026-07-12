import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { AddSourceDialog } from "@/components/country-data/AddSourceDialog";
import { SourceDetailSheet } from "@/components/country-data/SourceDetailSheet";
import { getOnboardingStatus } from "@/lib/country-onboarding/agents.functions";
import {
  backfillMissingKpis,
  listKpiCoverage,
  reverifyAllKpis,
} from "@/lib/country-onboarding/corpus.functions";
import {
  acceptKpiInference,
  acceptAllHighConfidenceInferences,
  approveSourceCandidate,
  corpusStats,
  deleteMemory,
  deleteSource,
  inferAllMissing,
  listDossiers,
  listKpis,
  listMemory,
  listMinistryProfiles,
  listSourceCandidates,
  listSources,
  overrideKpi,
  reingestSource,
  reinferKpi,
  rejectKpiInference,
  rejectSourceCandidate,
  semanticSearch,
  setMemoryVerified,
  toggleSource,
  updateKpi,
  upsertMemory,
  
} from "@/lib/country-data/manage.functions";

type TabKey = "sources" | "kpis" | "dossiers" | "ministries" | "corpus" | "memory";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "sources", label: "Sources" },
  { key: "kpis", label: "KPIs" },
  { key: "dossiers", label: "Sector dossiers" },
  { key: "ministries", label: "Ministries" },
  { key: "corpus", label: "Corpus" },
  { key: "memory", label: "Second brain" },
];

const statusQuery = (code: string) =>
  queryOptions({
    queryKey: ["onboarding", "status", code],
    queryFn: () => getOnboardingStatus({ data: { countryCode: code } }),
  });
const sourcesQuery = (code: string) =>
  queryOptions({ queryKey: ["data", code, "sources"], queryFn: () => listSources({ data: { countryCode: code } }) });
const kpisQuery = (code: string) =>
  queryOptions({ queryKey: ["data", code, "kpis"], queryFn: () => listKpis({ data: { countryCode: code } }) });
const kpiCoverageQuery = (code: string) =>
  queryOptions({ queryKey: ["data", code, "kpi-coverage"], queryFn: () => listKpiCoverage({ data: { countryCode: code } }) });
const dossiersQuery = (code: string) =>
  queryOptions({ queryKey: ["data", code, "dossiers"], queryFn: () => listDossiers({ data: { countryCode: code } }) });
const ministriesQuery = (code: string) =>
  queryOptions({ queryKey: ["data", code, "ministries"], queryFn: () => listMinistryProfiles({ data: { countryCode: code } }) });
const statsQuery = (code: string) =>
  queryOptions({ queryKey: ["data", code, "stats"], queryFn: () => corpusStats({ data: { countryCode: code } }) });
const memoryQuery = (code: string) =>
  queryOptions({ queryKey: ["data", code, "memory"], queryFn: () => listMemory({ data: { countryCode: code } }) });
const sourceCandidatesQuery = (code: string) =>
  queryOptions({ queryKey: ["data", code, "source-candidates"], queryFn: () => listSourceCandidates({ data: { countryCode: code } }) });


export const Route = createFileRoute("/_authenticated/admin/countries/$code/data")({
  head: ({ params }) => ({
    meta: [
      { title: `Data stores — ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    const status = await context.queryClient.ensureQueryData(statusQuery(params.code));
    if (!(status as any).country) throw notFound();
  },
  component: DataDashboard,
  errorComponent: ({ error }) => (
    <SuperAdminShell crumbs={[{ label: "Countries", to: "/admin/countries" }, { label: "Data" }]}>
      <p className="text-sm text-red-600">{error.message}</p>
    </SuperAdminShell>
  ),
  notFoundComponent: () => (
    <SuperAdminShell crumbs={[{ label: "Countries", to: "/admin/countries" }]}>
      <p className="text-sm">Not in the registry.</p>
    </SuperAdminShell>
  ),
});

function DataDashboard() {
  const { code } = Route.useParams();
  const { data: status } = useSuspenseQuery(statusQuery(code));
  const country: any = (status as any).country;
  const [tab, setTab] = useState<TabKey>("sources");

  return (
    <SuperAdminShell
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: country?.name ?? code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Data" },
      ]}
    >
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl">{country?.name} · Data stores</h1>
            <p className="text-sm text-ink-500 mt-1">
              Manage the ingested corpus, KPIs, dossiers, ministries, and second-brain memory that
              the AI reads when acting for {country?.name}.
            </p>
          </div>
          <Link
            to="/admin/countries/$code/onboard"
            params={{ code }}
            className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] border border-line-200 text-ink-500 hover:text-ink-950"
          >
            Back to onboarding
          </Link>
        </header>

        <nav className="flex flex-wrap gap-1 border-b border-line-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border-b-2 -mb-px ${
                tab === t.key
                  ? "border-ink-950 text-ink-950"
                  : "border-transparent text-ink-500 hover:text-ink-950"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "sources" && <SourcesTab code={code} />}
        {tab === "kpis" && <KpisTab code={code} />}
        {tab === "dossiers" && <DossiersTab code={code} />}
        {tab === "ministries" && <MinistriesTab code={code} />}
        {tab === "corpus" && <CorpusTab code={code} />}
        {tab === "memory" && <MemoryTab code={code} />}
      </div>
    </SuperAdminShell>
  );
}

// ============================================================
// Sources
// ============================================================

function SourcesTab({ code }: { code: string }) {
  const qc = useQueryClient();
  const { data: sources } = useSuspenseQuery(sourcesQuery(code));
  const toggle = useServerFn(toggleSource);
  const del = useServerFn(deleteSource);
  const reingest = useServerFn(reingestSource);
  const [running, setRunning] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["data", code] });

  async function doReingest(id: string) {
    setErr(null);
    setRunning(id);
    try {
      await reingest({ data: { id } });
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setRunning(null);
    }
  }

  const rows = sources as any[];
  const summarized = rows.filter((s) => s.summary).length;

  return (
    <section className="space-y-4">
      {err && <div className="p-2 text-xs text-red-700 border border-red-500/50 bg-red-500/10">{err}</div>}
      <div className="flex justify-between items-center">
        <div className="text-xs text-ink-500">
          {rows.length} sources · {rows.filter((s) => s.active).length} active · {summarized} with AI summary · 0 duplicates
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0"
        >
          Add source
        </button>
      </div>

      <div className="border border-line-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper-100 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            <tr className="text-left">
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2 text-center">Quality</th>
              <th className="px-3 py-2 text-center">Chunks</th>
              <th className="px-3 py-2">Last fetched</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-line-200 hover:bg-paper-100/40">
                <td className="px-3 py-2">
                  <button
                    onClick={() => setOpenId(s.id)}
                    className="text-left font-medium hover:underline"
                  >
                    {s.title}
                  </button>
                  <div className="text-xs text-ink-500">
                    {s.org} · {(() => { try { return new URL(s.url).hostname; } catch { return s.connection_kind ?? ""; } })()}
                    {s.summary ? " · AI summary" : ""}
                  </div>
                  {s.fetch_status === "error" && s.fetch_error && (
                    <div className="text-xs text-red-600 mt-1 truncate max-w-md" title={s.fetch_error}>⚠ {s.fetch_error}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{s.kind}</td>
                <td className="px-3 py-2 text-center text-xs">{"★".repeat(s.quality_score)}</td>
                <td className="px-3 py-2 text-center text-xs">{s._doc_chunks}</td>
                <td className="px-3 py-2 text-xs text-ink-500">
                  {s._doc_fetched_at ? new Date(s._doc_fetched_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      onClick={async () => { await toggle({ data: { id: s.id, active: !s.active } }); await refresh(); }}
                      className={`text-[11px] px-2 py-1 border ${s.active ? "border-emerald-500 text-emerald-700" : "border-line-200 text-ink-500"}`}
                    >
                      {s.active ? "on" : "off"}
                    </button>
                    <button
                      disabled={running === s.id || !s.active}
                      onClick={() => doReingest(s.id)}
                      className="text-[11px] px-2 py-1 border border-ink-950 disabled:opacity-40"
                    >
                      {running === s.id ? "…" : "Re-ingest"}
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete "${s.title}" and its ingested content?`)) return;
                        await del({ data: { id: s.id } });
                        await refresh();
                      }}
                      className="text-[11px] px-2 py-1 border border-red-500 text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-ink-500">No sources yet. Add one or run the Source registry stage in onboarding.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AddSourceDialog
        countryCode={code}
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onDone={refresh}
      />
      <SourceDetailSheet sourceId={openId} onClose={() => setOpenId(null)} />
    </section>
  );
}


// ============================================================
// KPIs
// ============================================================

function KpisTab({ code }: { code: string }) {
  const qc = useQueryClient();
  const { data: kpis } = useSuspenseQuery(kpisQuery(code));
  const { data: coverage } = useSuspenseQuery(kpiCoverageQuery(code));
  const { data: candidates } = useSuspenseQuery(sourceCandidatesQuery(code));
  const update = useServerFn(updateKpi);
  const backfill = useServerFn(backfillMissingKpis);
  const reverify = useServerFn(reverifyAllKpis);
  const inferAll = useServerFn(inferAllMissing);
  const acceptAllHigh = useServerFn(acceptAllHighConfidenceInferences);
  const accept = useServerFn(acceptKpiInference);
  const override = useServerFn(overrideKpi);
  const reject = useServerFn(rejectKpiInference);
  const reinfer = useServerFn(reinferKpi);
  const approveCand = useServerFn(approveSourceCandidate);
  const rejectCand = useServerFn(rejectSourceCandidate);

  const [busy, setBusy] = useState<null | "backfill" | "reverify" | "infer" | "acceptall">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<any | null>(null);

  const summary = (coverage as any).summary as {
    required_total: number;
    required_filled: number;
    required_verified: number;
    required_inferred: number;
    required_missing: number;
    registry_total: number;
    last_verified_at: string | null;
  };
  const perKpi = (coverage as any).perKpi as Array<{
    kpi_code: string;
    required: boolean;
    freshness_status: string;
    provenance: string | null;
    confidence: string | null;
    last_attempt_pass: string | null;
    last_attempt_error: string | null;
  }>;
  const statusByCode = new Map(perKpi.map((r) => [r.kpi_code, r]));

  const pendingCands = (candidates as any[]).filter((c) => c.status === "pending");

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["data", code, "kpis"] });
    await qc.invalidateQueries({ queryKey: ["data", code, "kpi-coverage"] });
    await qc.invalidateQueries({ queryKey: ["data", code, "source-candidates"] });
  };

  async function run(name: "backfill" | "reverify" | "infer" | "acceptall") {
    setErr(null); setMsg(null); setBusy(name);
    try {
      if (name === "backfill") {
        const r = await backfill({ data: { countryCode: code, staleOlderThanDays: 90 } });
        setMsg(`Backfill: ${(r as any).touched} rows · coverage ${(r as any).coverage.filled}/${(r as any).coverage.total}`);
      } else if (name === "reverify") {
        const r = await reverify({ data: { countryCode: code } });
        setMsg(`Re-verified · ${(r as any).touched} rows · coverage ${(r as any).coverage.filled}/${(r as any).coverage.total}`);
      } else if (name === "infer") {
        const r = await inferAll({ data: { countryCode: code } });
        setMsg(`Inferred ${(r as any).inferred} missing KPIs (${(r as any).failed} failed)`);
      } else {
        const r = await acceptAllHigh({ data: { countryCode: code } });
        setMsg(`Accepted ${(r as any).accepted} high-confidence inferences`);
      }
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  const byCat = new Map<string, any[]>();
  for (const k of kpis as any[]) {
    const c = k.category ?? "other";
    (byCat.get(c) ?? byCat.set(c, []).get(c)!).push(k);
  }

  const coveragePct = summary.required_total === 0 ? 0 : Math.round((summary.required_filled / summary.required_total) * 100);
  const coverageTone =
    coveragePct >= 100 ? "border-emerald-500 text-emerald-700" :
    coveragePct >= 75 ? "border-amber-500 text-amber-700" :
    "border-red-500 text-red-700";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-line-200 p-3 bg-paper-100/40">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className={`inline-block px-2 py-0.5 border text-[11px] font-mono uppercase tracking-[0.2em] ${coverageTone}`}>
            Coverage {summary.required_filled}/{summary.required_total} ({coveragePct}%)
          </span>
          <span className="inline-block px-2 py-0.5 border border-emerald-500 text-emerald-700 text-[11px] font-mono uppercase tracking-[0.2em]">
            Verified {summary.required_verified}
          </span>
          <span className="inline-block px-2 py-0.5 border border-amber-500 text-amber-700 text-[11px] font-mono uppercase tracking-[0.2em]">
            Inferred {summary.required_inferred}
          </span>
          <span className="inline-block px-2 py-0.5 border border-red-500 text-red-700 text-[11px] font-mono uppercase tracking-[0.2em]">
            Missing {summary.required_missing}
          </span>
          <span className="text-xs text-ink-500">
            Registry: {summary.registry_total} · Last verified {summary.last_verified_at ? new Date(summary.last_verified_at).toLocaleString() : "never"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy !== null} onClick={() => run("backfill")}
            className="text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 px-3 py-1.5 disabled:opacity-50">
            {busy === "backfill" ? "Backfilling…" : "Backfill missing"}
          </button>
          <button disabled={busy !== null} onClick={() => run("infer")}
            className="text-[11px] font-mono uppercase tracking-[0.2em] border border-amber-600 text-amber-700 px-3 py-1.5 disabled:opacity-50">
            {busy === "infer" ? "Inferring…" : "Infer all missing"}
          </button>
          <button disabled={busy !== null} onClick={() => run("acceptall")}
            className="text-[11px] font-mono uppercase tracking-[0.2em] border border-emerald-600 text-emerald-700 px-3 py-1.5 disabled:opacity-50">
            {busy === "acceptall" ? "Accepting…" : "Accept all high-confidence"}
          </button>
          <button disabled={busy !== null} onClick={() => run("reverify")}
            className="text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 px-3 py-1.5 disabled:opacity-50">
            {busy === "reverify" ? "Re-verifying…" : "Re-verify all"}
          </button>
        </div>
      </div>
      {msg && <div className="p-2 text-xs text-emerald-700 border border-emerald-500/50 bg-emerald-500/10">{msg}</div>}
      {err && <div className="p-2 text-xs text-red-700 border border-red-500/50 bg-red-500/10">{err}</div>}

      {pendingCands.length > 0 && (
        <div className="border border-amber-500/50 bg-amber-500/5 p-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-700 mb-2">
            {pendingCands.length} suggested source{pendingCands.length === 1 ? "" : "s"} awaiting approval
          </div>
          <ul className="space-y-1">
            {pendingCands.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline truncate block">{c.url}</a>
                  <div className="text-ink-500">suggested for {c.suggested_for_kpi} · {c.suggested_by_model}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={async () => { await approveCand({ data: { id: c.id } }); await refresh(); }}
                    className="text-[10px] px-2 py-1 border border-emerald-500 text-emerald-700">Approve</button>
                  <button onClick={async () => { await rejectCand({ data: { id: c.id } }); await refresh(); }}
                    className="text-[10px] px-2 py-1 border border-line-200 text-ink-500">Dismiss</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {[...byCat.entries()].map(([cat, rows]) => (
        <div key={cat}>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 mb-2">{cat}</h3>
          <div className="border border-line-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper-100 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 text-left">
                <tr>
                  <th className="px-3 py-2">KPI</th>
                  <th className="px-3 py-2">Latest</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((k) => (
                  <KpiRow
                    key={k.id}
                    k={k}
                    status={statusByCode.get(k.kpi_code)}
                    onSave={async (patch) => {
                      await update({ data: { id: k.id, ...patch } });
                      await refresh();
                    }}
                    onOpenInference={() => setDrawer(k)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {(kpis as any[]).length === 0 && <p className="text-sm text-ink-500">No KPIs yet — run the KPI seed stage in onboarding, or click Backfill missing / Infer all missing.</p>}

      {drawer && (
        <InferenceDrawer
          kpi={drawer}
          onClose={() => setDrawer(null)}
          onAccept={async (note) => { await accept({ data: { id: drawer.id, note } }); setDrawer(null); await refresh(); }}
          onOverride={async (value, period, note) => { await override({ data: { id: drawer.id, latest_value: value, latest_period: period, note } }); setDrawer(null); await refresh(); }}
          onReject={async (note) => { await reject({ data: { id: drawer.id, note } }); setDrawer(null); await refresh(); }}
          onReinfer={async () => { await reinfer({ data: { id: drawer.id } }); await refresh(); const fresh = (await qc.getQueryData<any[]>(["data", code, "kpis"])) ?? []; const upd = fresh.find((x) => x.id === drawer.id); if (upd) setDrawer(upd); }}
        />
      )}
    </section>
  );
}

function KpiRow({
  k,
  status,
  onSave,
  onOpenInference,
}: {
  k: any;
  status?: { freshness_status: string; provenance: string | null; confidence: string | null; last_attempt_pass: string | null; last_attempt_error: string | null };
  onSave: (patch: any) => Promise<void>;
  onOpenInference: () => void;
}) {
  const [latest, setLatest] = useState<string>(k.latest_value ?? "");
  const [period, setPeriod] = useState<string>(k.latest_period ?? "");
  const [target, setTarget] = useState<string>(k.target ?? "");
  const dirty =
    String(latest) !== String(k.latest_value ?? "") ||
    period !== (k.latest_period ?? "") ||
    String(target) !== String(k.target ?? "");
  const prov = k.provenance ?? status?.provenance ?? "verified";
  const isInferred = prov === "inferred";
  const isAdminVerified = prov === "admin_verified" || prov === "admin_override";
  const s = status?.freshness_status ?? (k.latest_value == null ? "missing" : "fresh");

  const statusLabel = isInferred ? "inferred" : s;
  const tone =
    isInferred ? "border-amber-500 text-amber-700" :
    isAdminVerified ? "border-emerald-600 text-emerald-800" :
    s === "fresh" ? "border-emerald-500 text-emerald-700" :
    s === "stale" ? "border-amber-500 text-amber-700" :
    "border-red-500 text-red-700";

  return (
    <tr className="border-t border-line-200">
      <td className="px-3 py-2">
        <div className="font-medium">{k.label}</div>
        <div className="text-xs text-ink-500">{k.kpi_code}</div>
      </td>
      <td className="px-3 py-2">
        <input value={latest} onChange={(e) => setLatest(e.target.value)} className="w-24 border border-line-200 px-2 py-1 text-sm bg-paper-0" />
      </td>
      <td className="px-3 py-2">
        <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2024" className="w-20 border border-line-200 px-2 py-1 text-sm bg-paper-0" />
      </td>
      <td className="px-3 py-2">
        <input value={target} onChange={(e) => setTarget(e.target.value)} className="w-24 border border-line-200 px-2 py-1 text-sm bg-paper-0" />
      </td>
      <td className="px-3 py-2 text-xs">{k.unit}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <span className={`inline-block px-2 py-0.5 border text-[10px] font-mono uppercase tracking-widest ${tone}`}>{statusLabel}</span>
          {isInferred && (
            <button
              onClick={onOpenInference}
              title="View rationale"
              className="text-[10px] px-1.5 py-0.5 border border-amber-500 text-amber-700 hover:bg-amber-500/10"
            >
              ⓘ{k.confidence ? ` ${k.confidence}` : ""}
            </button>
          )}
          {isAdminVerified && (
            <span className="text-[10px] text-emerald-700" title={prov === "admin_override" ? "Admin overrode value" : "Admin accepted"}>
              ✓ admin
            </span>
          )}
        </div>
        {s !== "fresh" && !isInferred && status?.last_attempt_error && (
          <div className="mt-1 text-[10px] text-ink-500 truncate max-w-[240px]" title={status.last_attempt_error}>
            last {status.last_attempt_pass ?? "attempt"}: {status.last_attempt_error}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        {k.country_sources?.url ? (
          <a href={k.country_sources.url} target="_blank" rel="noreferrer" className="hover:underline">{k.country_sources.org}</a>
        ) : isInferred ? (
          <span className="text-amber-700">AI estimate</span>
        ) : "—"}
        {dirty && (
          <button
            onClick={() =>
              onSave({
                latest_value: latest === "" ? null : Number(latest),
                latest_period: period || null,
                target: target === "" ? null : Number(target),
              })
            }
            className="ml-2 text-[10px] px-2 py-0.5 border border-ink-950 bg-ink-950 text-paper-0"
          >
            save
          </button>
        )}
      </td>
    </tr>
  );
}

function InferenceDrawer({
  kpi,
  onClose,
  onAccept,
  onOverride,
  onReject,
  onReinfer,
}: {
  kpi: any;
  onClose: () => void;
  onAccept: (note?: string) => Promise<void>;
  onOverride: (value: number, period: string | null, note?: string) => Promise<void>;
  onReject: (note?: string) => Promise<void>;
  onReinfer: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [overrideVal, setOverrideVal] = useState<string>(kpi.latest_value ?? "");
  const [overridePeriod, setOverridePeriod] = useState<string>(kpi.latest_period ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ev = (kpi.inference_evidence ?? {}) as { assumptions?: string[]; evidence?: Array<{ kind: string; ref: string; note: string; url?: string }> };
  const history = Array.isArray(kpi.inference_history) ? kpi.inference_history : [];

  const wrap = (name: string, fn: () => Promise<void>) => async () => {
    setErr(null); setBusy(name);
    try { await fn(); } catch (e: any) { setErr(e?.message ?? String(e)); } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-950/40" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full bg-paper-0 border-l border-line-200 overflow-y-auto">
        <div className="sticky top-0 flex justify-between items-center px-6 py-4 border-b border-line-200 bg-paper-0">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-700">Inferred KPI</div>
            <h2 className="font-serif text-xl">{kpi.label}</h2>
            <div className="text-xs text-ink-500">{kpi.kpi_code} · {kpi.unit}</div>
          </div>
          <button onClick={onClose} className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">Close</button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-line-200 p-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Estimated value</div>
              <div className="font-serif text-3xl mt-1">{kpi.latest_value ?? "—"}</div>
              <div className="text-xs text-ink-500 mt-1">{kpi.latest_period ?? "no period"}</div>
            </div>
            <div className="border border-line-200 p-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Confidence</div>
              <div className="font-serif text-3xl mt-1 text-amber-700">{kpi.confidence ?? "?"}</div>
              <div className="text-xs text-ink-500 mt-1 truncate" title={kpi.inference_model ?? ""}>{kpi.inference_model ?? "—"}</div>
            </div>
          </div>

          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">Rationale</h3>
            <p className="text-sm whitespace-pre-wrap">{kpi.inference_rationale ?? "(no rationale recorded)"}</p>
          </section>

          {ev.assumptions && ev.assumptions.length > 0 && (
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">Assumptions</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {ev.assumptions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </section>
          )}

          {ev.evidence && ev.evidence.length > 0 && (
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">Evidence used</h3>
              <ul className="space-y-2">
                {ev.evidence.map((e, i) => (
                  <li key={i} className="border border-line-200 p-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{e.kind}</span>
                      <span className="text-ink-500">{e.ref}</span>
                    </div>
                    <div className="mt-1">{e.note}</div>
                    {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="text-ink-500 hover:underline truncate block">{e.url}</a>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {history.length > 0 && (
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">Prior inferences ({history.length})</h3>
              <ul className="space-y-1 text-xs text-ink-500">
                {history.slice(-5).reverse().map((h: any, i: number) => (
                  <li key={i}>{h.value} · {h.model} · {h.inferred_at ? new Date(h.inferred_at).toLocaleDateString() : "?"}</li>
                ))}
              </ul>
            </section>
          )}

          {err && <div className="p-2 text-xs text-red-700 border border-red-500/50 bg-red-500/10">{err}</div>}

          <section className="border-t border-line-200 pt-4 space-y-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Admin note (optional)"
              className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0 min-h-[60px]"
            />
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy !== null}
                onClick={wrap("accept", () => onAccept(note || undefined))}
                className="text-[11px] font-mono uppercase tracking-[0.2em] border border-emerald-600 text-emerald-700 px-3 py-1.5 disabled:opacity-50"
              >
                {busy === "accept" ? "…" : "Accept as verified"}
              </button>
              <button
                disabled={busy !== null}
                onClick={wrap("reinfer", onReinfer)}
                className="text-[11px] font-mono uppercase tracking-[0.2em] border border-amber-600 text-amber-700 px-3 py-1.5 disabled:opacity-50"
              >
                {busy === "reinfer" ? "…" : "Re-infer"}
              </button>
              <button
                disabled={busy !== null}
                onClick={wrap("reject", () => onReject(note || undefined))}
                className="text-[11px] font-mono uppercase tracking-[0.2em] border border-red-500 text-red-700 px-3 py-1.5 disabled:opacity-50"
              >
                {busy === "reject" ? "…" : "Reject (mark missing)"}
              </button>
            </div>

            <div className="border-t border-line-200 pt-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">Override value</div>
              <div className="flex gap-2">
                <input value={overrideVal} onChange={(e) => setOverrideVal(e.target.value)} placeholder="value" className="w-32 border border-line-200 px-2 py-1 text-sm bg-paper-0" />
                <input value={overridePeriod} onChange={(e) => setOverridePeriod(e.target.value)} placeholder="period" className="w-24 border border-line-200 px-2 py-1 text-sm bg-paper-0" />
                <button
                  disabled={busy !== null || overrideVal === "" || Number.isNaN(Number(overrideVal))}
                  onClick={wrap("override", () => onOverride(Number(overrideVal), overridePeriod || null, note || undefined))}
                  className="text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 px-3 py-1.5 disabled:opacity-50"
                >
                  {busy === "override" ? "…" : "Save override"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// Dossiers
// ============================================================

function DossiersTab({ code }: { code: string }) {
  const { data: dossiers } = useSuspenseQuery(dossiersQuery(code));
  const bySector = new Map<string, any[]>();
  for (const d of dossiers as any[]) {
    (bySector.get(d.sector_code) ?? bySector.set(d.sector_code, []).get(d.sector_code)!).push(d);
  }
  if ((dossiers as any[]).length === 0) return <p className="text-sm text-ink-500">No dossiers yet.</p>;
  return (
    <section className="space-y-4">
      {[...bySector.entries()].map(([sector, rows]) => (
        <details key={sector} className="border border-line-200 p-3">
          <summary className="cursor-pointer font-medium">{sector} <span className="text-xs text-ink-500">({rows.length})</span></summary>
          <div className="mt-3 space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="border border-line-200 p-3">
                <div className="flex justify-between text-xs text-ink-500 mb-2">
                  <span>{r.kind}</span>
                  <span>confidence: {r.confidence} · {r.source_ids?.length ?? 0} sources</span>
                </div>
                <pre className="text-xs whitespace-pre-wrap max-h-64 overflow-y-auto">{JSON.stringify(r.payload, null, 2)}</pre>
              </div>
            ))}
          </div>
        </details>
      ))}
    </section>
  );
}

// ============================================================
// Ministries
// ============================================================

function MinistriesTab({ code }: { code: string }) {
  const { data: rows } = useSuspenseQuery(ministriesQuery(code));
  if ((rows as any[]).length === 0) return <p className="text-sm text-ink-500">No ministry profiles yet.</p>;
  return (
    <section className="space-y-3">
      {(rows as any[]).map((r) => (
        <div key={r.id} className="border border-line-200 p-4">
          <div className="flex justify-between">
            <div>
              <h3 className="font-medium">{r.ministries?.name ?? r.ministry_slug}</h3>
              <div className="text-xs text-ink-500">{r.minister ?? "—"}</div>
            </div>
            <div className="text-xs text-ink-500">{(r.programmes as any[])?.length ?? 0} programmes · {r.source_ids?.length ?? 0} sources</div>
          </div>
          {r.mandate && <p className="mt-2 text-sm">{r.mandate}</p>}
          {Array.isArray(r.programmes) && r.programmes.length > 0 && (
            <ul className="mt-2 text-xs list-disc pl-5 text-ink-500 space-y-1">
              {(r.programmes as any[]).map((p, i) => (
                <li key={i}>
                  <span className="text-ink-950">{p.name ?? p.title ?? "(untitled)"}</span>
                  {p.description && <> — {p.description}</>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

// ============================================================
// Corpus + semantic search
// ============================================================

function CorpusTab({ code }: { code: string }) {
  const { data: stats } = useSuspenseQuery(statsQuery(code));
  const search = useServerFn(semanticSearch);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const s = stats as any;
  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Sources" value={s.sources_total} />
        <Stat label="Active" value={s.sources_active} />
        <Stat label="Documents" value={s.documents} />
        <Stat label="Chunks" value={s.chunks} />
        <Stat label="Last ingest" value={s.last_ingest_at ? new Date(s.last_ingest_at).toLocaleDateString() : "—"} />
      </div>

      <div>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 mb-2">Retrieval sanity check</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!q) return;
            setBusy(true); setErr(null);
            try {
              const rows = await search({ data: { countryCode: code, query: q, k: 8 } });
              setHits(rows as any[]);
            } catch (e: any) {
              setErr(e?.message ?? String(e));
            } finally {
              setBusy(false);
            }
          }}
          className="flex gap-2"
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question the AI should be able to answer…" className="flex-1 border border-line-200 px-3 py-2 text-sm bg-paper-0" />
          <button disabled={busy || !q} className="px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50">
            {busy ? "Searching…" : "Search"}
          </button>
        </form>
        {err && <div className="mt-2 p-2 text-xs text-red-700 border border-red-500/50 bg-red-500/10">{err}</div>}
        {hits && (
          <ul className="mt-3 space-y-2">
            {hits.length === 0 && <li className="text-xs text-ink-500">No matches. Ingest more sources.</li>}
            {hits.map((h) => (
              <li key={h.id} className="border border-line-200 p-3 text-sm">
                <div className="flex justify-between text-xs text-ink-500 mb-1">
                  <a href={h.source_url} target="_blank" rel="noreferrer" className="hover:underline">{h.source_org} · {h.source_title}</a>
                  <span>distance {h.distance?.toFixed(3)}</span>
                </div>
                <div className="whitespace-pre-wrap line-clamp-4 text-ink-950">{h.content}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="border border-line-200 p-3">
      <div className="font-serif text-2xl" data-numeric>{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 mt-1">{label}</div>
    </div>
  );
}

// ============================================================
// Second brain memory
// ============================================================

function MemoryTab({ code }: { code: string }) {
  const qc = useQueryClient();
  const { data: rows } = useSuspenseQuery(memoryQuery(code));
  const upsert = useServerFn(upsertMemory);
  const setV = useServerFn(setMemoryVerified);
  const del = useServerFn(deleteMemory);
  const [showAdd, setShowAdd] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["data", code, "memory"] });

  return (
    <section className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-xs text-ink-500">
          {(rows as any[]).length} memory objects · {(rows as any[]).filter((r) => r.verified).length} verified
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0">
          {showAdd ? "Cancel" : "Add memory"}
        </button>
      </div>
      {showAdd && (
        <AddMemoryForm onSubmit={async (v) => { await upsert({ data: { countryCode: code, ...v } }); setShowAdd(false); await refresh(); }} />
      )}
      <div className="space-y-2">
        {(rows as any[]).map((r) => (
          <div key={r.id} className={`border p-3 ${r.verified ? "border-emerald-500/50" : "border-line-200"}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-ink-500">{r.kind} · sector {r.sector_code} · scope {r.scope_key} · weight {r.weight}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={async () => { await setV({ data: { id: r.id, verified: !r.verified } }); await refresh(); }}
                  className={`text-[11px] px-2 py-1 border ${r.verified ? "border-emerald-500 text-emerald-700" : "border-line-200 text-ink-500"}`}>
                  {r.verified ? "verified" : "unverified"}
                </button>
                <button onClick={async () => { if (confirm("Delete memory?")) { await del({ data: { id: r.id } }); await refresh(); } }}
                  className="text-[11px] px-2 py-1 border border-red-500 text-red-700">Delete</button>
              </div>
            </div>
            {r.payload?.body && <p className="mt-2 text-sm whitespace-pre-wrap">{r.payload.body}</p>}
          </div>
        ))}
        {(rows as any[]).length === 0 && <p className="text-sm text-ink-500">No memory objects yet.</p>}
      </div>
    </section>
  );
}

function AddMemoryForm({ onSubmit }: { onSubmit: (v: { sector_code: string; kind: string; title: string; body: string; weight: number; verified: boolean }) => Promise<void> }) {
  const [sector, setSector] = useState("cross_cutting");
  const [kind, setKind] = useState("position");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [weight, setWeight] = useState(3);
  const [busy, setBusy] = useState(false);
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit({ sector_code: sector, kind, title, body, weight, verified: false }); setTitle(""); setBody(""); } finally { setBusy(false); } }}
      className="grid grid-cols-1 md:grid-cols-4 gap-2 border border-line-200 p-3 bg-paper-100/40">
      <input required placeholder="Sector code" value={sector} onChange={(e) => setSector(e.target.value)} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      <select value={kind} onChange={(e) => setKind(e.target.value)} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0">
        {["position", "audience", "outlet", "fact", "risk"].map((k) => <option key={k}>{k}</option>)}
      </select>
      <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="md:col-span-2 border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      <textarea required placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} className="md:col-span-3 border border-line-200 px-2 py-1.5 text-sm bg-paper-0 min-h-[80px]" />
      <select value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0">
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>weight {n}</option>)}
      </select>
      <button disabled={busy} className="md:col-span-4 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50">
        {busy ? "Saving…" : "Add memory"}
      </button>
    </form>
  );
}
