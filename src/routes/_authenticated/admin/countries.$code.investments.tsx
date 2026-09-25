import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { Explain } from "@/components/explain/Explain";
import {
  approveInvestment,
  exportInvestmentsOc4ids,
  listInvestments,
  readinessChecks,
  saveInvestment,
} from "@/lib/investments/pipeline.functions";
import "@/lib/explain/standards-entries";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/investments")({
  head: ({ params }) => ({
    meta: [
      { title: `Investment pipeline · ${params.code} — GDPVision` },
      { name: "description", content: `Standardised national investment opportunities for ${params.code}, checked for syndication readiness.` },
      { property: "og:title", content: `Investment pipeline · ${params.code}` },
      { property: "og:description", content: `National investment opportunities for ${params.code}, ready for global syndication.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvestmentsPage,
});

type Draft = {
  id?: string;
  title: string;
  sector: string;
  structure: string;
  stage: string;
  capex_usd: string;
  revenue_model: string;
  sponsor: string;
  beneficial_owners: string;
  es_category: string;
  summary: string;
  risks: string;
  climate_alignment: string;
  aml_cleared: boolean;
  feasibility_done: boolean;
  land_secured: boolean;
};

const EMPTY: Draft = {
  title: "", sector: "", structure: "PPP", stage: "concept", capex_usd: "", revenue_model: "", sponsor: "",
  beneficial_owners: "", es_category: "", summary: "", risks: "", climate_alignment: "",
  aml_cleared: false, feasibility_done: false, land_secured: false,
};

function InvestmentsPage() {
  const { code } = Route.useParams();
  const list = useServerFn(listInvestments);
  const approve = useServerFn(approveInvestment);
  const exporter = useServerFn(exportInvestmentsOc4ids);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["investments", code], queryFn: () => list({ data: { code } }) });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function doApprove(id: string) {
    setErr(null);
    try {
      await approve({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["investments", code] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function doExport() {
    const payload = await exporter({ data: { code } });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${code}-investments-oc4ids.json`;
    a.click();
  }

  const rows = q.data ?? [];
  const total = rows.reduce((s, r) => s + Number(r.capex_usd ?? 0), 0);

  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Investment pipeline" },
      ]}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink-950">National investment pipeline</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-700">
            Every opportunity in one standard format, checked against investor-grade requirements before syndication.
          </p>
          <p className="mt-2 text-sm tabular-nums text-ink-950">
            {rows.length} projects · US${(total / 1e6).toFixed(2)} m pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/countries/$code/standards" params={{ code }} className="btn-ghost px-3 py-2 text-xs">Standards audit</Link>
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={doExport}>Export approved (OC4IDS)</button>
          <button type="button" className="btn-primary px-3 py-2 text-xs" onClick={() => setDraft({ ...EMPTY })}>Add project</button>
        </div>
      </div>

      {err && <p className="mb-3 text-sm text-signal-negative">{err}</p>}
      {q.isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {!q.isLoading && rows.length === 0 && <p className="text-sm text-ink-500">No projects yet. Add the first opportunity.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => {
          const checks = readinessChecks(r);
          const passed = checks.filter((c) => c.ok).length;
          return (
            <div key={r.id} className="border border-line-200 bg-paper-0 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    {r.sector ?? "Unassigned"} · {r.structure ?? "—"} · {r.stage}
                  </div>
                  <h3 className="mt-1 text-lg text-ink-950">{r.title}</h3>
                  <div className="text-sm tabular-nums text-ink-700">
                    {r.capex_usd ? `US$${(Number(r.capex_usd) / 1e6).toFixed(2)} m` : "Size not set"}
                  </div>
                </div>
                <span className={r.approval_status === "approved" ? "text-xs text-signal-positive" : "text-xs text-ink-500"}>
                  {r.approval_status}
                </span>
              </div>
              <div className="mt-3 text-xs text-ink-700">
                <Explain id="investments.readiness">Readiness {passed}/10</Explain>
              </div>
              <ul className="mt-2 grid grid-cols-1 gap-1 text-xs">
                {checks.map((c) => (
                  <li key={c.key} className={c.ok ? "text-signal-positive" : "text-ink-500"}>
                    {c.ok ? "✓" : "○"} {c.label} <span className="text-ink-300">· {c.standard}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs"
                  onClick={() =>
                    setDraft({
                      id: r.id, title: r.title, sector: r.sector ?? "", structure: r.structure ?? "", stage: r.stage,
                      capex_usd: r.capex_usd?.toString() ?? "", revenue_model: r.revenue_model ?? "", sponsor: r.sponsor ?? "",
                      beneficial_owners: r.beneficial_owners ?? "", es_category: r.es_category ?? "", summary: r.summary ?? "",
                      risks: r.risks ?? "", climate_alignment: r.climate_alignment ?? "",
                      aml_cleared: r.aml_cleared, feasibility_done: r.feasibility_done, land_secured: r.land_secured,
                    })
                  }
                >
                  Edit
                </button>
                {r.approval_status !== "approved" && (
                  <button type="button" disabled={passed < 10} className="btn-primary px-2 py-1 text-xs" onClick={() => doApprove(r.id)}>
                    Approve for syndication
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {draft && <ProjectDialog code={code} draft={draft} onClose={() => setDraft(null)} />}
    </SuperAdminShell>
  );
}

function ProjectDialog({ code, draft, onClose }: { code: string; draft: Draft; onClose: () => void }) {
  const save = useServerFn(saveInvestment);
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(draft);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const n = (s: string) => (s.trim() === "" ? null : s);

  async function submit() {
    setErr(null);
    try {
      await save({
        data: {
          id: d.id, code, title: d.title, sector: n(d.sector), structure: n(d.structure), stage: d.stage,
          capex_usd: d.capex_usd ? Number(d.capex_usd) : null, revenue_model: n(d.revenue_model), sponsor: n(d.sponsor),
          beneficial_owners: n(d.beneficial_owners), es_category: n(d.es_category), summary: n(d.summary), risks: n(d.risks),
          climate_alignment: n(d.climate_alignment), aml_cleared: d.aml_cleared, feasibility_done: d.feasibility_done, land_secured: d.land_secured,
        },
      });
      await qc.invalidateQueries({ queryKey: ["investments", code] });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const input = "w-full border border-line-200 bg-paper-0 px-2 py-1.5 text-sm";
  const text = (k: keyof Draft, label: string, area = false) => (
    <label className="block text-xs text-ink-700">
      {label}
      {area ? (
        <textarea className={input} rows={2} value={d[k] as string} onChange={(e) => set(k, e.target.value as never)} />
      ) : (
        <input className={input} value={d[k] as string} onChange={(e) => set(k, e.target.value as never)} />
      )}
    </label>
  );
  const check = (k: "aml_cleared" | "feasibility_done" | "land_secured", label: string) => (
    <label className="flex items-center gap-2 text-xs text-ink-700">
      <input type="checkbox" checked={d[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-paper-0 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-display text-xl text-ink-950">{d.id ? "Edit project" : "New investment project"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {text("title", "Title")}
          {text("sector", "Sector")}
          {text("structure", "Structure (PPP, concession, SOE asset, CBI project)")}
          {text("stage", "Stage (concept, feasibility, tender, financing)")}
          {text("capex_usd", "Capital cost (USD)")}
          {text("sponsor", "Sponsor")}
          {text("es_category", "E&S category (A / B / C)")}
          {text("climate_alignment", "Climate / taxonomy alignment")}
        </div>
        <div className="mt-3 space-y-3">
          {text("summary", "Summary", true)}
          {text("revenue_model", "Revenue model", true)}
          {text("beneficial_owners", "Beneficial owners (kept private)", true)}
          {text("risks", "Key risks", true)}
          <div className="flex flex-wrap gap-4">
            {check("aml_cleared", "AML / CBI due diligence cleared")}
            {check("feasibility_done", "Feasibility complete")}
            {check("land_secured", "Land and permits secured")}
          </div>
        </div>
        {err && <p className="mt-2 text-sm text-signal-negative">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}
