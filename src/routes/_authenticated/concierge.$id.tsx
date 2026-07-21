import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Clock, FileText, ArrowLeft } from "lucide-react";

import { getRequest } from "@/lib/concierge/concierge.functions";
import { LEXICON, type ChamberId } from "@/lib/concierge/minister-lexicon";

export const Route = createFileRoute("/_authenticated/concierge/$id")({
  loader: async ({ params }) => {
    return await getRequest({ data: { id: params.id } });
  },
  head: ({ loaderData }) => {
    const q =
      (loaderData?.request as { question?: string } | null)?.question ??
      (loaderData?.request as { minister_summary?: string } | null)?.minister_summary ??
      "Request";
    return {
      meta: [
        { title: `${q} · The Concierge` },
        { name: "description", content: "A request in progress with your team." },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-xl p-12">
      <h1 className="font-serif text-2xl">Something went wrong.</h1>
      <p className="mt-2 text-sm text-ink-500">{error.message}</p>
      <button onClick={reset} className="mt-4 text-sm underline">Try again</button>
    </div>
  ),
  notFoundComponent: () => <div className="p-12">Request not found.</div>,
  component: RequestReader,
});

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

function RequestReader() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey: ["concierge", "request", id],
      queryFn: () => getRequest({ data: { id } }),
      refetchInterval: 15000,
    }),
  );

  if (!data.request) return <div className="p-12">Request not found.</div>;

  const req = data.request as Record<string, unknown>;
  const card = {
    question: (req.question as string | null) ?? "",
    why_it_matters: (req.why_it_matters as string | null) ?? "",
    deliverable_shape: (req.deliverable_shape as string | null) ?? "",
    built_on: ((req.built_on as string[] | null) ?? []) as string[],
    when_needed: (req.when_needed as string | null) ?? "",
  };
  const chamber = (req.internal_chamber as ChamberId | null) ?? null;
  const lex = chamber ? LEXICON[chamber] : null;
  const status = (req.status as string) ?? "new";

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <Link
        to="/concierge"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft size={12} /> The Concierge
      </Link>

      {/* The card */}
      <article className="mt-6 border border-line-200 bg-white p-10 shadow-sm">
        {lex && (
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
            {lex.laneLabel} · {lex.requestShapeShort}
          </p>
        )}
        <h1 className="mt-3 font-serif text-3xl leading-tight text-ink-950">
          {card.question || (req.minister_summary as string) || "Untitled request"}
        </h1>

        {card.why_it_matters && (
          <section className="mt-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Why it matters</p>
            <p className="mt-2 font-serif text-lg leading-relaxed text-ink-700">{card.why_it_matters}</p>
          </section>
        )}
        {card.deliverable_shape && (
          <section className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">What you'll get back</p>
            <p className="mt-2 font-serif text-lg text-ink-950">{card.deliverable_shape}</p>
          </section>
        )}
        {(card.built_on ?? []).length > 0 && (
          <section className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Built on</p>
            <ul className="mt-2 space-y-1">
              {(card.built_on ?? []).map((b, i) => (
                <li key={i} className="font-serif text-base text-ink-700">— {b}</li>
              ))}
            </ul>
          </section>
        )}
        {card.when_needed && (
          <section className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Timing</p>
            <p className="mt-2 font-serif text-lg text-ink-950">{card.when_needed}</p>
          </section>
        )}
      </article>

      {/* Deliverables */}
      {data.deliverables.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-2xl text-ink-950">Ready for you</h2>
          <ul className="mt-4 space-y-3">
            {data.deliverables.map((d) => (
              <li key={d.id as string} className="border border-line-200 bg-card p-5">
                <div className="flex items-start gap-3">
                  <FileText size={18} className="mt-1 text-ink-500" strokeWidth={1.5} />
                  <div className="flex-1">
                    <h3 className="font-serif text-lg text-ink-950">{d.title as string}</h3>
                    {d.delivered_at ? (
                      <p className="mt-1 text-xs text-ink-500">
                        Delivered {new Date(d.delivered_at as string).toLocaleString()}
                      </p>
                    ) : null}
                    <div className="prose prose-sm mt-4 max-w-none whitespace-pre-wrap font-serif text-ink-700">
                      {d.minister_body_md as string}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Timeline */}
      <section className="mt-12">
        <h2 className="font-serif text-2xl text-ink-950">The thread</h2>
        <ol className="mt-6 border-l border-line-200 pl-6">
          <TimelineNode
            active
            label={STATUS_LABEL[status] ?? status}
            when={req.submitted_at as string | null}
            status={status}
          />
          {data.events
            .filter((e) => (e.minister_summary as string | null))
            .map((e) => (
              <TimelineNode
                key={e.id as string}
                label={(e.minister_summary as string) ?? (e.event_type as string)}
                when={e.created_at as string | null}
                status="event"
              />
            ))}
        </ol>
      </section>
    </div>
  );
}

function TimelineNode({
  label, when, status, active,
}: { label: string; when: string | null; status: string; active?: boolean }) {
  const Icon =
    status === "delivered" || status === "accepted"
      ? CheckCircle2
      : status === "in_progress" || status === "review"
      ? Clock
      : Circle;
  return (
    <li className="relative mb-6 last:mb-0">
      <span className={`absolute -left-[31px] top-0.5 grid h-5 w-5 place-items-center rounded-full border ${active ? "border-ink-950 bg-white" : "border-line-300 bg-paper-50"}`}>
        <Icon size={11} className={status === "delivered" ? "text-emerald-600" : status === "in_progress" ? "text-amber-600" : "text-ink-500"} />
      </span>
      <p className="font-serif text-base text-ink-950">{label}</p>
      {when && (
        <time className="mt-0.5 block text-[11px] text-ink-500" dateTime={when}>
          {new Date(when).toLocaleString()}
        </time>
      )}
    </li>
  );
}
