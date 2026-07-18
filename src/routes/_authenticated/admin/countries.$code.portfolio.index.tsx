import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listMinistries } from "@/lib/scenarios.functions";

function ministriesQuery(code: string) {
  return queryOptions({
    queryKey: ["portfolio-ministries", code],
    queryFn: () => listMinistries({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/portfolio/")({
  head: ({ params }) => ({
    meta: [
      { title: `Portfolios · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortfolioIndex,
});

function PortfolioIndex() {
  const { code } = Route.useParams();
  const { data: ministries } = useSuspenseQuery(ministriesQuery(code));
  const first = ministries[0];

  return (
    <div className="grid min-h-[60dvh] place-items-center px-8 py-16">
      <div className="max-w-md text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
          Chamber 02
        </p>
        <h2 className="mt-3 font-serif text-2xl text-ink-950">
          Select a portfolio to open its workspace
        </h2>
        <p className="mt-3 text-sm text-ink-500">
          Each ministry rolls up its assigned sectors, headline KPIs, and rehearsal scenarios into
          a single workspace.
        </p>
        {first && (
          <Link
            to="/admin/countries/$code/portfolio/$ministry"
            params={{ code, ministry: first.slug }}
            className="mt-6 inline-flex items-center gap-2 border border-ink-950 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:bg-ink-950 hover:text-paper-0"
          >
            Open {first.name} →
          </Link>
        )}
      </div>
    </div>
  );
}
