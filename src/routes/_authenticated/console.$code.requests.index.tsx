// Requests list — country user's ledger of asks. No chamber vocabulary.
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listMyRequests } from "@/lib/concierge/concierge.functions";
import { STATUS_LABEL } from "@/lib/concierge/minister-lexicon";

const listQuery = (code: string) =>
  queryOptions({
    queryKey: ["console-requests", code],
    queryFn: () => listMyRequests({ data: { country_code: code } }),
    staleTime: 15_000,
  });

export const Route = createFileRoute("/_authenticated/console/$code/requests/")({
  head: () => ({
    meta: [
      { title: "Requests — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(listQuery(params.code));
    return null;
  },
  component: RequestsList,
});

function RequestsList() {
  const { code } = Route.useParams();
  const { data: rows } = useSuspenseQuery(listQuery(code));

  return (
    <div>
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="font-serif text-4xl text-ink-950">Requests</h1>
        <Link
          to="/console/$code/request/new"
          params={{ code }}
          className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-paper-50 hover:opacity-90"
        >
          Start a request
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="border border-dashed border-line-200 p-10 text-center text-sm text-ink-500">
          You haven't sent anything yet. Start a request whenever you're ready.
        </p>
      ) : (
        <ul className="divide-y divide-line-200 border border-line-200 bg-paper-0">
          {rows.map((r) => {
            const status = (r.status as string) ?? "new";
            const label = STATUS_LABEL[status]?.minister ?? "Received";
            const question = (r.question as string | null) ?? (r.minister_summary as string | null) ?? "Request";
            return (
              <li key={r.id}>
                <Link
                  to="/console/$code/requests/$id"
                  params={{ code, id: r.id as string }}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 p-5 hover:bg-paper-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-serif text-lg text-ink-950">{question}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                      Sent {new Date(r.submitted_at as string).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="shrink-0 border border-line-200 px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-ink-500">
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
