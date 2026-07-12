import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { AddSourceDialog } from "@/components/country-data/AddSourceDialog";
import { SourceDetailSheet } from "@/components/country-data/SourceDetailSheet";
import { PrettyJson } from "@/components/data/PrettyJson";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { getOnboardingStatus } from "@/lib/country-onboarding/agents.functions";
import {
  backfillMissingKpis,
  commitMinistryDeepDive,
  listKpiCoverage,
  reverifyAllKpis,
  runMinistryDeepDiveAgent,
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
  updateMinisterProfile,
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
  const fmt2 = (v: any) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? "" : Number(v).toFixed(2));
  const [latest, setLatest] = useState<string>(fmt2(k.latest_value));
  const [period, setPeriod] = useState<string>(k.latest_period ?? "");
  const [target, setTarget] = useState<string>(fmt2(k.target));
  const dirty =
    latest !== fmt2(k.latest_value) ||
    period !== (k.latest_period ?? "") ||
    target !== fmt2(k.target);
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
        <input inputMode="decimal" step="0.01" type="number" value={latest} onChange={(e) => setLatest(e.target.value)} onBlur={(e) => setLatest(fmt2(e.target.value))} className="w-24 border border-line-200 px-2 py-1 text-sm bg-paper-0 text-right tabular-nums" />
      </td>
      <td className="px-3 py-2">
        <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2024" className="w-20 border border-line-200 px-2 py-1 text-sm bg-paper-0" />
      </td>
      <td className="px-3 py-2">
        <input inputMode="decimal" step="0.01" type="number" value={target} onChange={(e) => setTarget(e.target.value)} onBlur={(e) => setTarget(fmt2(e.target.value))} className="w-24 border border-line-200 px-2 py-1 text-sm bg-paper-0 text-right tabular-nums" />
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
                latest_value: latest === "" ? null : Number(Number(latest).toFixed(2)),
                latest_period: period || null,
                target: target === "" ? null : Number(Number(target).toFixed(2)),
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
  const fmt2 = (v: any) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? "" : Number(v).toFixed(2));
  const [note, setNote] = useState("");
  const [overrideVal, setOverrideVal] = useState<string>(fmt2(kpi.latest_value));
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
              <div className="font-serif text-3xl mt-1 tabular-nums">{fmt2(kpi.latest_value) || "—"}</div>
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
                  <li key={i}>{fmt2(h.value) || h.value} · {h.model} · {h.inferred_at ? new Date(h.inferred_at).toLocaleDateString() : "?"}</li>
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
                <input inputMode="decimal" step="0.01" type="number" value={overrideVal} onChange={(e) => setOverrideVal(e.target.value)} onBlur={(e) => setOverrideVal(fmt2(e.target.value))} placeholder="value" className="w-32 border border-line-200 px-2 py-1 text-sm bg-paper-0 text-right tabular-nums" />
                <input value={overridePeriod} onChange={(e) => setOverridePeriod(e.target.value)} placeholder="period" className="w-24 border border-line-200 px-2 py-1 text-sm bg-paper-0" />
                <button
                  disabled={busy !== null || overrideVal === "" || Number.isNaN(Number(overrideVal))}
                  onClick={wrap("override", () => onOverride(Number(Number(overrideVal).toFixed(2)), overridePeriod || null, note || undefined))}
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
  const KIND_LABELS: Record<string, string> = {
    comms: "Communications",
    oecs: "OECS Peer Position",
    policy: "Policy Landscape",
  };
  const [openSector, setOpenSector] = useState<string | null>(
    () => [...bySector.keys()][0] ?? null,
  );
  return (
    <section className="space-y-4">
      {[...bySector.entries()].map(([sector, rows]) => {
        const isOpen = openSector === sector;
        return (
          <div key={sector} className="border border-line-200 p-3">
            <button
              type="button"
              onClick={() => setOpenSector(isOpen ? null : sector)}
              className="w-full flex items-center gap-2 text-left cursor-pointer font-medium"
              aria-expanded={isOpen}
            >
              <span className="text-ink-500 text-xs w-3">{isOpen ? "▼" : "▶"}</span>
              <span>{sector}</span>
              <span className="text-xs text-ink-500">({rows.length})</span>
            </button>
            {isOpen && (
              <div className="mt-3 space-y-4">
                {rows.map((r) => (
                  <article key={r.id} className="border border-line-200 p-4">
                    <header className="flex justify-between items-baseline mb-3 pb-2 border-b border-line-200">
                      <h3 className="font-serif text-lg">{KIND_LABELS[r.kind] ?? r.kind}</h3>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-ink-500">
                        confidence: {r.confidence} · {r.source_ids?.length ?? 0} sources
                      </div>
                    </header>
                    <PrettyJson value={r.payload} citations={(r.citations ?? []) as any} />
                  </article>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

// ============================================================
// Ministries
// ============================================================

function MinistriesTab({ code }: { code: string }) {
  const { data: rows } = useSuspenseQuery(ministriesQuery(code));
  const [editing, setEditing] = useState<any | null>(null);
  const [refresh, setRefresh] = useState<
    | { phase: "idle" }
    | { phase: "running" }
    | { phase: "ready"; draftId: string; count: number; citations: any[]; payload: any }
    | { phase: "error"; message: string }
  >({ phase: "idle" });
  const runAgent = useServerFn(runMinistryDeepDiveAgent);
  const commitAgent = useServerFn(commitMinistryDeepDive);
  const qc = useQueryClient();
  const [committing, setCommitting] = useState(false);

  const onRefresh = async () => {
    setRefresh({ phase: "running" });
    try {
      const res: any = await runAgent({ data: { countryCode: code } });
      // Fetch the draft payload so we can preview it
      const { data: draft, error } = await (await import("@/integrations/supabase/client")).supabase
        .from("onboarding_drafts").select("payload").eq("id", res.draftId).single();
      if (error) throw error;
      setRefresh({
        phase: "ready",
        draftId: res.draftId,
        count: res.count,
        citations: res.citations ?? [],
        payload: draft?.payload ?? { ministries: [] },
      });
    } catch (e: any) {
      setRefresh({ phase: "error", message: e?.message ?? "Failed" });
    }
  };

  const onCommit = async (draftId: string) => {
    setCommitting(true);
    try {
      await commitAgent({ data: { draftId } });
      await qc.invalidateQueries({ queryKey: ["data", code, "ministries"] });
      setRefresh({ phase: "idle" });
    } catch (e: any) {
      setRefresh({ phase: "error", message: e?.message ?? "Commit failed" });
    } finally {
      setCommitting(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-ink-500">
          {refresh.phase === "running" && "Researching ministries…"}
          {refresh.phase === "ready" && `Draft ready · ${refresh.count} ministries · ${refresh.citations.length} citations`}
          {refresh.phase === "error" && <span className="text-red-600">{refresh.message}</span>}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refresh.phase === "running"}
        >
          {refresh.phase === "running" ? "Researching…" : "Refresh from AI"}
        </Button>
      </div>

      {(rows as any[]).length === 0 ? (
        <p className="text-sm text-ink-500">No ministry profiles yet.</p>
      ) : (
        (rows as any[]).map((r) => (
          <MinistryCard key={r.id} row={r} onEdit={() => setEditing(r)} />
        ))
      )}

      {editing && (
        <MinisterEditDialog row={editing} countryCode={code} onClose={() => setEditing(null)} />
      )}

      {refresh.phase === "ready" && (
        <MinistryReviewDialog
          rows={rows as any[]}
          draft={refresh}
          committing={committing}
          onCommit={() => onCommit(refresh.draftId)}
          onCancel={() => setRefresh({ phase: "idle" })}
        />
      )}
    </section>
  );
}

function MinistryReviewDialog({
  rows, draft, committing, onCommit, onCancel,
}: {
  rows: any[];
  draft: { draftId: string; count: number; citations: any[]; payload: any };
  committing: boolean;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const bySlug = new Map(rows.map((r) => [r.ministry_slug, r]));
  const entries: any[] = draft.payload?.ministries ?? [];
  const diffs = entries.map((entry) => {
    const current = bySlug.get(entry.ministry_slug) as any;
    return { entry, current, diff: diffMinistry(current, entry) };
  });
  const changed = diffs.filter((d) => d.diff.changed);
  const newMinisters = diffs.filter((d) => {
    const before = d.current?.minister_profile?.name ?? d.current?.minister ?? null;
    const after = d.entry?.minister_profile?.name ?? d.entry?.minister ?? null;
    return !before && !!after;
  }).length;
  const newContacts = diffs.filter((d) => {
    const b = d.current?.minister_profile?.contact ?? {};
    const a = d.entry?.minister_profile?.contact ?? {};
    return ["email", "office_phone", "office_address", "website"].some((k) => !b?.[k] && !!a?.[k]);
  }).length;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-5 border-b border-line-200">
          <DialogTitle className="font-serif text-lg">Review ministry refresh</DialogTitle>
          <DialogDescription className="text-xs text-ink-500">
            Committing overwrites minister profile, mandate, programmes, and citations for each ministry below. Existing rows not in the draft are untouched.
          </DialogDescription>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <span><b className="text-ink-950 tabular-nums">{changed.length}</b> <span className="text-ink-500">of {diffs.length} ministries changed</span></span>
            <span><b className="text-ink-950 tabular-nums">{newMinisters}</b> <span className="text-ink-500">new minister names</span></span>
            <span><b className="text-ink-950 tabular-nums">{newContacts}</b> <span className="text-ink-500">new contact records</span></span>
            <span><b className="text-ink-950 tabular-nums">{draft.citations.length}</b> <span className="text-ink-500">citations attached</span></span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {diffs.map(({ entry, current, diff }, i) => (
            <MinistryDiffCard key={i} entry={entry} current={current} diff={diff} />
          ))}
        </div>

        <DialogFooter className="p-4 border-t border-line-200 gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={committing}>Cancel</Button>
          <Button size="sm" onClick={onCommit} disabled={committing}>
            {committing ? "Committing…" : `Commit refresh · ${changed.length} changed`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DiffRow = { label: string; before: any; after: any; changed: boolean; kind?: "text" | "image" | "long" | "programmes" };

function diffMinistry(current: any, entry: any): { changed: boolean; rows: DiffRow[]; progChanged: boolean } {
  const cp = current?.minister_profile ?? {};
  const np = entry?.minister_profile ?? {};
  const cc = cp?.contact ?? {};
  const nc = np?.contact ?? {};
  const rows: DiffRow[] = [
    { label: "Minister",  before: cp.name ?? current?.minister ?? "", after: np.name ?? entry?.minister ?? "", changed: false, kind: "text" },
    { label: "Title",     before: cp.title ?? "",        after: np.title ?? "",        changed: false, kind: "text" },
    { label: "Party",     before: cp.party ?? "",        after: np.party ?? "",        changed: false, kind: "text" },
    { label: "Appointed", before: cp.appointed_at ?? "", after: np.appointed_at ?? "", changed: false, kind: "text" },
    { label: "Portrait",  before: cp.portrait_url ?? "", after: np.portrait_url ?? "", changed: false, kind: "image" },
    { label: "Email",     before: cc.email ?? "",        after: nc.email ?? "",        changed: false, kind: "text" },
    { label: "Phone",     before: cc.office_phone ?? "", after: nc.office_phone ?? "", changed: false, kind: "text" },
    { label: "Website",   before: cc.website ?? "",      after: nc.website ?? "",      changed: false, kind: "text" },
    { label: "Bio",       before: cp.bio ?? "",          after: np.bio ?? "",          changed: false, kind: "long" },
    { label: "Mandate",   before: current?.mandate ?? "", after: entry?.mandate ?? "", changed: false, kind: "long" },
  ];
  for (const r of rows) r.changed = String(r.before ?? "") !== String(r.after ?? "");
  const beforeProgs = Array.isArray(current?.programmes) ? current.programmes : [];
  const afterProgs = Array.isArray(entry?.programmes) ? entry.programmes : [];
  const progChanged = JSON.stringify(beforeProgs) !== JSON.stringify(afterProgs);
  rows.push({ label: "Programmes", before: beforeProgs, after: afterProgs, changed: progChanged, kind: "programmes" });
  return { changed: rows.some((r) => r.changed), rows, progChanged };
}

function MinistryDiffCard({ entry, current, diff }: { entry: any; current: any; diff: ReturnType<typeof diffMinistry> }) {
  const title = current?.ministries?.name ?? entry.ministry_slug;
  const [showAllBio, setShowAllBio] = useState(false);
  const [showAllMandate, setShowAllMandate] = useState(false);
  const [showProgs, setShowProgs] = useState(false);

  if (!diff.changed) {
    return (
      <div className="border border-line-200 px-3 py-2 text-xs text-ink-400 flex justify-between">
        <span>{title}</span>
        <span>no changes</span>
      </div>
    );
  }

  const changeSummary = [
    diff.rows.find((r) => r.label === "Minister")?.changed && "minister changed",
    diff.progChanged && `${(diff.rows.find((r) => r.label === "Programmes")?.before as any[]).length} → ${(diff.rows.find((r) => r.label === "Programmes")?.after as any[]).length} programmes`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="border border-line-200">
      <div className="flex justify-between items-baseline px-3 py-2 border-b border-line-200 bg-paper-100/40">
        <h4 className="font-medium text-sm">{title}</h4>
        <span className="text-[11px] text-ink-500">{changeSummary}</span>
      </div>
      <div className="divide-y divide-line-100">
        {diff.rows.map((r) => (
          <div key={r.label} className={`grid grid-cols-[90px_1fr_16px_1fr] gap-2 items-start px-3 py-1.5 text-xs ${r.changed ? "" : "opacity-50"}`}>
            <div className="text-ink-500 uppercase text-[10px] tracking-wide pt-0.5">{r.label}</div>
            <DiffCell value={r.before} kind={r.kind} expanded={r.label === "Bio" ? showAllBio : r.label === "Mandate" ? showAllMandate : r.label === "Programmes" ? showProgs : false} onToggle={() => {
              if (r.label === "Bio") setShowAllBio((v) => !v);
              else if (r.label === "Mandate") setShowAllMandate((v) => !v);
              else if (r.label === "Programmes") setShowProgs((v) => !v);
            }} tone="before" />
            <div className="text-ink-400 pt-0.5">→</div>
            <DiffCell value={r.after} kind={r.kind} expanded={r.label === "Bio" ? showAllBio : r.label === "Mandate" ? showAllMandate : r.label === "Programmes" ? showProgs : false} onToggle={() => {
              if (r.label === "Bio") setShowAllBio((v) => !v);
              else if (r.label === "Mandate") setShowAllMandate((v) => !v);
              else if (r.label === "Programmes") setShowProgs((v) => !v);
            }} tone={r.changed ? "after-changed" : "after"} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DiffCell({ value, kind, expanded, onToggle, tone }: { value: any; kind?: string; expanded: boolean; onToggle: () => void; tone: "before" | "after" | "after-changed" }) {
  const empty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
  const bg = tone === "after-changed" ? "bg-emerald-50/60 text-ink-950" : "";
  const text = empty ? "text-ink-300" : "text-ink-700";
  if (empty) return <div className={`px-1 py-0.5 ${bg} ${text}`}>—</div>;

  if (kind === "image") {
    return <img src={String(value)} alt="" className={`h-10 w-8 object-cover border border-line-200 ${bg}`} />;
  }
  if (kind === "long") {
    const str = String(value);
    const truncated = !expanded && str.length > 140;
    return (
      <div className={`px-1 py-0.5 ${bg} ${text}`}>
        <div>{truncated ? str.slice(0, 140) + "…" : str}</div>
        {str.length > 140 && (
          <button onClick={onToggle} className="text-[10px] text-ink-500 underline underline-offset-2 mt-0.5">
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    );
  }
  if (kind === "programmes") {
    const list = value as any[];
    return (
      <div className={`px-1 py-0.5 ${bg} ${text}`}>
        <button onClick={onToggle} className="underline underline-offset-2">
          {list.length} item{list.length === 1 ? "" : "s"} {expanded ? "▾" : "▸"}
        </button>
        {expanded && (
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {list.map((p, i) => (
              <li key={i}><span className="text-ink-950">{p.name ?? p.title ?? "(untitled)"}</span>{p.status && <span className="ml-1 text-[10px] uppercase text-ink-400">{p.status}</span>}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return <div className={`px-1 py-0.5 ${bg} ${text} break-words`}>{String(value)}</div>;
}




function MinistryCard({ row, onEdit }: { row: any; onEdit: () => void }) {
  const mp = (row.minister_profile ?? {}) as any;
  const hasProfile = Boolean(mp.name || row.minister);
  const initials = (mp.name ?? row.minister ?? "?")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((s: string) => s[0]).join("").toUpperCase();
  const [expanded, setExpanded] = useState(false);
  const contact = mp.contact ?? {};
  const socials = mp.socials ?? {};
  return (
    <div className="border border-line-200 p-4">
      <div className="flex justify-between gap-4">
        <h3 className="font-serif text-lg">{row.ministries?.name ?? row.ministry_slug}</h3>
        <div className="text-xs text-ink-500 shrink-0">
          {(row.programmes as any[])?.length ?? 0} programmes · {row.source_ids?.length ?? 0} sources
        </div>
      </div>

      <div className="mt-3 border border-line-200 bg-cream-50/40 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            {mp.portrait_url ? (
              <img src={mp.portrait_url} alt={mp.name ?? "Minister"} className="h-14 w-11 object-cover border border-line-200" />
            ) : (
              <div className="h-14 w-11 flex items-center justify-center border border-line-200 bg-cream-100 text-xs text-ink-500">
                {hasProfile ? initials : "—"}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-medium text-ink-950">{mp.name ?? row.minister ?? "Minister not recorded"}</div>
              {mp.title && <div className="text-xs text-ink-500">{mp.title}</div>}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {mp.party && <span className="border border-line-200 px-1.5 py-0.5 text-ink-700">{mp.party}</span>}
                {mp.appointed_at && <span className="text-ink-500 tabular-nums">Appointed {mp.appointed_at}</span>}
              </div>
            </div>
          </div>
          <button onClick={onEdit} className="text-xs text-ink-500 hover:text-ink-950 underline underline-offset-2 shrink-0">
            Edit
          </button>
        </div>

        {(contact.office_phone || contact.email || contact.website || contact.office_address) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700">
            {contact.email && <a href={`mailto:${contact.email}`} className="underline underline-offset-2">{contact.email}</a>}
            {contact.office_phone && <a href={`tel:${contact.office_phone}`} className="underline underline-offset-2 tabular-nums">{contact.office_phone}</a>}
            {contact.website && <a href={contact.website} target="_blank" rel="noreferrer" className="underline underline-offset-2 truncate max-w-xs">{contact.website.replace(/^https?:\/\//, "")}</a>}
            {contact.office_address && <span className="text-ink-500">{contact.office_address}</span>}
          </div>
        )}

        {mp.bio && (
          <div className="mt-3 text-sm text-ink-700">
            <p className={expanded ? "" : "line-clamp-3"}>{mp.bio}</p>
            {mp.bio.length > 220 && (
              <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs text-ink-500 hover:text-ink-950 underline underline-offset-2">
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {(Array.isArray(mp.education) && mp.education.length > 0) || (Array.isArray(mp.career) && mp.career.length > 0) ? (
          <details className="mt-3 text-xs text-ink-700">
            <summary className="cursor-pointer text-ink-500 hover:text-ink-950">Background</summary>
            {Array.isArray(mp.education) && mp.education.length > 0 && (
              <div className="mt-2">
                <div className="text-ink-500 uppercase text-[10px] tracking-wide mb-1">Education</div>
                <ul className="list-disc pl-5 space-y-0.5">{mp.education.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
            {Array.isArray(mp.career) && mp.career.length > 0 && (
              <div className="mt-2">
                <div className="text-ink-500 uppercase text-[10px] tracking-wide mb-1">Career</div>
                <ul className="list-disc pl-5 space-y-0.5">{mp.career.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
          </details>
        ) : null}

        {(socials.twitter || socials.facebook || socials.linkedin || socials.instagram) && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            {socials.twitter && <a href={socials.twitter} target="_blank" rel="noreferrer" className="underline underline-offset-2 text-ink-700">Twitter</a>}
            {socials.facebook && <a href={socials.facebook} target="_blank" rel="noreferrer" className="underline underline-offset-2 text-ink-700">Facebook</a>}
            {socials.linkedin && <a href={socials.linkedin} target="_blank" rel="noreferrer" className="underline underline-offset-2 text-ink-700">LinkedIn</a>}
            {socials.instagram && <a href={socials.instagram} target="_blank" rel="noreferrer" className="underline underline-offset-2 text-ink-700">Instagram</a>}
          </div>
        )}
      </div>

      {row.mandate && <p className="mt-3 text-sm">{row.mandate}</p>}
      {Array.isArray(row.programmes) && row.programmes.length > 0 && (
        <ul className="mt-2 text-xs list-disc pl-5 text-ink-500 space-y-1">
          {(row.programmes as any[]).map((p, i) => (
            <li key={i}>
              <span className="text-ink-950">{p.name ?? p.title ?? "(untitled)"}</span>
              {p.objective && <> — {p.objective}</>}
              {p.status && <span className="ml-2 uppercase text-[10px] tracking-wide text-ink-400">{p.status}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MinisterEditDialog({ row, countryCode, onClose }: { row: any; countryCode: string; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(updateMinisterProfile);
  const initial = (row.minister_profile ?? {}) as any;
  const [form, setForm] = useState<any>({
    name: initial.name ?? row.minister ?? "",
    title: initial.title ?? "",
    party: initial.party ?? "",
    appointed_at: initial.appointed_at ?? "",
    bio: initial.bio ?? "",
    portrait_url: initial.portrait_url ?? "",
    contact: {
      email: initial.contact?.email ?? "",
      office_phone: initial.contact?.office_phone ?? "",
      office_address: initial.contact?.office_address ?? "",
      website: initial.contact?.website ?? "",
    },
    socials: {
      twitter: initial.socials?.twitter ?? "",
      facebook: initial.socials?.facebook ?? "",
      linkedin: initial.socials?.linkedin ?? "",
      instagram: initial.socials?.instagram ?? "",
    },
    education: (initial.education ?? []).join("\n"),
    career: (initial.career ?? []).join("\n"),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSave = async () => {
    setSaving(true); setErr(null);
    try {
      const profile = {
        name: form.name || null,
        title: form.title || null,
        party: form.party || null,
        appointed_at: form.appointed_at || null,
        bio: form.bio || null,
        portrait_url: form.portrait_url || null,
        contact: {
          email: form.contact.email || null,
          office_phone: form.contact.office_phone || null,
          office_address: form.contact.office_address || null,
          website: form.contact.website || null,
        },
        socials: {
          twitter: form.socials.twitter || null,
          facebook: form.socials.facebook || null,
          linkedin: form.socials.linkedin || null,
          instagram: form.socials.instagram || null,
        },
        education: form.education.split("\n").map((s: string) => s.trim()).filter(Boolean),
        career: form.career.split("\n").map((s: string) => s.trim()).filter(Boolean),
      };
      await save({ data: { countryCode, ministrySlug: row.ministry_slug, profile } });
      await qc.invalidateQueries({ queryKey: ["data", countryCode, "ministries"] });
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: string, path: string[] = []) => {
    const value = path.length ? form[path[0]][key] : form[key];
    const onChange = (v: string) => {
      if (path.length) setForm({ ...form, [path[0]]: { ...form[path[0]], [key]: v } });
      else setForm({ ...form, [key]: v });
    };
    return (
      <label className="block text-xs">
        <span className="text-ink-500">{label}</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border border-line-200 px-2 py-1 text-sm" />
      </label>
    );
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Edit Minister · {row.ministries?.name ?? row.ministry_slug}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {field("Name", "name")}
          {field("Title", "title")}
          {field("Party", "party")}
          {field("Appointed (YYYY-MM-DD)", "appointed_at")}
          {field("Portrait URL", "portrait_url")}
          {field("Ministry website", "website", ["contact"])}
          {field("Email", "email", ["contact"])}
          {field("Office phone", "office_phone", ["contact"])}
          {field("Office address", "office_address", ["contact"])}
          {field("Twitter", "twitter", ["socials"])}
          {field("Facebook", "facebook", ["socials"])}
          {field("LinkedIn", "linkedin", ["socials"])}
          {field("Instagram", "instagram", ["socials"])}
        </div>
        <label className="mt-3 block text-xs">
          <span className="text-ink-500">Bio</span>
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className="mt-1 w-full border border-line-200 px-2 py-1 text-sm" />
        </label>
        <label className="mt-3 block text-xs">
          <span className="text-ink-500">Education (one per line)</span>
          <textarea value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} rows={3} className="mt-1 w-full border border-line-200 px-2 py-1 text-sm" />
        </label>
        <label className="mt-3 block text-xs">
          <span className="text-ink-500">Career (one per line)</span>
          <textarea value={form.career} onChange={(e) => setForm({ ...form, career: e.target.value })} rows={3} className="mt-1 w-full border border-line-200 px-2 py-1 text-sm" />
        </label>
        {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
        <DialogFooter className="mt-4 gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
