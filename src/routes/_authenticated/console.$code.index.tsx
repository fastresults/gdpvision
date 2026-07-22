// The Study — country user's home. Everything they need, no chambers.

import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, FileText, Inbox, Sparkles } from "lucide-react";

import { getConsoleStudy } from "@/lib/console/console.functions";
import { STATUS_LABEL } from "@/lib/concierge/minister-lexicon";

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

function StudyPage() {
  const { code } = Route.useParams();
  const { data } = useSuspenseQuery(studyQuery(code));

  const inFlight = data.requests.filter(
    (r) => !["delivered", "accepted", "closed"].includes(r.status),
  );
  const done = data.requests.filter((r) =>
    ["delivered", "accepted", "closed"].includes(r.status),
  );

  return (
    <div className="space-y-16">
      {/* Masthead */}
      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <h1 className="mt-3 font-serif text-5xl leading-tight text-ink-950">
          Good day{data.country.name ? `, ${data.country.name}` : ""}.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-500">
          {inFlight.length === 0 && data.waiting.length === 0
            ? "Nothing on your desk right now. When you have a question or need something drafted, our team is on call."
            : (() => {
                const parts: string[] = [];
                if (inFlight.length) parts.push(`${inFlight.length} request${inFlight.length === 1 ? "" : "s"} in progress`);
                if (data.waiting.length) parts.push(`${data.waiting.length} waiting for you`);
                return parts.join(" · ");
              })()}
        </p>
      </section>

      {/* Ask panel */}
      <section className="relative overflow-hidden border border-ink-950 bg-paper-0">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="relative grid gap-8 p-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-500">
              Start something
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-tight text-ink-950">
              What do you need today?
            </h2>
            <p className="mt-3 max-w-lg text-ink-500">
              Describe it in your own words — an ask, a decision you're weighing, remarks you need
              drafted. Our team will handle it and bring it back to you.
            </p>
          </div>
          <Link
            to="/console/$code/request/new"
            params={{ code }}
            className="btn-primary px-6 py-3 text-sm uppercase tracking-[0.15em]"
          >
            <Sparkles size={16} /> Start a request
          </Link>
        </div>
        {data.ministries.length > 0 && (
          <div className="border-t border-line-200 bg-paper-50 px-10 py-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Starting prompts
            </p>
            <div className="flex flex-wrap gap-2">
              {data.ministries.slice(0, 4).map((m) => (
                <Link
                  key={m.id}
                  to="/console/$code/request/new"
                  params={{ code }}
                  search={{ seed: `A brief on where ${m.name} stands right now` } as never}
                  className="rounded-full border border-line-200 bg-paper-0 px-4 py-2 text-xs text-ink-500 hover:border-ink-950 hover:text-ink-950"
                >
                  A brief on {m.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

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

      {/* In flight */}
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
        {inFlight.length === 0 ? (
          <p className="border border-dashed border-line-200 p-8 text-center text-sm text-ink-500">
            Nothing in progress. Start a request whenever you're ready.
          </p>
        ) : (
          <ul className="divide-y divide-line-200 border border-line-200 bg-paper-0">
            {inFlight.slice(0, 6).map((r) => {
              const label = STATUS_LABEL[r.status]?.minister ?? "Received";
              return (
                <li key={r.id}>
                  <Link
                    to="/console/$code/requests/$id"
                    params={{ code, id: r.id }}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 p-5 hover:bg-paper-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-serif text-base text-ink-950">{r.question}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                        Sent {new Date(r.submitted_at).toLocaleDateString()}
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
      </section>

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

      {done.length > 0 && (
        <section>
          <h2 className="mb-4 font-serif text-2xl text-ink-950">Recently delivered</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {done.slice(0, 4).map((r) => (
              <li key={r.id}>
                <Link
                  to="/console/$code/requests/$id"
                  params={{ code, id: r.id }}
                  className="block border border-line-200 bg-paper-0 p-4 hover:border-ink-950"
                >
                  <div className="flex items-center gap-2 text-ink-500">
                    <FileText size={14} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
                      {STATUS_LABEL[r.status]?.minister ?? r.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 font-serif text-base text-ink-950">
                    {r.question}
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
