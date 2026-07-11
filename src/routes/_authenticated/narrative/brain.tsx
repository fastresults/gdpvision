import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { listMemoryObjects } from "@/lib/narrative.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function memoryQuery(scope: string, kind?: string) {
  return queryOptions({
    queryKey: ["memory", scope, kind ?? "*"],
    queryFn: () => listMemoryObjects({ data: { scopeKey: scope, kind } }),
  });
}

export const Route = createFileRoute("/_authenticated/narrative/brain")({
  head: () => ({ meta: [{ title: "Second Brain — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: BrainBrowser,
});

const KINDS = ["audience", "position", "statement", "outlet", "precedent"] as const;

function BrainBrowser() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const defaultCode = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const [scope, setScope] = useState<"country" | "regional">("country");
  const [kind, setKind] = useState<string | undefined>(undefined);
  const scopeKey = scope === "regional" ? "REGIONAL" : defaultCode;
  const { data: rows } = useSuspenseQuery(memoryQuery(scopeKey, kind));

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <div className="flex items-baseline justify-between">
        <SectionHeader eyebrow={`${scopeKey} · Narrative`} title="Second Brain" />
        <div className="flex gap-1 rounded-sm border border-line-200 p-0.5 font-mono text-[10px] uppercase tracking-widest">
          {(["country", "regional"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-1 ${scope === s ? "bg-ink-950 text-paper-0" : "text-ink-500 hover:text-ink-950"}`}
            >
              {s === "country" ? defaultCode : "Regional"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-2">
        <FilterChip label="All" active={!kind} onClick={() => setKind(undefined)} />
        {KINDS.map((k) => (
          <FilterChip key={k} label={k} active={kind === k} onClick={() => setKind(k)} />
        ))}
      </div>

      <table className="mt-8 w-full text-sm" data-numeric>
        <thead>
          <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
            <th className="py-2 font-normal">Title</th>
            <th className="py-2 font-normal">Kind</th>
            <th className="py-2 font-normal">Sector</th>
            <th className="py-2 font-normal">Weight</th>
            <th className="py-2 font-normal">Verified</th>
            <th className="py-2 font-normal">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line-200/60">
              <td className="py-3 font-sans">{r.title}</td>
              <td className="py-3 font-mono text-ink-500">{r.kind}</td>
              <td className="py-3 font-mono text-ink-500">{r.sector_code}</td>
              <td className="py-3 font-mono">{"■".repeat(r.weight)}<span className="text-ink-300">{"□".repeat(5 - r.weight)}</span></td>
              <td className="py-3 font-mono text-[11px]">{r.verified ? "yes" : "—"}</td>
              <td className="py-3 font-mono text-ink-500">{new Date(r.updated_at).toISOString().slice(0, 10)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="py-12 text-center text-ink-500">Brain is empty at this scope.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-sm border px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
        active ? "border-ink-950 text-ink-950" : "border-line-200 text-ink-500 hover:text-ink-950"
      }`}
    >
      {label}
    </button>
  );
}
