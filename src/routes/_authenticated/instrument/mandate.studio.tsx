import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { listKpis, qualifyKpi, recordKpiActual, saveKpi } from "@/lib/mandate.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { listMinistries } from "@/lib/scenarios.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function kpisQuery(code: string) {
  return queryOptions({
    queryKey: ["kpis", code],
    queryFn: () => listKpis({ data: { countryCode: code } }),
  });
}
function ministriesQuery(code: string) {
  return queryOptions({
    queryKey: ["mandate-ministries", code],
    queryFn: () => listMinistries({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/instrument/mandate/studio")({
  head: () => ({ meta: [{ title: "Mandate Studio — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: MandateStudio,
});

function MandateStudio() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: kpis } = useSuspenseQuery(kpisQuery(code));
  const { data: ministries } = useSuspenseQuery(ministriesQuery(code));
  const qc = useQueryClient();
  const save = useServerFn(saveKpi);
  const [form, setForm] = useState({
    metric: "",
    sector: "TOURISM",
    unit: "%",
    baseline: 0,
    target: 0,
    cadence: "quarterly" as "monthly" | "quarterly" | "annual",
    baselinePeriod: "",
    targetPeriod: "",
    direction: "up" as "up" | "down" | "flat",
    targetBasis: "policy_commitment" as "policy_commitment" | "peer_benchmark" | "approved_scenario",
    evidenceUrl: "",
    ministryId: "",
  });

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          countryCode: code,
          sectorCode: form.sector,
          metric: form.metric,
          unit: form.unit,
          baseline: form.baseline,
          target: form.target,
          cadence: form.cadence,
          classification: "internal",
          baselinePeriod: form.baselinePeriod,
          targetPeriod: form.targetPeriod,
          direction: form.direction,
          targetBasis: form.targetBasis,
          evidenceUrl: form.evidenceUrl,
          warningTolerancePct: 10,
          criticalTolerancePct: 20,
          ministryId: form.ministryId,
        },
      }),
    onSuccess: () => {
      setForm((f) => ({ ...f, metric: "", baseline: 0, target: 0, baselinePeriod: "", targetPeriod: "", evidenceUrl: "" }));
      qc.invalidateQueries({ queryKey: ["kpis", code] });
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <SectionHeader eyebrow={`${code} · Mandate`} title="KPI studio" />

      <form
        className="mt-10 grid grid-cols-2 gap-4 rounded-sm border border-line-200 p-6 md:grid-cols-6"
        onSubmit={(e) => { e.preventDefault(); if (form.metric.trim()) mut.mutate(); }}
      >
        <Field label="Metric" span={2}>
          <input value={form.metric} onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value }))} className="input" required />
        </Field>
        <Field label="Sector">
          <select value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} className="input">
            {["TOURISM","AGRICULTURE","FINANCE","DIGITAL","INFRASTRUCTURE","ENERGY","MANUFACTURING","HEALTH","EDUCATION"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Accountable ministry" span={2}>
          <select value={form.ministryId} onChange={(e) => setForm((f) => ({ ...f, ministryId: e.target.value }))} className="input" required>
            <option value="">Select ministry</option>
            {ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
          </select>
        </Field>
        <Field label="Unit">
          <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className="input" />
        </Field>
        <Field label="Baseline">
          <input type="number" step="0.01" value={form.baseline} onChange={(e) => setForm((f) => ({ ...f, baseline: Number(e.target.value) }))} className="input" data-numeric />
        </Field>
        <Field label="Target">
          <input type="number" step="0.01" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: Number(e.target.value) }))} className="input" data-numeric />
        </Field>
        <Field label="Baseline period">
          <input value={form.baselinePeriod} onChange={(e) => setForm((f) => ({ ...f, baselinePeriod: e.target.value }))} className="input" placeholder="2025" required />
        </Field>
        <Field label="Target period">
          <input value={form.targetPeriod} onChange={(e) => setForm((f) => ({ ...f, targetPeriod: e.target.value }))} className="input" placeholder="2028" required />
        </Field>
        <Field label="Desired direction">
          <select value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as typeof form.direction }))} className="input">
            <option value="up">Increase</option><option value="down">Decrease</option><option value="flat">Hold stable</option>
          </select>
        </Field>
        <Field label="Target basis">
          <select value={form.targetBasis} onChange={(e) => setForm((f) => ({ ...f, targetBasis: e.target.value as typeof form.targetBasis }))} className="input">
            <option value="policy_commitment">Policy commitment</option><option value="peer_benchmark">Peer benchmark</option><option value="approved_scenario">Approved scenario</option>
          </select>
        </Field>
        <Field label="Evidence URL" span={2}>
          <input type="url" value={form.evidenceUrl} onChange={(e) => setForm((f) => ({ ...f, evidenceUrl: e.target.value }))} className="input" required />
        </Field>
        <div className="col-span-2 flex items-end justify-end md:col-span-6">
          <button type="submit" disabled={mut.isPending} className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:underline underline-offset-4 disabled:opacity-50">
            {mut.isPending ? "Saving…" : "Ratify KPI →"}
          </button>
        </div>
      </form>

      <ul className="mt-12 divide-y divide-line-200 border-t border-line-200">
        {kpis.map((k) => (
          <KpiItem key={k.id} kpi={k} code={code} invalidate={() => qc.invalidateQueries({ queryKey: ["kpis", code] })} />
        ))}
        {kpis.length === 0 && <li className="py-8 text-center text-ink-500">No KPIs ratified yet.</li>}
      </ul>

      <style>{`.input { margin-top: 0.5rem; width: 100%; border-bottom: 1px solid var(--color-line-200, #e5e5e5); background: transparent; padding: 0.25rem 0; }
        .input:focus { outline: none; border-color: currentColor; }`}</style>
    </main>
  );
}

