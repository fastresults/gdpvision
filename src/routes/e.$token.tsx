// The read-only page behind a PRD share link. No account, no platform
// navigation: the approved document and a markdown download.
//
// Path is /e/$token ("e-government"); /i/$token is the investor page.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PrdDocument } from "@/components/egov/PrdDocument";
import { getPublicPrd } from "@/lib/egov/public-prd.functions";

export const Route = createFileRoute("/e/$token")({
  head: () => ({
    meta: [
      { title: "Product requirements" },
      {
        name: "description",
        content: "A product requirements document shared with you by a government.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "referrer", content: "no-referrer" },
      { property: "og:title", content: "Product requirements" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicPrdPage,
});

function PublicPrdPage() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["public-prd", token],
    queryFn: () => getPublicPrd({ data: { token } }),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const d = q.data;

  function download() {
    if (!d) return;
    const blob = new Blob([d.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prd-${d.countryCode.toLowerCase()}-v${d.version}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-dvh bg-paper-0 text-ink-950">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-8">
        {q.isLoading && <p className="text-sm text-ink-500">Opening…</p>}
        {q.error && (
          <div className="border-l-2 border-l-gold-500 py-2 pl-4">
            <h1 className="font-display text-2xl text-ink-950">This link is not available</h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-700">
              It may have expired or been withdrawn. Please contact the person who sent it to you
              for a current link.
            </p>
          </div>
        )}
        {d && (
          <>
            <div className="prd-no-print mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line-200 pb-3 print:hidden">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                Shared by the Government of {d.countryName}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={download}>
                  Download markdown
                </button>
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5 text-xs"
                  onClick={() => window.print()}
                >
                  Print / Save as PDF
                </button>
              </div>
            </div>
            <PrdDocument
              title={d.title}
              countryName={d.countryName}
              version={d.version}
              status="Approved"
              approvedAt={d.approvedAt}
              platformName={d.platformName}
              accent={d.brand?.accent ?? "#B98A2F"}
              border={d.brand?.borders[0] ?? d.brand?.ink ?? "#111111"}
              sections={d.sections}
            />
          </>
        )}
      </div>
    </main>
  );
}
