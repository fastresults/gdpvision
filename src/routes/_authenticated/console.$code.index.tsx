// The Study — country user's dashboard. Plain-language lanes, elapsed-time
// tracking on every card, no chamber vocabulary anywhere.

import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, Clock, FileText, Inbox, AlertTriangle } from "lucide-react";

import { getConsoleStudy, type ConsoleRequest } from "@/lib/console/console.functions";
import { STATUS_LABEL } from "@/lib/concierge/minister-lexicon";
import { elapsedLabel, elapsedTone, turnaroundLabel } from "@/lib/concierge/elapsed";
import { StudyComposer } from "@/components/console/StudyComposer";

const studyQuery = (code: string) =>
  queryOptions({
    queryKey: ["console-study", code],
    queryFn: () => getConsoleStudy({ data: { country_code: code } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/_authenticated/console/$code/")({
  head: () => ({
    meta: [
      { title: "Your study — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(studyQuery(params.code));
    return null;
  },
  component: StudyPage,
});

function ElapsedChip({ r }: { r: ConsoleRequest }) {
  const done = ["delivered", "accepted", "closed"].includes(r.status);
  if (done) {
    const t = turnaroundLabel(r.submitted_at, r.delivered_at ?? r.accepted_at);
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--signal-positive)]">
        {t ?? `Closed · ${elapsedLabel(r.submitted_at)} ago`}
      </span>
    );
  }
  const tone = elapsedTone(r.status, r.submitted_at);
  const color =
    tone === "overdue"
      ? "text-[var(--signal-caution)]"
      : tone === "steady"
        ? "text-ink-950"
        : "text-ink-500";
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.18em] ${color}`}>
      In flight · {elapsedLabel(r.submitted_at)}
    </span>
  );
}

function StudyPage() {
  const { code } = Route.useParams();
  const { data } = useSuspenseQuery(studyQuery(code));

  const activeLanes = data.lanes.filter((l) => l.in_flight.length > 0);
  const emptyLanes = data.lanes.filter((l) => l.in_flight.length === 0);

  return (
    <div className="space-y-8 sm:space-y-14">
      {/* Masthead */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500 sm:text-[11px]">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-ink-950 sm:text-5xl">
          Good day{data.country.name ? `, ${data.country.name}` : ""}.
        </h1>
      </section>

      {/* Attention band — snap strip on mobile, 3-col grid on ≥sm */}
      <section className="hstrip sm:grid sm:grid-cols-3 sm:gap-3">
        <Link
          to="/console/$code/requests"
          params={{ code }}
          className="group flex min-w-[75%] items-start gap-4 border border-line-200 bg-paper-0 p-4 hover:border-ink-950 sm:min-w-0 sm:block sm:p-5"
        >
          <div className="sm:hidden">
            <p className="font-serif text-3xl text-ink-950">{data.attention.ready_for_you}</p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[var(--gold-500)]">
              <Inbox size={14} />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em]">Ready for you</span>
            </div>
            <p className="mt-2 hidden font-serif text-3xl text-ink-950 sm:block">{data.attention.ready_for_you}</p>
            <p className="mt-1 text-sm text-ink-500">
              {data.attention.ready_for_you === 0 ? "Nothing waiting." : "Delivered and awaiting your read."}
            </p>
          </div>
        </Link>
        <Link
          to="/console/$code/requests"
          params={{ code }}
          className="group flex min-w-[75%] items-start gap-4 border border-line-200 bg-paper-0 p-4 hover:border-ink-950 sm:min-w-0 sm:block sm:p-5"
        >
          <div className="sm:hidden">
            <p className="font-serif text-3xl text-ink-950">{data.attention.in_flight}</p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-ink-950">
              <Clock size={14} />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em]">In flight</span>
            </div>
            <p className="mt-2 hidden font-serif text-3xl text-ink-950 sm:block">{data.attention.in_flight}</p>
            <p className="mt-1 text-sm text-ink-500">
              {data.attention.oldest_in_flight_at
                ? `Oldest ${elapsedLabel(data.attention.oldest_in_flight_at)}.`
                : "Nothing in progress."}
            </p>
          </div>
        </Link>
        <div
          className={`flex min-w-[75%] items-start gap-4 border p-4 sm:min-w-0 sm:block sm:p-5 ${
            data.attention.overdue > 0
              ? "border-[var(--signal-caution)] bg-paper-0"
              : "border-line-200 bg-paper-0"
          }`}
        >
          <div className="sm:hidden">
            <p className="font-serif text-3xl text-ink-950">{data.attention.overdue}</p>
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={`flex items-center gap-2 ${
                data.attention.overdue > 0 ? "text-[var(--signal-caution)]" : "text-ink-500"
              }`}
            >
              <AlertTriangle size={14} />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em]">Overdue</span>
            </div>
            <p className="mt-2 hidden font-serif text-3xl text-ink-950 sm:block">{data.attention.overdue}</p>
            <p className="mt-1 text-sm text-ink-500">
              {data.attention.overdue > 0
                ? "Older than three days. Our team has been flagged."
                : "Every request is within window."}
            </p>
          </div>
        </div>
      </section>

      {/* Composer — Ask the Second Brain or Send a request */}
      <StudyComposer
        code={code}
        turnaround={data.lanes[0]?.turnaroundLabel}
      />
      <div className="-mt-4 flex justify-end sm:-mt-8">
        <Link
          to="/console/$code/requests"
          params={{ code }}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
        >
          See everything in flight →
        </Link>
      </div>


      {/* Waiting for you */}
      {data.waiting.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-ink-950">Waiting for you</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              {data.waiting.length} unread
            </span>
          </div>
          <ul className="divide-y divide-line-200 border border-line-200 bg-paper-0">
            {data.waiting.map((w) => (
              <li key={w.id}>
                <Link
                  to="/console/$code/requests/$id"
                  params={{ code, id: w.request_id }}
                  className="group flex items-center justify-between gap-6 p-5 hover:bg-paper-50"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-500">
                      <Inbox size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-serif text-lg text-ink-950">{w.title}</p>
                      <p className="mt-1 line-clamp-1 text-sm text-ink-500">{w.question}</p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 group-hover:text-ink-950">
                    Open <ArrowUpRight size={12} className="inline" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* In-flight lanes by request type */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-ink-950">In flight</h2>
          <Link
            to="/console/$code/requests"
            params={{ code }}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
          >
            All requests →
          </Link>
        </div>

        {activeLanes.length === 0 ? (
          <p className="border border-dashed border-line-200 p-8 text-center text-sm text-ink-500">
            Nothing in progress. Start a request whenever you're ready.
          </p>
        ) : (
          <div className="space-y-6">
            {activeLanes.map((lane) => (
              <div key={lane.chamber} className="border border-line-200 bg-paper-0">
                <header className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b border-line-200 px-5 py-4">
                  <div className="min-w-0">
                    <h3 className="font-serif text-xl text-ink-950">{lane.label}</h3>
                    <p className="mt-0.5 text-sm text-ink-500">{lane.oneLiner}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    {lane.turnaroundLabel}
                  </span>
                </header>
                <ul className="divide-y divide-line-200">
                  {lane.in_flight.map((r) => (
                    <li key={r.id}>
                      <Link
                        to="/console/$code/requests/$id"
                        params={{ code, id: r.id }}
                        className="flex flex-col gap-2 px-5 py-4 hover:bg-paper-50 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
                      >
                        <div className="min-w-0">
                          <p className="font-serif text-base leading-snug text-ink-950 sm:truncate">{r.question}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                            {r.ministry && <span>{r.ministry}</span>}
                            <span>{STATUS_LABEL[r.status]?.minister ?? "Received"}</span>
                          </p>
                        </div>
                        <ElapsedChip r={r} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Empty lanes → prompts */}
      {emptyLanes.length > 0 && (
        <section>
          <h2 className="mb-4 font-serif text-2xl text-ink-950">Start something new</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {emptyLanes.map((lane) => (
              <Link
                key={lane.chamber}
                to="/console/$code/request/new"
                params={{ code }}
                search={{ seed: `A ${lane.label.toLowerCase()} on ` } as never}
                className="group border border-line-200 bg-paper-0 p-4 hover:border-ink-950"
              >
                <p className="font-serif text-base text-ink-950">{lane.label}</p>
                <p className="mt-1 text-sm text-ink-500">{lane.oneLiner}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 group-hover:text-ink-950">
                  {lane.turnaroundLabel} →
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Ministries + Cabinet */}
      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-4 font-serif text-2xl text-ink-950">Your ministries</h2>
          {data.ministries.length === 0 ? (
            <p className="border border-dashed border-line-200 p-6 text-sm text-ink-500">
              No ministries on file yet.
            </p>
          ) : (
            <ul className="divide-y divide-line-200 border border-line-200 bg-paper-0">
              {data.ministries.slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-center justify-between p-4">
                  <span className="font-serif text-base text-ink-950">{m.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    {m.open_count} open
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="mb-4 font-serif text-2xl text-ink-950">Next cabinet</h2>
          {data.cabinet_next ? (
            <div className="border border-line-200 bg-paper-0 p-6">
              <div className="flex items-center gap-3 text-ink-500">
                <CalendarDays size={18} />
                <p className="font-mono text-[11px] uppercase tracking-[0.2em]">
                  {new Date(data.cabinet_next.scheduled_for).toLocaleString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <p className="mt-3 font-serif text-lg text-ink-950">
                {data.cabinet_next.title ?? "Cabinet session"}
              </p>
              <p className="mt-2 text-sm text-ink-500">
                Your team will send briefing materials ahead of time.
              </p>
            </div>
          ) : (
            <p className="border border-dashed border-line-200 p-6 text-sm text-ink-500">
              No cabinet session scheduled.
            </p>
          )}
        </div>
      </section>

      {/* Recently delivered */}
      {data.delivered_recent.length > 0 && (
        <section>
          <h2 className="mb-4 font-serif text-2xl text-ink-950">Recently delivered</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {data.delivered_recent.slice(0, 6).map((r) => (
              <li key={r.id}>
                <Link
                  to="/console/$code/requests/$id"
                  params={{ code, id: r.id }}
                  className="block border border-line-200 bg-paper-0 p-4 hover:border-ink-950"
                >
                  <div className="flex items-center gap-2 text-ink-500">
                    <FileText size={14} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
                      {r.minister_label}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 font-serif text-base text-ink-950">
                    {r.question}
                  </p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--signal-positive)]">
                    {turnaroundLabel(r.submitted_at, r.delivered_at ?? r.accepted_at) ??
                      `Closed · ${elapsedLabel(r.submitted_at)} ago`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
