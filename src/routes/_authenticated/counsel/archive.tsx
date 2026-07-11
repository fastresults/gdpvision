import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listCounselArchive } from "@/lib/counsel.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({ queryKey: ["instance-bindings"], queryFn: () => listInstanceBindings() });
const archiveQuery = (scope: string) =>
  queryOptions({ queryKey: ["counsel-archive", scope], queryFn: () => listCounselArchive({ data: { scopeKey: scope } }) });

export const Route = createFileRoute("/_authenticated/counsel/archive")({
  head: () => ({ meta: [{ title: "Counsel Archive — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: ArchivePage,
});

function ArchivePage() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const scope = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: rows } = useSuspenseQuery(archiveQuery(scope));

  return (
    <main className="mx-auto max-w-4xl px-8 py-16">
      <div className="flex items-start justify-between">
        <SectionHeader eyebrow={`${scope} · Counsel`} title="Archive" />
        <Link to="/counsel" className="border border-ink-900 px-4 py-2 text-xs font-mono uppercase tracking-widest hover:bg-ink-900 hover:text-white">Ask</Link>
      </div>

      <ol className="mt-12 space-y-8">
        {rows.length === 0 && <li className="text-sm text-ink-500">No answers recorded yet.</li>}
        {rows.map((r) => (
          <li key={r.id} className="border-l-2 border-line-200 pl-4">
            <div className="font-mono text-xs text-ink-500">{new Date(r.created_at).toISOString().replace("T", " ").slice(0, 16)}</div>
            <div className="mt-1 font-medium">{r.question}</div>
            {r.spoken_block && <p className="mt-2 text-sm text-ink-500">{r.spoken_block}</p>}
            {r.written_block && <details className="mt-2"><summary className="cursor-pointer text-xs font-mono uppercase tracking-widest text-ink-500">Written brief</summary><pre className="mt-2 whitespace-pre-wrap font-mono text-xs">{r.written_block}</pre></details>}
          </li>
        ))}
      </ol>
    </main>
  );
}
