import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { MICRO, PLAN_META, formatWhen } from "@/components/sector/labels";
import { NewPlanPanel } from "@/components/sector/NewPlanPanel";
import { SectorBoard } from "@/components/sector/SectorBoard";
import {
  deletePlan,
  getSectorStudio,
  setSectorPriority,
  type PlanSummary,
  type SectorSummary,
} from "@/lib/sector/plan.functions";
import { runScout } from "@/lib/sector/scout.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/sector")({
  head: ({ params }) => ({
    meta: [
      { title: `Sector Studio · ${params.code} — GDPVision` },
      {
        name: "description",
        content: `Sector development plans for ${params.code}: the Scout's shortlist, the national priorities, and a plan for each, written from the country's own corpus.`,
      },
      { property: "og:title", content: `Sector Studio · ${params.code}` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SectorStudioPage,
});

function SectorStudioPage() {
  const { code } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchStudio = useServerFn(getSectorStudio);
  const scout = useServerFn(runScout);
  const setPriority = useServerFn(setSectorPriority);
  const remove = useServerFn(deletePlan);
  const key = ["sector-studio", code];
  const q = useQuery({ queryKey: key, queryFn: () => fetchStudio({ data: { code } }) });

  const [starting, setStarting] = useState<SectorSummary | null>(null);
  const [scouting, setScouting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function onScout() {
    setScouting(true);
    setError(null);
    setNotice("The Scout is reading the corpus for every sector…");
    try {
      const r = await scout({ data: { code } });
      setNotice(
        `The Scout assessed ${r.sectors} sectors${r.recommended.length ? ` and recommends ${r.recommended.length}` : ""}. The choice is the Head of Government's.`,
      );
      await refresh();
    } catch (e) {
      setNotice(null);
      setError((e as Error).message);
    } finally {
      setScouting(false);
    }
  }

  async function onChoose(sector: string, rationale: string, exitRule: string) {
    await setPriority({ data: { action: "choose", code, sector, rationale, exitRule } });
    await refresh();
  }
  async function onRetire(sector: string, note: string) {
    await setPriority({ data: { action: "retire", code, sector, note } });
    await refresh();
  }
  async function onDelete(p: PlanSummary) {
    setError(null);
    try {
      await remove({ data: { code, planId: p.id } });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const labelOf = (s: string) => data?.sectors.find((x) => x.code === s)?.label ?? s;

  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Sector Studio" },
      ]}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className={MICRO}>{code} · Chamber 10</div>
          <h1 className="mt-1 font-display text-3xl text-ink-950">Sector Studio</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-700">
            From dossier to delivery. The Scout reads the corpus and ranks every sector; the Head of
            Government chooses up to four priorities; each gets a ten-section Sector Development
            Plan — diagnostic, targets, projects, Compact, Council charter and national
            sensitisation — approved by a second person and carried to Cabinet as a commitment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/countries/$code/investments"
            params={{ code }}
            className="btn-ghost px-3 py-2 text-xs"
          >
            Investments
          </Link>
          {data?.aiAvailable && (
            <button
              type="button"
              className="btn-primary px-3 py-2 text-xs"
              onClick={onScout}
              disabled={scouting}
            >
              {scouting ? "Scouting…" : data.scoutedAt ? "Re-run the Scout" : "Run the Scout"}
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

      {notice && (
        <p className="mb-4 border-l-2 border-gold-500 py-1 pl-3 text-sm text-ink-700">{notice}</p>
      )}
      {error && (
        <p className="mb-4 border-l-2 border-signal-negative py-1 pl-3 text-sm text-signal-negative">
          {error}
        </p>
      )}

      {data && !data.aiAvailable && (
        <p className="mb-6 border-l-2 border-signal-caution py-2 pl-4 text-sm text-ink-700">
          Drafting is unavailable on this server (the AI gateway key is not configured). Priorities
          can still be chosen and plans written by hand.
        </p>
      )}

      {data && starting && (
        <div className="mb-10">
          <NewPlanPanel
            code={code}
            countryName={data.countryName}
            sector={{ code: starting.code, label: starting.label }}
            ministries={data.ministries}
            onCancel={() => setStarting(null)}
            onCreated={(id) => {
              setStarting(null);
              void refresh();
              void navigate({
                to: "/admin/countries/$code/sector/$planId",
                params: { code, planId: id },
              });
            }}
          />
        </div>
      )}

      {data && (
        <>
          <p className="mb-4 text-xs text-ink-500">
            {data.scoutedAt
              ? `Scout last run ${formatWhen(data.scoutedAt)}${data.scoutModel ? ` · ${data.scoutModel}` : ""}.`
              : "The Scout has not been run for this country yet."}{" "}
            {data.capabilities.approve
              ? "You may choose and retire priorities."
              : "Priorities are chosen by the country admin or Cabinet Secretary."}
          </p>
          <SectorBoard
            code={code}
            sectors={data.sectors}
            plans={data.plans}
            canChoose={data.capabilities.approve}
            onChoose={onChoose}
            onRetire={onRetire}
            onStartPlan={(s) => setStarting(s)}
          />

          {data.plans.length > 0 && (
            <section className="mt-12" aria-labelledby="all-plans">
              <div id="all-plans" className={MICRO}>
                All plans
              </div>
              <table className="mt-2 w-full border-t border-line-200 text-sm">
                <thead>
                  <tr className="text-left">
                    {["Sector", "Version", "Title", "Status", "Progress", "Updated", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className={cn(MICRO, "border-b border-line-200 py-2 pr-4 font-normal")}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.plans.map((p) => {
                    const meta = PLAN_META[p.status];
                    return (
                      <tr key={p.id} className="border-b border-line-200 align-top">
                        <td className="py-3 pr-4 text-xs text-ink-700">{labelOf(p.sector_code)}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-ink-500">v{p.version}</td>
                        <td className="py-3 pr-4">
                          <Link
                            to="/admin/countries/$code/sector/$planId"
                            params={{ code, planId: p.id }}
                            className="text-ink-950 underline decoration-line-200 underline-offset-4 hover:decoration-ink-950"
                          >
                            {p.title}
                          </Link>
                          {p.commitment_id && (
                            <div className="text-xs text-ink-500">Cabinet commitment raised</div>
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
                          {p.approval_mode === "sole_admin" && (
                            <span className="block text-ink-500">sole approver</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-xs tabular-nums text-ink-700">
                          {p.drafted}/{p.total} drafted
                          {p.gaps > 0 && (
                            <span className="ml-2 text-signal-negative">
                              {p.gaps} gap{p.gaps === 1 ? "" : "s"}
                            </span>
                          )}
                          {p.stale > 0 && (
                            <span className="ml-2 text-signal-caution">{p.stale} out of date</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-xs text-ink-500">
                          {formatWhen(p.updated_at)}
                        </td>
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
            </section>
          )}
        </>
      )}
    </SuperAdminShell>
  );
}
