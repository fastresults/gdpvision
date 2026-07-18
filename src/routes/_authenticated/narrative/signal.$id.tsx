import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { generateDossierQuestions, getDossier, updateDossierQuestion } from "@/lib/dossier.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { CitedText } from "@/components/citations/CitedText";

function dossierQuery(id: string) {
  return queryOptions({
    queryKey: ["dossier", id],
    queryFn: () => getDossier({ data: { intakeId: id } }),
  });
}

export const Route = createFileRoute("/_authenticated/narrative/signal/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Dossier ${params.id.slice(0, 8)} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(dossierQuery(params.id)),
  component: Dossier,
});

function Dossier() {
  const { id } = Route.useParams();
  const { data: d } = useSuspenseQuery(dossierQuery(id));
  const qc = useQueryClient();
  const gen = useServerFn(generateDossierQuestions);
  const upd = useServerFn(updateDossierQuestion);

  const genMut = useMutation({
    mutationFn: () => gen({ data: { intakeId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dossier", id] }),
  });
  const updMut = useMutation({
    mutationFn: (v: { qid: string; status: "open" | "answered" | "dismissed" }) =>
      upd({ data: { id: v.qid, status: v.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dossier", id] }),
  });

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <Link to="/narrative" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
        ← Signal desk
      </Link>

      <div className="mt-6">
        <SectionHeader
          eyebrow={`${d.signal.scope_key} · ${d.signal.sector_code} · ${d.signal.state}`}
          title={d.signal.topic}
        />
        {d.signal.summary && (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-700">
            <CitedText text={d.signal.summary} citations={d.signal.citations} />
          </p>
        )}
        {d.signal.url && (
          <a href={d.signal.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block font-mono text-[11px] uppercase tracking-widest text-ink-500 hover:text-ink-950">
            Source ↗
          </a>
        )}
      </div>

      <section className="mt-14">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Ledger facts · {d.signal.sector_code}</h3>
        {d.facts.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">No Ledger series ingested for this sector yet.</p>
        ) : (
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {d.facts.map((f) => (
              <li key={f.series_id} className="grid grid-cols-[1fr_auto] items-baseline gap-4 border-b border-line-200 py-2 text-sm">
                <span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{f.period} · </span>
                  {f.metric}
                </span>
                <span className="font-mono text-[12px]">{f.value.toLocaleString()} <span className="text-ink-500">{f.unit}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-14">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Open questions</h3>
          <button
            onClick={() => genMut.mutate()}
            disabled={genMut.isPending}
            className="border border-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
          >
            {genMut.isPending ? "Generating…" : d.questions.length === 0 ? "Generate questions" : "Add more"}
          </button>
        </div>
        {genMut.isError && <p className="mt-3 text-sm text-red-600">{(genMut.error as Error).message}</p>}
        {d.questions.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">No open questions yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line-200 border-y border-line-200">
            {d.questions.map((q) => (
              <li key={q.id} className="grid grid-cols-[1fr_auto] items-baseline gap-4 py-3 text-sm">
                <span className={q.status === "dismissed" ? "text-ink-500 line-through" : q.status === "answered" ? "text-ink-500" : ""}>
                  {q.question}
                </span>
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  <span>{q.status}</span>
                  {q.status !== "answered" && (
                    <button className="hover:text-ink-950" onClick={() => updMut.mutate({ qid: q.id, status: "answered" })}>✓</button>
                  )}
                  {q.status !== "dismissed" && (
                    <button className="hover:text-ink-950" onClick={() => updMut.mutate({ qid: q.id, status: "dismissed" })}>✕</button>
                  )}
                  {q.status !== "open" && (
                    <button className="hover:text-ink-950" onClick={() => updMut.mutate({ qid: q.id, status: "open" })}>↺</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-16 grid gap-12 md:grid-cols-3">
        <Column title="Second Brain memory">
          {d.memory.length === 0 && <Empty>No memory objects for this sector yet.</Empty>}
          {d.memory.map((m) => (
            <li key={m.id} className="grid grid-cols-[1fr_auto] items-baseline gap-3 border-b border-line-200 py-2 text-sm">
              <span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{m.kind} · </span>
                {m.title}
              </span>
              <span className="font-mono text-[10px] text-ink-500">w{m.weight ?? "–"}</span>
            </li>
          ))}
        </Column>

        <Column title="Prior strategy">
          {d.strategies.length === 0 && <Empty>No strategy statements on file for this sector.</Empty>}
          {d.strategies.map((s) => (
            <li key={s.id} className="grid grid-cols-[1fr_auto] items-baseline gap-3 border-b border-line-200 py-2 text-sm">
              <Link to="/narrative/strategy/$id" params={{ id: s.id }} className="hover:text-ink-950">{s.title}</Link>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{s.status}</span>
            </li>
          ))}
        </Column>

        <Column title="Recent comms">
          {d.comms.length === 0 && <Empty>No comms artifacts released for this country.</Empty>}
          {d.comms.map((c) => (
            <li key={c.id} className="grid grid-cols-[1fr_auto] items-baseline gap-3 border-b border-line-200 py-2 text-sm">
              <Link to="/narrative/comms/$id" params={{ id: c.id }} className="hover:text-ink-950">
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{c.kind} · </span>
                {c.audience}
              </Link>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{c.state}</span>
            </li>
          ))}
        </Column>
      </div>

      <div className="mt-16 flex items-center justify-between border-t border-line-200 pt-8 text-sm text-ink-500">
        <span>Ready to shape the response? <Link to="/narrative/strategy/new" className="text-ink-950 underline">Draft a new strategy statement</Link>.</span>
        <Link to="/narrative/trace/$id" params={{ id }} className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">Trace →</Link>
      </div>
    </main>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">{title}</h3>
      <ul className="mt-4">{children}</ul>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="py-6 text-center text-sm text-ink-500">{children}</li>;
}
