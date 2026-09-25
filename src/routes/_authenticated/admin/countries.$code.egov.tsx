import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { MICRO, PRD_META, formatWhen } from "@/components/egov/labels";
import { NewPrdPanel } from "@/components/egov/NewPrdPanel";
import { Explain } from "@/components/explain/Explain";
import { deletePrd, listPrds, type PrdSummary } from "@/lib/egov/prd.functions";
import { cn } from "@/lib/utils";
import "@/lib/explain/egov-entries";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/egov")({
  head: ({ params }) => ({
    meta: [
      { title: `Digital Government Studio · ${params.code} — GDPVision` },
      {
        name: "description",
        content: `Product requirements for ${params.code}'s national e-government platform, written from the country's own corpus.`,
      },
      { property: "og:title", content: `Digital Government Studio · ${params.code}` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EgovPage,
});

function EgovPage() {
  const { code } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchList = useServerFn(listPrds);
  const remove = useServerFn(deletePrd);
  const q = useQuery({
    queryKey: ["egov-prds", code],
    queryFn: () => fetchList({ data: { code } }),
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = q.data;

  async function onDelete(p: PrdSummary) {
    setError(null);
    try {
      await remove({ data: { code, prdId: p.id } });
      await qc.invalidateQueries({ queryKey: ["egov-prds", code] });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Digital Government Studio" },
      ]}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className={MICRO}>{code} · Chamber 09</div>
          <h1 className="mt-1 font-display text-3xl text-ink-950">Digital Government Studio</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-700">
            The product requirements for a national e-government platform: ten sections written from
            this country's corpus, edited by people, approved by a second person, and exported to
            scaffold the platform's own repository.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/countries/$code/standards"
            params={{ code }}
            className="btn-ghost px-3 py-2 text-xs"
          >
            Standards audit
          </Link>
          {!creating && (
            <button
              type="button"
              className="btn-primary px-3 py-2 text-xs"
              onClick={() => setCreating(true)}
            >
              New PRD
            </button>
          )}
        </div>
      </div>

      {q.isLoading && <div className="h-24 animate-pulse bg-paper-50" aria-busy="true" />}

      {q.error && (
        <div className="border-l-2 border-signal-negative py-2 pl-4">
          <p className="text-sm text-signal-negative">
            The studio could not be loaded: {(q.error as Error).message}
          </p>
          <button
            type="button"
            className="btn-ghost -ml-2 mt-2 px-2 py-1 text-xs"
            onClick={() => q.refetch()}
          >
            Try again
          </button>
        </div>
      )}

      {data && creating && (
        <div className="mb-10">
          <NewPrdPanel
            code={code}
            countryName={data.countryName}
            onCancel={() => setCreating(false)}
            onCreated={(id) => {
              setCreating(false);
              void qc.invalidateQueries({ queryKey: ["egov-prds", code] });
              void navigate({
                to: "/admin/countries/$code/egov/$prdId",
                params: { code, prdId: id },
              });
            }}
          />
        </div>
      )}

      {data && !data.aiAvailable && (
        <p className="mb-6 border-l-2 border-signal-caution py-2 pl-4 text-sm text-ink-700">
          Drafting is unavailable on this server (the AI gateway key is not configured). Sections
          can still be written by hand.
        </p>
      )}

      {error && <p className="mb-4 text-sm text-signal-negative">{error}</p>}

      {data && data.prds.length === 0 && !creating && (
        <p className="border-l-2 border-line-200 py-6 pl-4 text-sm text-ink-500">
          No PRD yet for {data.countryName}. Start one to set the scope; the sections are drafted
          from there.
        </p>
      )}

      {data && data.prds.length > 0 && (
        <table className="w-full border-t border-line-200 text-sm">
          <thead>
            <tr className="text-left">
              {["Version", "Title", "Status", "Progress", "Updated", ""].map((h) => (
                <th key={h} className={cn(MICRO, "border-b border-line-200 py-2 pr-4 font-normal")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.prds.map((p) => {
              const meta = PRD_META[p.status];
              return (
                <tr key={p.id} className="border-b border-line-200 align-top">
                  <td className="py-3 pr-4 font-mono text-xs text-ink-500">v{p.version}</td>
                  <td className="py-3 pr-4">
                    <Link
                      to="/admin/countries/$code/egov/$prdId"
                      params={{ code, prdId: p.id }}
                      className="text-ink-950 underline decoration-line-200 underline-offset-4 hover:decoration-ink-950"
                    >
                      {p.title}
                    </Link>
                    {p.platform_name && (
                      <div className="text-xs text-ink-500">{p.platform_name}</div>
                    )}
                  </td>
                  <td className={cn("py-3 pr-4 text-xs", meta.text)}>
                    <span
                      className={cn(
                        "mr-1.5 inline-block h-1.5 w-1.5 rounded-full border",
                        meta.border,
                        p.status === "superseded" ? "" : "bg-current",
                      )}
                    />
                    {meta.label}
                  </td>
                  <td className="py-3 pr-4 text-xs tabular-nums text-ink-700">
                    <Explain
                      id="egov.prd.progress"
                      ctx={{ drafted: p.drafted, total: p.total, gaps: p.gaps, stale: p.stale }}
                    >
                      {p.drafted}/{p.total} drafted
                    </Explain>
                    {p.gaps > 0 && (
                      <span className="ml-2 text-signal-negative">
                        {p.gaps} gap{p.gaps === 1 ? "" : "s"}
                      </span>
                    )}
                    {p.stale > 0 && (
                      <span className="ml-2 text-signal-caution">{p.stale} out of date</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-ink-500">{formatWhen(p.updated_at)}</td>
                  <td className="py-3 text-right">
                    {(p.status === "draft" || p.status === "superseded") && (
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs"
                        onClick={() => onDelete(p)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </SuperAdminShell>
  );
}
