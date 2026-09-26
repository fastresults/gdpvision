// A Sector Development Plan as a document, for reading and printing. No chamber chrome: a
// small toolbar that never prints. The protected server function is called
// from the component, never from the loader.

import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PRD_META } from "@/components/egov/labels";
import { PrdDocument } from "@/components/egov/PrdDocument";
import { buildBrandTokens } from "@/lib/egov/brand";
import { getPlan } from "@/lib/sector/plan.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute(
  "/_authenticated/admin/countries/$code/sector_/$planId_/document",
)({
  head: ({ params }) => ({
    meta: [
      { title: `Sector plan document · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlanDocumentPage,
});

function PlanDocumentPage() {
  const { code, planId } = Route.useParams();
  const fetchPlan = useServerFn(getPlan);
  const q = useQuery({
    queryKey: ["sector-plan", code, planId],
    queryFn: () => fetchPlan({ data: { code, planId } }),
  });
  const d = q.data;
  const brand = buildBrandTokens(code);

  useEffect(() => {
    if (!d) return;
    document.title = `${d.plan.title} — Sector plan v${d.plan.version}`;
  }, [d]);

  return (
    <div className="min-h-screen bg-paper-0 text-ink-950 print:min-h-0">
      <div className="sticky top-0 z-10 border-b border-line-200 bg-paper-0 print:hidden">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link
            to="/admin/countries/$code/sector/$planId"
            params={{ code, planId }}
            className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-500 hover:text-ink-950"
          >
            ← Back to the plan
          </Link>
          {d ? (
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 text-[13px]">
              <span className="truncate text-ink-950">{d.plan.title}</span>
              <span className="text-ink-500">v{d.plan.version}</span>
              <span
                className={cn(
                  "font-mono text-[10px] uppercase tracking-[0.16em]",
                  PRD_META[d.plan.status].text,
                )}
              >
                {PRD_META[d.plan.status].label}
              </span>
            </div>
          ) : null}
          <button
            type="button"
            className="btn-primary ml-auto px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em]"
            onClick={() => window.print()}
            disabled={!d}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <main className="px-4 py-8 sm:px-6 print:p-0">
        {q.isLoading ? (
          <p className="mx-auto max-w-[8.5in] text-[13px] text-ink-500">Loading…</p>
        ) : null}
        {q.error ? (
          <p className="mx-auto max-w-[8.5in] text-[13px] text-signal-negative">
            {(q.error as Error).message}
          </p>
        ) : null}
        {d ? (
          <PrdDocument
            title={d.plan.title}
            countryName={d.countryName}
            version={d.plan.version}
            status={PRD_META[d.plan.status].label}
            approvedAt={d.plan.approved_at}
            platformName={`${d.sectorLabel}${d.plan.scope.lead_ministry ? ` · ${d.plan.scope.lead_ministry}` : ""}`}
            accent={brand.accent}
            border={brand.borders[0] ?? brand.ink}
            kind="Sector Development Plan"
            sections={d.sections}
          />
        ) : null}
      </main>
    </div>
  );
}
