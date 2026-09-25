// The Brief — the country user's first screen. Executive dashboard first:
// what requires a decision today, then the standing of all eight chambers.
// Sovereign Eye sits between the dashboard and the request lanes — the same
// structural position it occupies in the admin ChambersLauncher. The request
// lanes live one tap away under Study.

import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Radar } from "lucide-react";
import { Suspense } from "react";

import { getConsoleStudy } from "@/lib/console/console.functions";
import { ExecutiveDashboard, ExecutiveSkeleton } from "@/components/executive/ExecutiveDashboard";

const studyQuery = (code: string) =>
  queryOptions({
    queryKey: ["console-study", code],
    queryFn: () => getConsoleStudy({ data: { country_code: code } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/_authenticated/console/$code/")({
  head: ({ params }) => ({
    meta: [
      { title: `Your brief · ${params.code} — GDPVision` },
      {
        name: "description",
        content: `Today's decisions and the standing of all eight chambers for ${params.code}.`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="border border-line-200 p-6 text-sm text-[var(--signal-negative)]">
      {error.message}
    </div>
  ),
  component: BriefPage,
});

const DONE_STATUSES = new Set(["delivered", "accepted", "closed"]);

function RequestLanes({ code }: { code: string }) {
  const { data } = useQuery(studyQuery(code));
  const requests = data?.requests ?? [];
  const inFlight = requests.filter((r) => !DONE_STATUSES.has(r.status)).length;
  const delivered = requests.length - inFlight;

  return (
    <Link
      to="/console/$code/study"
      params={{ code }}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-line-200 bg-card px-4 py-3 transition-colors hover:bg-paper-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500 print:hidden"
    >
      <span className="min-w-0">
        <span className="block font-mono text-[9px] uppercase tracking-[0.24em] text-ink-500">
          Your requests
        </span>
        <span className="mt-1 block font-serif text-[17px] text-ink-950">
          <span data-numeric>{inFlight}</span> in flight ·{" "}
          <span data-numeric>{delivered}</span> delivered
        </span>
      </span>
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
        See all →
      </span>
    </Link>
  );
}

function SovereignEyeTile({ code }: { code: string }) {
  return (
    <Link
      to="/admin/countries/$code/godseye"
      params={{ code }}
      className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 border border-line-200 bg-card px-5 py-4 transition hover:border-ink-950 hover:bg-paper-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
    >
      <span className="grid h-11 w-11 place-items-center border border-line-200 bg-paper-50 text-ink-800 transition group-hover:border-ink-950">
        <Radar size={18} strokeWidth={1.5} />
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
          Strategic map
        </span>
        <span className="mt-1 block truncate font-serif text-[22px] leading-tight text-ink-950">
          Sovereign Eye
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-500">
          Corpus evidence, capital flows, live conditions and saved scenes in one map room.
        </span>
      </span>
      <ArrowUpRight
        size={18}
        strokeWidth={1.5}
        className="shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-950"
      />
    </Link>
  );
}

// Same structural position as the admin ChambersLauncher's syndication row:
// evidence audit → investor-ready pipeline → the investor register.
type SyndicationTo =
  | "/admin/countries/$code/standards"
  | "/admin/countries/$code/investments"
  | "/admin/countries/$code/investors";

const SYNDICATION: Array<{ title: string; blurb: string; to: SyndicationTo }> = [
  {
    title: "Data standards audit",
    blurb:
      "Coverage against IMF, UN, World Bank, FATF and PEFA requirements, and the plans that close each gap.",
    to: "/admin/countries/$code/standards",
  },
  {
    title: "Investment pipeline",
    blurb:
      "Projects in one standard format, checked for investor readiness and approved by a second person.",
    to: "/admin/countries/$code/investments",
  },
  {
    title: "Investors",
    blurb: "Who is interested in what, how far each conversation has gone, and what happens next.",
    to: "/admin/countries/$code/investors",
  },
];

function SyndicationRow({ code }: { code: string }) {
  return (
    <section>
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
        Standards and investment
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        {SYNDICATION.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            params={{ code }}
            className="group flex items-start justify-between gap-3 border border-line-200 bg-card px-4 py-3 transition hover:border-ink-950 hover:bg-paper-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
          >
            <span className="min-w-0">
              <span className="block font-serif text-[16px] leading-snug text-ink-950">
                {l.title}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-500">
                {l.blurb}
              </span>
            </span>
            <ArrowUpRight
              size={14}
              strokeWidth={1.5}
              className="mt-1 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-950"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

function BriefPage() {
  const { code } = Route.useParams();
  return (
    <div className="space-y-6">
      <Suspense fallback={<ExecutiveSkeleton />}>
        <ExecutiveDashboard code={code} />
      </Suspense>
      <SovereignEyeTile code={code} />
      <SyndicationRow code={code} />
      <RequestLanes code={code} />
    </div>
  );
}
