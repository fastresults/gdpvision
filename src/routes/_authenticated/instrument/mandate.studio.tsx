import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { listKpis, saveKpi } from "@/lib/mandate.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
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

export const Route = createFileRoute("/_authenticated/instrument/mandate/studio")({
  head: () => ({ meta: [{ title: "Mandate Studio — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: MandateStudio,
});

function MandateStudio() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: kpis } = useSuspenseQuery(kpisQuery(code));
  const qc = useQueryClient();
  const save = useServerFn(saveKpi);
  const [form, setForm] = useState({
    metric: "",
    sector: "TOURISM",
    unit: "%",
    baseline: 0,
    target: 0,
    cadence: "quarterly" as "monthly" | "quarterly" | "annual",
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
        },
      }),
    onSuccess: () => {
      setForm((f) => ({ ...f, metric: "", baseline: 0, target: 0 }));
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
        <Field label="Unit">
          <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className="input" />
        </Field>
        <Field label="Baseline">
          <input type="number" step="0.01" value={form.baseline} onChange={(e) => setForm((f) => ({ ...f, baseline: Number(e.target.value) }))} className="input" data-numeric />
        </Field>
        <Field label="Target">
          <input type="number" step="0.01" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: Number(e.target.value) }))} className="input" data-numeric />
        </Field>
        <div className="col-span-2 flex items-end justify-end md:col-span-6">
          <button type="submit" disabled={mut.isPending} className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:underline underline-offset-4 disabled:opacity-50">
            {mut.isPending ? "Saving…" : "Ratify KPI →"}
          </button>
        </div>
      </form>

      <ul className="mt-12 divide-y divide-line-200 border-t border-line-200">
        {kpis.map((k) => (
          <li key={k.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 py-4 text-sm">
            <span>{k.metric}</span>
            <span className="font-mono text-ink-500">{k.sector_code}</span>
            <span className="font-mono" data-numeric>{k.target} {k.unit}</span>
            <span className="font-mono text-ink-500">{k.cadence}</span>
          </li>
        ))}
        {kpis.length === 0 && <li className="py-8 text-center text-ink-500">No KPIs ratified yet.</li>}
      </ul>

      <style>{`.input { margin-top: 0.5rem; width: 100%; border-bottom: 1px solid var(--color-line-200, #e5e5e5); background: transparent; padding: 0.25rem 0; }
        .input:focus { outline: none; border-color: currentColor; }`}</style>
    </main>
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
