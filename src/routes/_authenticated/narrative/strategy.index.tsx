import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listStrategies } from "@/lib/narrative.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function strategyQuery(scope: string) {
  return queryOptions({
    queryKey: ["strategies", scope],
    queryFn: () => listStrategies({ data: { scopeKey: scope } }),
  });
}

export const Route = createFileRoute("/_authenticated/narrative/strategy/")({
  head: () => ({ meta: [{ title: "Strategy — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: StrategyIndex,
});

function StrategyIndex() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: rows } = useSuspenseQuery(strategyQuery(code));

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <SectionHeader eyebrow={`${code} · Narrative`} title="Strategy Composer" />
      <p className="mt-4 max-w-xl text-sm text-ink-500">
        Seven-part strategy statements draw on Ledger figures + Second Brain positions. Composer authoring lands next; this list surfaces what exists.
      </p>

      {rows.length === 0 ? (
        <p className="mt-16 text-sm text-ink-500">No strategy statements drafted yet.</p>
      ) : (
        <ul className="mt-12 divide-y divide-line-200 border-y border-line-200">
          {rows.map((s) => (
            <li key={s.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 py-4 text-sm">
              <span>{s.title}</span>
              <span className="font-mono text-ink-500">{s.sector_code}</span>
              <span className="font-mono text-ink-500">v{s.version}</span>
              <span className="font-mono text-ink-500">{s.status}</span>
              <span className="font-mono text-ink-500">{new Date(s.updated_at).toISOString().slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
