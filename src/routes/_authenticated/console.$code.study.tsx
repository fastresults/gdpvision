// The Study — country user's dashboard. Two lanes only: In-flight and
// Delivered. Sign out sits in the header. No launchers, no chamber grids,
// no extra CTAs — the bottom tab bar owns Ask and Send.

import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { getConsoleStudy, type ConsoleRequest } from "@/lib/console/console.functions";
import { STATUS_LABEL } from "@/lib/concierge/minister-lexicon";
import { elapsedLabel, elapsedTone, turnaroundLabel } from "@/lib/concierge/elapsed";
import { supabase } from "@/integrations/supabase/client";

const studyQuery = (code: string) =>
  queryOptions({
    queryKey: ["console-study", code],
    queryFn: () => getConsoleStudy({ data: { country_code: code } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/_authenticated/console/$code/study")({
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

const DONE_STATUSES = new Set(["delivered", "accepted", "closed"]);

function TimeChip({ r }: { r: ConsoleRequest }) {
  const done = DONE_STATUSES.has(r.status);
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

function RequestRow({ code, r }: { code: string; r: ConsoleRequest }) {
  return (
    <li>
      <Link
        to="/console/$code/requests/$id"
        params={{ code, id: r.id }}
        className="flex flex-col gap-2 p-4 hover:bg-paper-50 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:p-5"
      >
        <div className="min-w-0">
          <p className="font-serif text-base leading-snug text-ink-950 sm:truncate sm:text-lg">
            {r.question}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            <span>{r.minister_label}</span>
            <span>·</span>
            <span>{STATUS_LABEL[r.status]?.minister ?? "Received"}</span>
          </p>
        </div>
        <TimeChip r={r} />
      </Link>
    </li>
  );
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/auth";
}

function StudyPage() {
  const { code } = Route.useParams();
  const { data } = useSuspenseQuery(studyQuery(code));

  const inFlight = data.requests.filter((r) => !DONE_STATUSES.has(r.status));
  const delivered = data.requests
    .filter((r) => DONE_STATUSES.has(r.status))
    .sort((a, b) => {
      const at = a.delivered_at ?? a.accepted_at ?? a.submitted_at;
      const bt = b.delivered_at ?? b.accepted_at ?? b.submitted_at;
      return new Date(bt).getTime() - new Date(at).getTime();
    });

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
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
          <p className="mt-3 text-sm text-ink-500">
            {inFlight.length} in flight · {delivered.length} delivered
          </p>
          <Link
            to="/console/$code/mandate"
            params={{ code }}
            className="mt-3 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:text-ink-500"
          >
            → Mandate Compact
          </Link>
        </div>
        <button
          onClick={signOut}
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
        >
          Sign out
        </button>
      </section>

      {/* In-flight */}
      <section>
        <h2 className="mb-4 font-serif text-2xl text-ink-950">In flight</h2>
        {inFlight.length === 0 ? (
          <p className="border border-dashed border-line-200 p-8 text-center text-sm text-ink-500">
            Nothing in flight — tap <span className="font-mono uppercase tracking-[0.18em]">Send</span> to start a request.
          </p>
        ) : (
          <ul className="divide-y divide-line-200 border border-line-200 bg-paper-0">
            {inFlight.map((r) => (
              <RequestRow key={r.id} code={code} r={r} />
            ))}
          </ul>
        )}
      </section>

      {/* Delivered */}
      <section>
        <h2 className="mb-4 font-serif text-2xl text-ink-950">Delivered</h2>
        {delivered.length === 0 ? (
          <p className="border border-dashed border-line-200 p-8 text-center text-sm text-ink-500">
            No deliveries yet.
          </p>
        ) : (
          <ul className="divide-y divide-line-200 border border-line-200 bg-paper-0">
            {delivered.map((r) => (
              <RequestRow key={r.id} code={code} r={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
