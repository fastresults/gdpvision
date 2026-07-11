import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { getTrace } from "@/lib/traceability.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

function traceQuery(id: string) {
  return queryOptions({ queryKey: ["trace", id], queryFn: () => getTrace({ data: { signalId: id } }) });
}

export const Route = createFileRoute("/_authenticated/narrative/trace/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Trace ${params.id.slice(0, 8)} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(traceQuery(params.id)),
  component: TracePage,
});

function TracePage() {
  const { id } = Route.useParams();
  const { data: t } = useSuspenseQuery(traceQuery(id));

  const strategies = t.links.filter((l) => l.artifact_type === "strategy");
  const comms = t.links.filter((l) => l.artifact_type === "comms");
  const counsel = t.links.filter((l) => l.artifact_type === "counsel");

  return (
    <main className="mx-auto max-w-5xl px-8 py-16">
      <Link to="/narrative/signal/$id" params={{ id }} className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
        ← Dossier
      </Link>
      <div className="mt-6">
        <SectionHeader
          eyebrow={`${t.signal.scope_key} · ${t.signal.sector_code} · ${t.signal.state}`}
          title={`Trace — ${t.signal.topic}`}
        />
      </div>

      <div className="mt-16 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-6">
        <Node label="Signal" title={t.signal.topic} meta={new Date(t.signal.created_at).toLocaleDateString()} />
        <Arrow />
        <NodeList label="Strategies" items={strategies.map((s) => ({ ...s, href: `/narrative/strategy/${s.artifact_id}` }))} />
        <Arrow />
        <div className="space-y-6">
          <NodeList label="Comms" items={comms.map((c) => ({ ...c, href: `/narrative/comms/${c.artifact_id}` }))} />
          <NodeList label="Counsel" items={counsel} />
        </div>
      </div>

      {t.links.length === 0 && (
        <p className="mt-16 border border-dashed border-line-200 p-10 text-center text-sm text-ink-500">
          No downstream artifacts linked to this signal yet.
        </p>
      )}
    </main>
  );
}

function Node({ label, title, meta }: { label: string; title: string; meta?: string }) {
  return (
    <div className="border border-line-200 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <p className="mt-2 text-sm text-ink-950">{title}</p>
      {meta && <p className="mt-1 font-mono text-[10px] text-ink-500">{meta}</p>}
    </div>
  );
}

function NodeList({ label, items }: { label: string; items: Array<{ id: string; title: string; status: string; href?: string; created_at: string }> }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-ink-500">—</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((it) => (
            <li key={it.id} className="border border-line-200 p-3 text-sm">
              {it.href ? (
                <a href={it.href} className="hover:text-ink-950">{it.title}</a>
              ) : (
                <span>{it.title}</span>
              )}
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-500">{it.status}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Arrow() {
  return <span className="mt-8 font-mono text-ink-500">→</span>;
}
