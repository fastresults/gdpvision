import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { createIntake } from "@/lib/narrative.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

export const Route = createFileRoute("/_authenticated/narrative/ingest")({
  head: () => ({ meta: [{ title: "Ingest — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: Ingest,
});

function Ingest() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const qc = useQueryClient();
  const create = useServerFn(createIntake);

  const [form, setForm] = useState({
    scope: code as string,
    sector: "TOURISM",
    topic: "",
    summary: "",
    url: "",
    weight: 3,
  });
  const [flash, setFlash] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          scopeKey: form.scope,
          sectorCode: form.sector,
          topic: form.topic,
          summary: form.summary || undefined,
          url: form.url || undefined,
          proposedWeight: form.weight,
        },
      }),
    onSuccess: () => {
      setFlash("Filed to curation queue.");
      setForm((f) => ({ ...f, topic: "", summary: "", url: "" }));
      qc.invalidateQueries({ queryKey: ["intake"] });
      setTimeout(() => setFlash(null), 2400);
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-8 py-16">
      <SectionHeader eyebrow={`${code} · Narrative`} title="Ingest" />
      <p className="mt-4 max-w-xl text-sm text-ink-500">
        File a URL, note, or briefing fragment into the intake queue. A curator promotes it into the Second Brain.
      </p>

      <form
        className="mt-10 space-y-6"
        onSubmit={(e) => { e.preventDefault(); if (form.topic.trim()) mut.mutate(); }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Scope">
            <select value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))} className="input">
              <option value={code}>{code}</option>
              <option value="REGIONAL">Regional Commons</option>
            </select>
          </Field>
          <Field label="Sector">
            <select value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} className="input">
              {["TOURISM","AGRICULTURE","FINANCE","DIGITAL","INFRASTRUCTURE","ENERGY","MANUFACTURING","HEALTH","EDUCATION","GOVERNANCE"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Topic">
          <input value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} className="input" required />
        </Field>
        <Field label="Summary">
          <textarea rows={4} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} className="input resize-y" />
        </Field>
        <div className="grid grid-cols-[2fr_1fr] gap-4">
          <Field label="Source URL">
            <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className="input" placeholder="https://…" />
          </Field>
          <Field label="Weight (1–5)">
            <input type="number" min={1} max={5} value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))} className="input" data-numeric />
          </Field>
        </div>

        <div className="flex items-center justify-between pt-4">
          {flash ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950">{flash}</span>
          ) : <span />}
          <button type="submit" disabled={mut.isPending} className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:underline underline-offset-4 disabled:opacity-50">
            {mut.isPending ? "Filing…" : "File signal →"}
          </button>
        </div>
      </form>

      <style>{`.input { margin-top: 0.5rem; width: 100%; border-bottom: 1px solid rgba(0,0,0,0.12); background: transparent; padding: 0.4rem 0; font-size: 0.9rem; }
        .input:focus { outline: none; border-color: #111; }`}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</span>
      {children}
    </label>
  );
}
