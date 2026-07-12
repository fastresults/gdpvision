import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { listInstanceBindings } from "@/lib/ledger.functions";
import { renderDocument } from "@/lib/documents.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { supabase } from "@/integrations/supabase/client";

const bindingsQuery = queryOptions({ queryKey: ["instance-bindings"], queryFn: () => listInstanceBindings() });

interface DecisionRow {
  id: string;
  title: string;
  body: string | null;
  country_code: string;
  recorded_at: string;
  session_id: string;
}

function decisionsQuery(cc: string) {
  return queryOptions({
    queryKey: ["decisions", cc],
    queryFn: async (): Promise<DecisionRow[]> => {
      const { data, error } = await supabase
        .from("decisions")
        .select("id,title,body,country_code,recorded_at,session_id")
        .eq("country_code", cc)
        .order("recorded_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as DecisionRow[];
    },
  });
}

export const Route = createFileRoute("/_authenticated/instrument/cabinet/decisions")({
  head: () => ({
    meta: [
      { title: "Decisions register — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: DecisionsPage,
});

function DecisionsPage() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const cc = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: rows } = useSuspenseQuery(decisionsQuery(cc));
  const qc = useQueryClient();

  const render = useServerFn(renderDocument);
  const exportMut = useMutation({
    mutationFn: (id: string) => render({ data: { kind: "cabinet_decision", sourceId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  return (
    <main className="mx-auto max-w-5xl px-8 py-16">
      <Link to="/instrument" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">← Instrument</Link>
      <div className="mt-6">
        <SectionHeader eyebrow={`${cc} · Cabinet`} title="Decisions register" />
      </div>

      <p className="mt-6 max-w-2xl text-sm text-ink-500">
        Every recorded cabinet decision. Export any row to a print-ready document.
      </p>

      {rows.length === 0 ? (
        <p className="mt-14 border border-dashed border-line-200 p-12 text-center text-sm text-ink-500">
          No decisions recorded yet.
        </p>
      ) : (
        <ul className="mt-10 divide-y divide-line-200 border-y border-line-200">
          {rows.map((d) => (
            <li key={d.id} className="grid grid-cols-[1fr_auto] items-baseline gap-6 py-4">
              <div>
                <p className="text-sm text-ink-950">{d.title}</p>
                {d.body && <p className="mt-1 line-clamp-2 text-xs text-ink-500">{d.body}</p>}
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  {new Date(d.recorded_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                disabled={exportMut.isPending}
                onClick={() => exportMut.mutate(d.id)}
                className="border border-ink-950 px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
              >
                Export
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 flex justify-end">
        <Link to="/admin/documents" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
          View exported documents →
        </Link>
      </div>
    </main>
  );
}
