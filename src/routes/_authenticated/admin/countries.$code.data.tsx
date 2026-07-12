import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { getOnboardingStatus } from "@/lib/country-onboarding/agents.functions";
import {
  corpusStats,
  deleteMemory,
  deleteSource,
  listDossiers,
  listKpis,
  listMemory,
  listMinistryProfiles,
  listSources,
  reingestSource,
  semanticSearch,
  setMemoryVerified,
  toggleSource,
  updateKpi,
  upsertMemory,
  upsertSource,
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
const dossiersQuery = (code: string) =>
  queryOptions({ queryKey: ["data", code, "dossiers"], queryFn: () => listDossiers({ data: { countryCode: code } }) });
const ministriesQuery = (code: string) =>
  queryOptions({ queryKey: ["data", code, "ministries"], queryFn: () => listMinistryProfiles({ data: { countryCode: code } }) });
const statsQuery = (code: string) =>
  queryOptions({ queryKey: ["data", code, "stats"], queryFn: () => corpusStats({ data: { countryCode: code } }) });
const memoryQuery = (code: string) =>
  queryOptions({ queryKey: ["data", code, "memory"], queryFn: () => listMemory({ data: { countryCode: code } }) });

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
  const upsert = useServerFn(upsertSource);
  const [running, setRunning] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

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

  return (
    <section className="space-y-4">
      {err && <div className="p-2 text-xs text-red-700 border border-red-500/50 bg-red-500/10">{err}</div>}
      <div className="flex justify-between items-center">
        <div className="text-xs text-ink-500">
          {(sources as any[]).length} sources · {(sources as any[]).filter((s) => s.active).length} active
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0"
        >
          {showAdd ? "Cancel" : "Add source"}
        </button>
      </div>

      {showAdd && (
        <AddSourceForm
          onSubmit={async (v) => {
            await upsert({ data: { countryCode: code, ...v } });
            setShowAdd(false);
            await refresh();
          }}
        />
      )}

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
            {(sources as any[]).map((s) => (
              <tr key={s.id} className="border-t border-line-200">
                <td className="px-3 py-2">
                  <a href={s.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                    {s.title}
                  </a>
                  <div className="text-xs text-ink-500">{s.org} · {(() => { try { return new URL(s.url).hostname; } catch { return ""; } })()}</div>
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
            {(sources as any[]).length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-ink-500">No sources yet. Run the Source registry stage in onboarding, or add one.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AddSourceForm({ onSubmit }: { onSubmit: (v: { url: string; title: string; org: string; kind: string; quality_score: number; active: boolean; tags: string[] }) => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [org, setOrg] = useState("");
  const [kind, setKind] = useState("gov");
  const [q, setQ] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        setBusy(true);
        try {
          await onSubmit({ url, title, org, kind, quality_score: q, active: true, tags: [] });
          setUrl(""); setTitle(""); setOrg("");
        } catch (e: any) {
          setErr(e?.message ?? String(e));
        } finally {
          setBusy(false);
        }
      }}
      className="grid grid-cols-1 md:grid-cols-6 gap-2 border border-line-200 p-3 bg-paper-100/40"
    >
      <input required placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} className="md:col-span-2 border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="md:col-span-2 border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      <input required placeholder="Org" value={org} onChange={(e) => setOrg(e.target.value)} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      <select value={kind} onChange={(e) => setKind(e.target.value)} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0">
        {["gov", "regional", "multilateral", "advisory", "ngo", "media", "summit"].map((k) => <option key={k}>{k}</option>)}
      </select>
      <select value={q} onChange={(e) => setQ(Number(e.target.value))} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0">
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
      </select>
      <button disabled={busy} className="md:col-span-5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50">
        {busy ? "Adding…" : "Add source"}
      </button>
      {err && <div className="md:col-span-6 text-xs text-red-700">{err}</div>}
    </form>
  );
}

// ============================================================
// KPIs
// ============================================================

function KpisTab({ code }: { code: string }) {
  const qc = useQueryClient();
  const { data: kpis } = useSuspenseQuery(kpisQuery(code));
  const update = useServerFn(updateKpi);

  const byCat = new Map<string, any[]>();
  for (const k of kpis as any[]) {
    const c = k.category ?? "other";
    (byCat.get(c) ?? byCat.set(c, []).get(c)!).push(k);
  }

  return (
    <section className="space-y-6">
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
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((k) => (
                  <KpiRow key={k.id} k={k} onSave={async (patch) => {
                    await update({ data: { id: k.id, ...patch } });
                    await qc.invalidateQueries({ queryKey: ["data", code, "kpis"] });
                  }} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {(kpis as any[]).length === 0 && <p className="text-sm text-ink-500">No KPIs yet.</p>}
    </section>
  );
}

function KpiRow({ k, onSave }: { k: any; onSave: (patch: any) => Promise<void> }) {
  const [latest, setLatest] = useState<string>(k.latest_value ?? "");
  const [period, setPeriod] = useState<string>(k.latest_period ?? "");
  const [target, setTarget] = useState<string>(k.target ?? "");
  const dirty = String(latest) !== String(k.latest_value ?? "") || period !== (k.latest_period ?? "") || String(target) !== String(k.target ?? "");
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
      <td className="px-3 py-2 text-xs">
        {k.country_sources?.url ? (
          <a href={k.country_sources.url} target="_blank" rel="noreferrer" className="hover:underline">{k.country_sources.org}</a>
        ) : "—"}
        {dirty && (
          <button
            onClick={() => onSave({
              latest_value: latest === "" ? null : Number(latest),
              latest_period: period || null,
              target: target === "" ? null : Number(target),
            })}
            className="ml-2 text-[10px] px-2 py-0.5 border border-ink-950 bg-ink-950 text-paper-0"
          >save</button>
        )}
      </td>
    </tr>
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
