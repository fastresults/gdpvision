// Print view for one investor package version. Full-bleed document with a
// small toolbar that never prints. The protected server function is called
// from the component, not a loader (see AGENTS.md).

import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Explain } from "@/components/explain/Explain";
import { PackageDocument } from "@/components/investments/packages/PackageDocument";
import { getPackage } from "@/lib/investments/packages.functions";
import { PACKAGE_KIND_LABEL } from "@/lib/syndication/db";
import { cn } from "@/lib/utils";
import "@/lib/explain/packages-entries";

export const Route = createFileRoute(
  "/_authenticated/admin/countries/$code/investments/$id/package/$packageId",
)({
  head: ({ params }) => ({
    meta: [
      { title: `Investor package · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PackagePrintPage,
});

const STATUS_CLASS = {
  draft: "text-draft-state",
  approved: "text-signal-positive",
  superseded: "text-ink-400",
} as const;

function PackagePrintPage() {
  const { code, packageId } = Route.useParams();
  const fetchPackage = useServerFn(getPackage);
  const q = useQuery({
    queryKey: ["investment-package", code, packageId],
    queryFn: () => fetchPackage({ data: { code, packageId } }),
  });
  const pkg = q.data;

  // A sensible "Save as PDF" filename.
  useEffect(() => {
    if (!pkg) return;
    document.title = `${pkg.project_title} — ${PACKAGE_KIND_LABEL[pkg.kind]} v${pkg.version}`;
  }, [pkg]);

  return (
    <div className="min-h-screen bg-paper-0 text-ink-950 print:min-h-0">
      <div className="sticky top-0 z-10 border-b border-line-200 bg-paper-0 print:hidden">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link
            to="/admin/countries/$code/investments"
            params={{ code }}
            className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-500 hover:text-ink-950"
          >
            ← Investment pipeline
          </Link>
          {pkg ? (
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 text-[13px]">
              <span className="truncate text-ink-950">{pkg.project_title}</span>
              <span className="text-ink-500">
                {PACKAGE_KIND_LABEL[pkg.kind]} · v{pkg.version} · from project v
                {pkg.project_version}
              </span>
              <span
                className={cn(
                  "font-mono text-[10px] uppercase tracking-[0.16em]",
                  STATUS_CLASS[pkg.status],
                )}
              >
                {pkg.status}
              </span>
              {pkg.stale ? (
                <span className="text-signal-caution">
                  <Explain id="packages.stale">out of date</Explain>
                </span>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className="btn-primary ml-auto px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em]"
            onClick={() => window.print()}
            disabled={!pkg}
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
        {pkg ? <PackageDocument kind={pkg.kind} content={pkg.content} /> : null}
      </main>
    </div>
  );
}
