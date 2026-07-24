import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listOppositionItems } from "@/lib/narrative/opposition-intake.functions";
import { OppositionIntakeDropZone } from "@/components/narrative/opposition/OppositionIntakeDropZone";

function itemsQuery(code: string) {
  return queryOptions({
    queryKey: ["opposition-items", code],
    queryFn: () => listOppositionItems({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute(
  "/_authenticated/admin/countries/$code/narrative/opposition/",
)({
  head: ({ params }) => ({
    meta: [
      { title: `Opposition Intel · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(itemsQuery(params.code));
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-rose-600">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-ink-500">Opposition Intel not found.</div>
  ),
  component: OppositionIndex,
});

function OppositionIndex() {
  const { code } = Route.useParams();
  const { data } = useSuspenseQuery(itemsQuery(code));

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Act 0 · Opposition Intel
        </p>
        <h1 className="mt-1 font-serif text-3xl leading-tight text-ink-950">
          Drop what they're saying.<br />Get a counter-campaign back.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-700">
          Upload opposition memes, screenshots, viral stories, or forwarded messages.
          AI extracts the underlying motivation, traces where it originated and how
          it's amplifying, and drafts a McKinsey-grade counter-narrative response
          plan grounded in the country's own record.
        </p>
      </header>

      <OppositionIntakeDropZone code={code} />

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Recent intakes · {data.length}
        </h2>
        {data.length === 0 ? (
          <p className="mt-4 border border-dashed border-line-200 p-6 text-center text-sm text-ink-500">
            Nothing captured yet. Your first drop will land here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line-200 border border-line-200">
            {data.map((it) => (
              <li key={it.id} className="p-4">
                <p className="font-serif text-base text-ink-950">
                  {it.title || it.motivation_summary || it.source_url || "Untitled"}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  {it.kind} · {new Date(it.created_at).toLocaleString()} · status {it.status}
                </p>
                {it.motivation_summary && (
                  <p className="mt-2 line-clamp-2 text-sm text-ink-700">{it.motivation_summary}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
