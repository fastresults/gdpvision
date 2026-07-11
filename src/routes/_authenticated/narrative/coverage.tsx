import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { getCoverage } from "@/lib/narrative.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({ queryKey: ["instance-bindings"], queryFn: () => listInstanceBindings() });
const covQuery = (scope: string) =>
  queryOptions({ queryKey: ["coverage", scope], queryFn: () => getCoverage({ data: { scopeKey: scope } }) });

export const Route = createFileRoute("/_authenticated/narrative/coverage")({
  head: () => ({ meta: [{ title: "Coverage & Gaps — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: CoveragePage,
});

const KINDS = ["audience", "position", "statement", "outlet", "precedent"] as const;

function CoveragePage() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const scope = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: rows } = useSuspenseQuery(covQuery(scope));

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <SectionHeader eyebrow={`${scope} · Narrative`} title="Coverage & Gaps" />
      <p className="mt-4 max-w-2xl text-sm text-ink-500">
        Second Brain object counts per sector, per kind. Empty cells are gaps — commissionable to the Curation Queue.
      </p>

      <table className="mt-10 w-full text-sm">
        <thead>
          <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
            <th className="py-2 font-normal">Sector</th>
            {KINDS.map((k) => <th key={k} className="py-2 text-right font-normal">{k}</th>)}
            <th className="py-2 text-right font-normal">Σ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const total = KINDS.reduce((s, k) => s + (r.counts[k] ?? 0), 0);
            return (
              <tr key={r.sectorCode} className="border-b border-line-200/60">
                <td className="py-3">{r.sectorName} <span className="ml-1 font-mono text-xs text-ink-500">{r.sectorCode}</span></td>
                {KINDS.map((k) => {
                  const n = r.counts[k] ?? 0;
                  return <td key={k} className={`py-3 text-right font-mono ${n === 0 ? "text-red-500" : "text-ink-500"}`}>{n}</td>;
                })}
                <td className="py-3 text-right font-mono">{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
