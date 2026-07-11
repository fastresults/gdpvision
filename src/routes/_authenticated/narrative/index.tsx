import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listIntake } from "@/lib/narrative.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function intakeQuery(code: string) {
  return queryOptions({
    queryKey: ["intake", code, "pending"],
    queryFn: () => listIntake({ data: { scopeKey: code, state: "pending" } }),
  });
}

export const Route = createFileRoute("/_authenticated/narrative/")({
  head: () => ({ meta: [{ title: "Signal Desk — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: SignalDesk,
});

function SignalDesk() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: intake } = useSuspenseQuery(intakeQuery(code));

  const bySector = new Map<string, number>();
  for (const i of intake) bySector.set(i.sector_code, (bySector.get(i.sector_code) ?? 0) + 1);

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <div className="flex items-baseline justify-between">
        <SectionHeader eyebrow={`${code} · Narrative`} title="Signal Desk" />
        <Link to="/narrative/queue" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
          Curation queue →
        </Link>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
        <StatCard label="Pending" value={intake.length} />
        <StatCard label="Sectors touched" value={bySector.size} />
        <StatCard label="Avg proposed weight" value={intake.length ? (intake.reduce((s, i) => s + i.proposed_weight, 0) / intake.length).toFixed(1) : "—"} />
        <StatCard label="Oldest (days)" value={intake.length ? Math.max(...intake.map((i) => Math.floor((Date.now() - new Date(i.created_at).getTime()) / 86_400_000))) : "—"} />
      </div>

      <h3 className="mt-16 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Latest signals</h3>
      <ul className="mt-4 divide-y divide-line-200 border-y border-line-200">
        {intake.slice(0, 12).map((i) => (
          <li key={i.id} className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-4 py-3 text-sm">
            <Link to="/narrative/signal/$id" params={{ id: i.id }} className="truncate hover:text-ink-950">{i.topic}</Link>
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">{i.sector_code}</span>
            <span className="font-mono text-[11px] text-ink-500">w{i.proposed_weight}</span>
            <Link to="/narrative/signal/$id" params={{ id: i.id }} className="font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-ink-950">Dossier →</Link>
          </li>
        ))}
        {intake.length === 0 && (
          <li className="py-12 text-center text-sm text-ink-500">
            No pending signals — the harvest queue is clear.
          </li>
        )}
      </ul>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-sm border border-line-200 p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <p className="mt-3 font-serif text-4xl text-ink-950" data-numeric>{value}</p>
    </div>
  );
}
