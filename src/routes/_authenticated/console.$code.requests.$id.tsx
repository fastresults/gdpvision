// Request detail — country-user reader. Mirrors the concierge reader but
// under the /console/$code path with the impersonation-safe layout.
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, Clock, FileText } from "lucide-react";

import { getRequest } from "@/lib/concierge/concierge.functions";
import { STATUS_LABEL } from "@/lib/concierge/minister-lexicon";

const detailQuery = (id: string) =>
  queryOptions({
    queryKey: ["console-request", id],
    queryFn: () => getRequest({ data: { id } }),
    refetchInterval: 15_000,
  });

export const Route = createFileRoute("/_authenticated/console/$code/requests/$id")({
  head: () => ({
    meta: [
      { title: "Request — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(detailQuery(params.id));
    return null;
  },
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-2xl">Something went wrong.</h1>
      <p className="mt-2 text-sm text-ink-500">{error.message}</p>
      <button onClick={reset} className="mt-4 text-sm underline">Try again</button>
    </div>
  ),
  notFoundComponent: () => <div>Request not found.</div>,
  component: RequestReader,
});

const STEP_ORDER = ["new", "triaged", "in_progress", "review", "ready", "delivered"] as const;

function RequestReader() {
  const { code, id } = Route.useParams();
  const { data } = useSuspenseQuery(detailQuery(id));

  if (!data.request) return <div>Request not found.</div>;

  const req = data.request as Record<string, unknown>;
  const question = (req.question as string | null) ?? (req.minister_summary as string | null) ?? "Request";
  const shape = (req.deliverable_shape as string | null) ?? null;
  const when = (req.when_needed as string | null) ?? null;
  const built = ((req.built_on as string[] | null) ?? []) as string[];
  const status = (req.status as string) ?? "new";
  const currentIdx = STEP_ORDER.indexOf(status as (typeof STEP_ORDER)[number]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to="/console/$code/requests"
        params={{ code }}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft size={12} /> All requests
      </Link>

      <h1 className="mt-6 font-serif text-4xl leading-tight text-ink-950">{question}</h1>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
        Sent {new Date(req.submitted_at as string).toLocaleString()} ·{" "}
        {STATUS_LABEL[status]?.minister ?? "Received"}
      </p>

      {/* Progress rail */}
      <ol className="mt-10 grid gap-3 border border-line-200 bg-paper-0 p-6 sm:grid-cols-6">
        {STEP_ORDER.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const Icon = done ? CheckCircle2 : active ? Clock : Circle;
          return (
            <li key={s} className="flex items-center gap-2">
              <Icon size={14} className={done ? "text-gold-500" : active ? "text-ink-950" : "text-ink-500/50"} />
              <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${active ? "text-ink-950" : "text-ink-500"}`}>
                {STATUS_LABEL[s]?.minister ?? s}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Details */}
      <section className="mt-10 grid gap-6 md:grid-cols-2">
        {shape && (
          <div className="border border-line-200 bg-paper-0 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Form</p>
            <p className="mt-2 font-serif text-base text-ink-950">{shape}</p>
          </div>
        )}
        {when && (
          <div className="border border-line-200 bg-paper-0 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Timing</p>
            <p className="mt-2 font-serif text-base text-ink-950">{when}</p>
          </div>
        )}
        {built.length > 0 && (
          <div className="border border-line-200 bg-paper-0 p-5 md:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Context</p>
            <ul className="mt-2 space-y-1 text-sm text-ink-950">
              {built.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </div>
        )}
      </section>

      {/* Deliverables */}
      <section className="mt-10">
        <h2 className="mb-4 font-serif text-2xl text-ink-950">Deliverables</h2>
        {data.deliverables.length === 0 ? (
          <p className="border border-dashed border-line-200 p-8 text-center text-sm text-ink-500">
            Your team is working on this. Materials will appear here when ready.
          </p>
        ) : (
          <ul className="divide-y divide-line-200 border border-line-200 bg-paper-0">
            {data.deliverables.map((d) => {
              const del = d as Record<string, unknown>;
              return (
                <li key={del.id as string} className="flex items-start gap-4 p-5">
                  <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-500">
                    <FileText size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-base text-ink-950">
                      {(del.title as string | null) ?? "Deliverable"}
                    </p>
                    {del.summary ? (
                      <p className="mt-1 text-sm text-ink-500">{del.summary as string}</p>
                    ) : null}
                    {del.url ? (
                      <a
                        href={del.url as string}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 underline"
                      >
                        Open →
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Timeline */}
      {data.events.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-serif text-2xl text-ink-950">Timeline</h2>
          <ol className="space-y-3">
            {data.events.map((e) => {
              const ev = e as Record<string, unknown>;
              return (
                <li key={ev.id as string} className="flex items-start gap-4 border-l border-line-200 pl-4">
                  <div className="flex-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                      {new Date(ev.created_at as string).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm text-ink-950">
                      {(ev.summary as string | null) ?? (ev.kind as string)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