function KpiItem({ kpi, code, invalidate }: { kpi: Awaited<ReturnType<typeof listKpis>>[number]; code: string; invalidate: () => void }) {
  const record = useServerFn(recordKpiActual);
  const qualify = useServerFn(qualifyKpi);
  const [period, setPeriod] = useState("");
  const [actual, setActual] = useState("");
  const actualMut = useMutation({ mutationFn: () => record({ data: { kpiId: kpi.id, period, actual: Number(actual) } }), onSuccess: invalidate });
  const qualifyMut = useMutation({ mutationFn: () => qualify({ data: { kpiId: kpi.id } }), onSuccess: invalidate });
  return (
    <li className="grid gap-4 py-5 text-sm md:grid-cols-[2fr_1fr_1fr_1.4fr]">
      <div><p>{kpi.metric}</p><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{kpi.sector_code} · {kpi.verification_status}</p></div>
      <span className="font-mono" data-numeric>{kpi.target} {kpi.unit}</span>
      <span className="font-mono text-ink-500">{kpi.latest ? `${kpi.latest.value ?? "—"} · ${kpi.latest.period}` : "No actual"}</span>
      <div className="flex flex-wrap items-end gap-2">
        <input value={period} onChange={(e) => setPeriod(e.target.value)} className="input w-20" placeholder="2026 Q1" aria-label={`Period for ${kpi.metric}`} />
        <input type="number" step="0.01" value={actual} onChange={(e) => setActual(e.target.value)} className="input w-20" placeholder="Actual" aria-label={`Actual for ${kpi.metric}`} />
        <button type="button" className="btn-secondary" disabled={!period || !actual || actualMut.isPending} onClick={() => actualMut.mutate()}>Record</button>
        {kpi.verification_status === "submitted" && <button type="button" className="btn-primary" disabled={qualifyMut.isPending} onClick={() => qualifyMut.mutate()}>Qualify</button>}
      </div>
    </li>
  );
}

function Field({ label, span, children }: { label: string; span?: number; children: React.ReactNode }) {
  return (
    <label className={`text-sm ${span ? `col-span-${span}` : ""}`}>
      <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</span>
      {children}
    </label>
  );
}
