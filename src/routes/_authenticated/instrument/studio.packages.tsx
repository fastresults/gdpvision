import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getGap, savePackage } from "@/lib/mandate.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { useChamberCountry } from "@/hooks/useChamberCountry";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function gapQuery(code: string) {
  return queryOptions({
    queryKey: ["studio-gap", code],
    queryFn: () => getGap({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/instrument/studio/packages")({
  head: () => ({ meta: [{ title: "Packages — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: PackagesPage,
});

function PackagesPage() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = useChamberCountry(bindings);
  const { data: gap } = useSuspenseQuery(gapQuery(code));

  const qc = useQueryClient();
  const save = useServerFn(savePackage);
  const [form, setForm] = useState({ name: "", sector: "TOURISM", target: 3 });

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          countryCode: code,
          sectorCode: form.sector,
          name: form.name,
          gates: [
            { label: "Fiscal impact modelled", passed: false },
            { label: "Regulatory pathway", passed: false },
            { label: "Ministerial sponsor", passed: false },
          ],
          enablingActions: [],
          targetGapPct: form.target,
          status: "draft",
        },
      }),
    onSuccess: () => {
      setForm({ name: "", sector: "TOURISM", target: 3 });
      qc.invalidateQueries({ queryKey: ["studio-gap", code] });
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <SectionHeader eyebrow={`${code} · Studio`} title="Package builder" />

      <form
        className="mt-10 grid grid-cols-1 gap-4 rounded-sm border border-line-200 p-6 md:grid-cols-[2fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.name.trim()) mut.mutate();
        }}
      >
        <label className="text-sm">
          <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Package name</span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-2 w-full border-b border-line-200 bg-transparent py-1 focus:border-ink-950 focus:outline-none"
            required
          />
        </label>
        <label className="text-sm">
          <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Sector</span>
          <select
            value={form.sector}
            onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
            className="mt-2 w-full border-b border-line-200 bg-transparent py-1 focus:border-ink-950 focus:outline-none"
          >
            {["TOURISM", "AGRICULTURE", "FINANCE", "DIGITAL", "INFRASTRUCTURE", "ENERGY", "MANUFACTURING"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Target gap close (pp)</span>
          <input
            type="number"
            step="0.1"
            value={form.target}
            onChange={(e) => setForm((f) => ({ ...f, target: Number(e.target.value) }))}
            className="mt-2 w-full border-b border-line-200 bg-transparent py-1 focus:border-ink-950 focus:outline-none"
            data-numeric
          />
        </label>
        <button
          type="submit"
          disabled={mut.isPending}
          className="self-end font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:underline underline-offset-4 disabled:opacity-50"
        >
          {mut.isPending ? "Saving…" : "Draft package →"}
        </button>
      </form>

      <table className="mt-12 w-full text-sm" data-numeric>
        <thead>
          <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
            <th className="py-2 font-normal">Package</th>
            <th className="py-2 font-normal">Sector</th>
            <th className="py-2 font-normal">Target</th>
            <th className="py-2 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {gap.packages.map((p) => (
            <tr key={p.id} className="border-b border-line-200/60">
              <td className="py-3">{p.name}</td>
              <td className="py-3 font-mono text-ink-500">{p.sector_code}</td>
              <td className="py-3 font-mono">{p.target_gap_pct?.toFixed(1) ?? "—"} pp</td>
              <td className="py-3 font-mono text-ink-500">{p.status}</td>
            </tr>
          ))}
          {gap.packages.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-ink-500">
                No packages yet — draft the first one above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
