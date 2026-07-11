import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listComms } from "@/lib/narrative.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function commsQuery(scope: string) {
  return queryOptions({
    queryKey: ["comms", scope],
    queryFn: () => listComms({ data: { scopeKey: scope } }),
  });
}

export const Route = createFileRoute("/_authenticated/narrative/comms")({
  head: () => ({ meta: [{ title: "Comms Studio — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: Comms,
});

function Comms() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: rows } = useSuspenseQuery(commsQuery(code));

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <div className="flex items-start justify-between gap-6">
        <SectionHeader eyebrow={`${code} · Narrative`} title="Comms Studio" />
        <Link to="/narrative/comms/new" className="bg-ink-900 px-4 py-2 text-sm text-white">New artifact</Link>
      </div>
      <p className="mt-4 max-w-xl text-sm text-ink-500">
        Release-tier approvals gate publication; every figure re-verifies against the live Ledger at approval time.
      </p>

      {rows.length === 0 ? (
        <p className="mt-16 text-sm text-ink-500">No comms artifacts drafted yet.</p>
      ) : (
        <table className="mt-12 w-full text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
              <th className="py-2 font-normal">Kind</th>
              <th className="py-2 font-normal">Audience</th>
              <th className="py-2 font-normal">Channel</th>
              <th className="py-2 font-normal">State</th>
              <th className="py-2 font-normal">Released</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line-200/60 hover:bg-line-200/30">
                <td className="py-3 font-mono text-ink-500"><Link to="/narrative/comms/$id" params={{ id: r.id }}>{r.kind}</Link></td>
                <td className="py-3">{r.audience}</td>
                <td className="py-3 font-mono text-ink-500">{r.channel}</td>
                <td className="py-3 font-mono text-ink-500">{r.draft_state}</td>
                <td className="py-3 font-mono text-ink-500">{r.released_at ? new Date(r.released_at).toISOString().slice(0, 10) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
