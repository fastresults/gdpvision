import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Plus, Clock, CheckCircle2, Circle, Inbox } from "lucide-react";

import { getMyCountryStatus } from "@/lib/country-admin.functions";
import { listMyRequests } from "@/lib/concierge/concierge.functions";
import { LEXICON, type ChamberId } from "@/lib/concierge/minister-lexicon";

export const Route = createFileRoute("/_authenticated/concierge/")({
  validateSearch: z.object({ country: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "The Concierge · GDPVision" },
      { name: "description", content: "Your requests to the office, organised by lane." },
      { property: "og:title", content: "The Concierge · GDPVision" },
      { property: "og:description", content: "Your requests to the office, organised by lane." },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-xl p-12">
      <h1 className="font-serif text-2xl">Something went wrong.</h1>
      <p className="mt-2 text-sm text-ink-500">{error.message}</p>
      <button onClick={reset} className="mt-4 text-sm underline">Try again</button>
    </div>
  ),
  notFoundComponent: () => <div className="p-12">Not found.</div>,
  component: ConciergeDashboard,
});

const statusQuery = queryOptions({
  queryKey: ["my-country-status"],
  queryFn: () => getMyCountryStatus(),
});

const laneOrder: ChamberId[] = ["ledger", "scenario", "fdi", "narrative", "cabinet", "portfolio", "persona"];

function ConciergeDashboard() {
  const { data: status } = useSuspenseQuery(statusQuery);
  const search = Route.useSearch();

  const countries = status.bindings;
  const [selected, setSelected] = useState<string>(
    () => search.country ?? countries.find((b) => b.is_default)?.country_code ?? countries[0]?.country_code ?? "",
  );

  const requestsQuery = useSuspenseQuery(
    queryOptions({
      queryKey: ["concierge", "mine", selected],
      queryFn: () => (selected ? listMyRequests({ data: { country_code: selected } }) : Promise.resolve([])),
      enabled: !!selected,
    }),
  );

  const countryName = useMemo(
    () => countries.find((b) => b.country_code === selected)?.name ?? selected,
    [countries, selected],
  );

  const byLane = useMemo(() => {
    const map: Record<ChamberId, typeof requestsQuery.data> = {
      ledger: [], scenario: [], fdi: [], narrative: [], cabinet: [], portfolio: [], persona: [],
    } as never;
    for (const r of requestsQuery.data ?? []) {
      const lane = (r.internal_chamber ?? "ledger") as ChamberId;
      if (!map[lane]) map[lane] = [] as never;
      (map[lane] as typeof requestsQuery.data).push(r);
    }
    return map;
  }, [requestsQuery.data]);

  if (!countries.length) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <h1 className="font-serif text-2xl">No country assigned.</h1>
        <p className="mt-3 text-sm text-ink-500">Ask your administrator to add you to a country.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-14">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line-200 pb-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500">The Concierge</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight text-ink-950">The Minister's Study</h1>
          <p className="mt-2 max-w-2xl text-ink-500">
            Everything you've asked your team to work on — organised by lane, current status on the right.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {countries.length > 1 && (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="border border-line-300 bg-transparent px-3 py-2 text-sm"
            >
              {countries.map((c) => (
                <option key={c.country_code} value={c.country_code}>
                  {c.name ?? c.country_code}
                </option>
              ))}
            </select>
          )}
          <Link
            to="/concierge/new"
            search={{ country: selected }}
            className="flex items-center gap-2 bg-ink-950 px-5 py-2.5 text-sm text-paper-50 hover:opacity-90"
          >
            <Plus size={16} /> New request
          </Link>
        </div>
      </header>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">{countryName}</p>

      {(requestsQuery.data ?? []).length === 0 ? (
        <EmptyState country={selected} />
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {laneOrder.map((lane) => {
            const items = byLane[lane] ?? [];
            if (items.length === 0) return null;
            return (
              <Lane key={lane} lane={lane} items={items} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ country }: { country: string }) {
  return (
    <div className="mt-14 border border-dashed border-line-300 p-16 text-center">
      <Inbox size={32} className="mx-auto text-ink-500" strokeWidth={1.2} />
      <h2 className="mt-6 font-serif text-2xl text-ink-950">Nothing on the desk yet.</h2>
      <p className="mt-3 text-ink-500">When you send us a request, it will appear here in its own lane.</p>
      <Link
        to="/concierge/new"
        search={{ country }}
        className="mt-6 inline-flex items-center gap-2 bg-ink-950 px-5 py-2.5 text-sm text-paper-50 hover:opacity-90"
      >
        <Plus size={16} /> Send your first request
      </Link>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  new: "Received",
  triaged: "Being reviewed",
  in_progress: "Team is on it",
  review: "In review",
  ready: "Almost ready",
  delivered: "Ready for you",
  accepted: "Accepted",
  revising: "Revising",
  closed: "Closed",
};

function Lane({ lane, items }: { lane: ChamberId; items: Array<Record<string, unknown>> }) {
  const entry = LEXICON[lane];
  return (
    <section>
      <div className={`bg-gradient-to-r ${entry.laneAccent} p-4 border-l-2 border-ink-950/70`}>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">{entry.requestShapeShort}</p>
        <h3 className="mt-1 font-serif text-xl text-ink-950">{entry.laneLabel}</h3>
      </div>
      <ul className="mt-3 space-y-3">
        {items.map((r) => {
          const id = r.id as string;
          const card = (r.request_card as { question?: string } | null) ?? {};
          const submittedAt = r.submitted_at as string | null;
          const status = (r.status as string) ?? "new";
          const delivered = status === "delivered" || status === "accepted";
          return (
            <li key={id}>
              <Link
                to="/concierge/$id"
                params={{ id }}
                className="group block border border-line-200 bg-card p-4 transition hover:border-ink-950 hover:shadow-sm"
              >
                <p className="line-clamp-3 font-serif text-base leading-snug text-ink-950">
                  {card.question || (r.minister_summary as string) || "Untitled request"}
                </p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-ink-500">
                  <span className="flex items-center gap-1.5">
                    {delivered ? (
                      <CheckCircle2 size={12} className="text-emerald-600" />
                    ) : status === "in_progress" || status === "review" ? (
                      <Clock size={12} className="text-amber-600" />
                    ) : (
                      <Circle size={12} />
                    )}
                    {STATUS_LABEL[status] ?? status}
                  </span>
                  {submittedAt && (
                    <time dateTime={submittedAt}>
                      {new Date(submittedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </time>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
