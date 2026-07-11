import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { decideIntake, listIntake } from "@/lib/narrative.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function intakeQuery(scope: string) {
  return queryOptions({
    queryKey: ["intake", scope, "pending"],
    queryFn: () => listIntake({ data: { scopeKey: scope, state: "pending" } }),
  });
}

export const Route = createFileRoute("/_authenticated/narrative/queue")({
  head: () => ({ meta: [{ title: "Curation Queue — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: Queue,
});

function Queue() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: items } = useSuspenseQuery(intakeQuery(code));
  const [i, setI] = useState(0);
  const qc = useQueryClient();
  const decide = useServerFn(decideIntake);

  const mut = useMutation({
    mutationFn: (v: Parameters<typeof decide>[0]["data"]) => decide({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake", code, "pending"] });
      qc.invalidateQueries({ queryKey: ["memory", code] });
      setI(0);
    },
  });

  const item = items[i];

  return (
    <main className="mx-auto max-w-3xl px-8 py-16">
      <SectionHeader eyebrow={`${code} · Narrative`} title="Curation Queue" />
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
        {items.length} pending · keyboard: A accept · R reject · D defer · ← / →
      </p>

      {!item ? (
        <div className="mt-24 text-center text-sm text-ink-500">Queue is empty.</div>
      ) : (
        <article
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "a") mut.mutate({ id: item.id, decision: "accepted", promoteAsKind: "statement" });
            if (e.key === "r") mut.mutate({ id: item.id, decision: "rejected" });
            if (e.key === "d") mut.mutate({ id: item.id, decision: "deferred" });
            if (e.key === "ArrowRight") setI((v) => Math.min(v + 1, items.length - 1));
            if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0));
          }}
          className="mt-10 rounded-sm border border-line-200 p-8 focus:outline-none focus:border-ink-950"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            {item.sector_code} · proposed weight {item.proposed_weight}
          </p>
          <h2 className="mt-4 font-serif text-3xl text-ink-950">{item.topic}</h2>
          {item.summary && <p className="mt-6 text-sm text-ink-600 leading-relaxed">{item.summary}</p>}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block font-mono text-[11px] text-ink-500 hover:text-ink-950 underline underline-offset-4">
              Source ↗
            </a>
          )}

          <div className="mt-10 flex gap-6 font-mono text-[11px] uppercase tracking-[0.2em]">
            <button onClick={() => mut.mutate({ id: item.id, decision: "accepted", promoteAsKind: "statement" })} className="text-ink-950 hover:underline underline-offset-4">
              Accept · promote
            </button>
            <button onClick={() => mut.mutate({ id: item.id, decision: "deferred" })} className="text-ink-500 hover:text-ink-950">
              Defer
            </button>
            <button onClick={() => mut.mutate({ id: item.id, decision: "rejected" })} className="ml-auto text-ink-500 hover:text-red-700">
              Reject
            </button>
          </div>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-ink-500">
            {i + 1} of {items.length}
          </p>
        </article>
      )}
    </main>
  );
}
