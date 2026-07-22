// Requests list — country user's ledger of asks. Plain-language types and
// live elapsed-time chips. No chamber vocabulary.
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listMyRequests } from "@/lib/concierge/concierge.functions";
import { LEXICON, STATUS_LABEL, type ChamberId } from "@/lib/concierge/minister-lexicon";
import { elapsedLabel, elapsedTone, turnaroundLabel } from "@/lib/concierge/elapsed";

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

type Filter = "all" | "in_flight" | "delivered";

function RequestsList() {
  const { code } = Route.useParams();
  const { data: rows } = useSuspenseQuery(listQuery(code));
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = rows.filter((r) => {
    const s = (r.status as string) ?? "new";
    if (filter === "in_flight") return !["delivered", "accepted", "closed"].includes(s);
    if (filter === "delivered") return ["delivered", "accepted", "closed"].includes(s);
    return true;
  });

  return (
    <div className="pb-24 sm:pb-0">
      <div className="mb-6 flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
        <h1 className="font-serif text-3xl text-ink-950 sm:text-4xl">Requests</h1>
        <Link
          to="/console/$code/request/new"
          params={{ code }}
          className="btn-primary hidden px-5 py-2.5 text-xs uppercase tracking-[0.15em] sm:inline-flex"
        >
          Start a request
        </Link>
      </div>

      <div className="mb-6 hstrip sm:flex-wrap">
        {(
          [
            ["all", `All (${rows.length})`],
            ["in_flight", `In flight (${rows.filter((r) => !["delivered", "accepted", "closed"].includes((r.status as string) ?? "")).length})`],
            ["delivered", `Delivered (${rows.filter((r) => ["delivered", "accepted", "closed"].includes((r.status as string) ?? "")).length})`],
          ] as Array<[Filter, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={
              filter === k
                ? "card-choice-active inline-flex items-center px-4 text-xs uppercase tracking-[0.15em]"
                : "card-choice inline-flex items-center px-4 text-xs uppercase tracking-[0.15em]"
            }
          >
            {label}
          </button>
        ))}
      </div>


      {filtered.length === 0 ? (
        <p className="border border-dashed border-line-200 p-10 text-center text-sm text-ink-500">
          {filter === "all"
            ? "You haven't sent anything yet. Start a request whenever you're ready."
            : filter === "in_flight"
              ? "Nothing in progress."
              : "Nothing delivered yet."}
        </p>
      ) : (
        <ul className="divide-y divide-line-200 border border-line-200 bg-paper-0">
          {filtered.map((r) => {
            const status = (r.status as string) ?? "new";
            const label = STATUS_LABEL[status]?.minister ?? "Received";
            const question =
              (r.question as string | null) ?? (r.minister_summary as string | null) ?? "Request";
            const chamber = r.internal_chamber as ChamberId | null;
            const typeLabel = chamber ? LEXICON[chamber]?.ministerLabel : "Request";
            const submittedAt = r.submitted_at as string;
            const deliveredAt = (r.delivered_at as string | null) ?? (r.accepted_at as string | null);
            const done = ["delivered", "accepted", "closed"].includes(status);
            const tone = elapsedTone(status, submittedAt);
            const timeChip = done
              ? turnaroundLabel(submittedAt, deliveredAt) ?? `Closed · ${elapsedLabel(submittedAt)} ago`
              : `In flight · ${elapsedLabel(submittedAt)}`;
            const timeColor = done
              ? "text-[var(--signal-positive)]"
              : tone === "overdue"
                ? "text-[var(--signal-caution)]"
                : "text-ink-500";
            return (
              <li key={r.id as string}>
                <Link
                  to="/console/$code/requests/$id"
                  params={{ code, id: r.id as string }}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 p-5 hover:bg-paper-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-serif text-lg text-ink-950">{question}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                      <span>{typeLabel}</span>
                      <span>·</span>
                      <span>{label}</span>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] ${timeColor}`}
                  >
                    {timeChip}
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
