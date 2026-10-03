import { useCallback, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";

import { IdealProfileView } from "@/components/personas/portfolio/IdealProfileView";
import { MICRO } from "@/components/personas/portfolio/labels";
import {
  ApprovalBar,
  CabinetWeighting,
  ConvenePanel,
  ProposedSkills,
  SkillsPanel,
} from "@/components/personas/portfolio/Panels";
import { PersonaGrid } from "@/components/personas/portfolio/PersonaGrid";
import { RunRail } from "@/components/personas/portfolio/RunRail";
import { useRunLoop } from "@/components/personas/portfolio/useRunLoop";
import { askIdealMinister } from "@/lib/personas/portfolio/convene.functions";
import {
  REGIONAL,
  hasAggregates,
  hasProfile,
  isMatrix,
  officeNames,
  scopeLabel,
} from "@/lib/personas/portfolio/db";
import { deletePortfolioSet, getPortfolioSet } from "@/lib/personas/portfolio/studio.functions";
import { resynthesise } from "@/lib/personas/portfolio/run.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute(
  "/_authenticated/admin/countries/$code/personas/portfolios/$setId",
)({
  head: ({ params }) => ({
    meta: [
      { title: `Ideal Minister · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortfolioSetPage,
});

type Tab = "profile" | "personas" | "skills" | "cabinet" | "convene";

function PortfolioSetPage() {
  const { code, setId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchSet = useServerFn(getPortfolioSet);
  const ask = useServerFn(askIdealMinister);
  const remove = useServerFn(deletePortfolioSet);
  const again = useServerFn(resynthesise);
  const key = ["portfolio-set", code, setId];
  const q = useQuery({ queryKey: key, queryFn: () => fetchSet({ data: { code, setId } }) });
  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["portfolio-set", code, setId] });
  }, [qc, code, setId]);
  const loop = useRunLoop(setId, refresh);
  const [tab, setTab] = useState<Tab | null>(null);
  const [focusSkill, setFocusSkill] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const d = q.data;
  if (q.isLoading) return <div className="h-40 animate-pulse bg-paper-50" aria-busy="true" />;
  if (q.error || !d)
    return (
      <div className="border-l-2 border-signal-negative py-2 pl-4">
        <p className="text-sm text-signal-negative">
          {(q.error as Error | null)?.message ?? "Not found."}
        </p>
        <Link
          to="/admin/countries/$code/personas/portfolios"
          params={{ code }}
          className="btn-ghost -ml-2 mt-2 inline-block px-2 py-1 text-xs"
        >
          ← All portfolios
        </Link>
      </div>
    );

  const { set, portfolio, synthesis } = d;
  const isPm = portfolio.kind === "head_of_government";
  const profile = synthesis && hasProfile(synthesis.profile) ? synthesis.profile : null;
  const aggregates = synthesis && hasAggregates(synthesis.aggregates) ? synthesis.aggregates : null;
  const editable = set.status === "draft" || set.status === "returned";
  const axes = isMatrix(set.design_matrix)
    ? set.design_matrix.axes
    : d.base && isMatrix(d.base.set.design_matrix)
      ? d.base.set.design_matrix.axes
      : [];
  const tabs: Array<[Tab, string]> = [
    [
      "profile",
      isPm || portfolio.kind === "opposition" ? officeNames(portfolio).ideal : "The Ideal Minister",
    ],
    ["personas", `The cast${d.personas.length ? ` (${d.personas.length})` : ""}`],
    ["skills", "Skills"],
    ...(isPm ? ([["cabinet", "Cabinet weighting"]] as Array<[Tab, string]>) : []),
    ["convene", "Convene"],
  ];
  const active: Tab = tab ?? (profile ? "profile" : "personas");

  async function onAsk() {
    setAsking(true);
    setErr(null);
    try {
      const r = await ask({ data: { code, portfolio: portfolio.code } });
      void navigate({
        to: "/admin/countries/$code/personas/$id",
        params: { code, id: r.personaId },
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div>
      <Link
        to="/admin/countries/$code/personas/portfolios"
        params={{ code }}
        className={cn(MICRO, "hover:text-ink-950")}
      >
        ← All portfolios
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className={MICRO}>
            {portfolio.code} · {scopeLabel(set.scope_key, d.countryName)} · v{set.version}
            {set.kind === "overlay" ? " · country overlay" : ""}
          </div>
          <h1 className="mt-1 font-serif text-3xl leading-tight text-ink-950">{set.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-700">{portfolio.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile && (
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              disabled={asking}
              onClick={onAsk}
            >
              <MessageCircle size={12} /> {asking ? "Opening…" : officeNames(portfolio).ask}
            </button>
          )}
          {profile && editable && d.canWrite && (
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={async () => {
                setErr(null);
                try {
                  await again({ data: { setId } });
                  refresh();
                  void loop.start();
                } catch (e) {
                  setErr((e as Error).message);
                }
              }}
            >
              Synthesise again
            </button>
          )}
          {(editable || set.status === "superseded") && d.canWrite && (
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={async () => {
                if (!window.confirm("Delete this version and its personas?")) return;
                try {
                  await remove({ data: { setId } });
                  void navigate({
                    to: "/admin/countries/$code/personas/portfolios",
                    params: { code },
                  });
                } catch (e) {
                  setErr((e as Error).message);
                }
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {err && (
        <p className="mt-3 border-l-2 border-signal-negative py-1 pl-3 text-sm text-signal-negative">
          {err}
        </p>
      )}
      {d.stale && (
        <p className="mt-3 border-l-2 border-signal-caution py-1 pl-3 text-xs text-ink-700">
          {isPm
            ? "Out of date: a portfolio profile has been approved since this was synthesised."
            : "Out of date: the regional profile this overlay builds on has changed."}
        </p>
      )}
      {set.kind === "overlay" && d.base && (
        <p className="mt-3 text-xs text-ink-500">
          Re-weights{" "}
          <Link
            to="/admin/countries/$code/personas/portfolios/$setId"
            params={{ code, setId: d.base.set.id }}
            className="underline decoration-line-200 underline-offset-2"
          >
            the regional profile v{d.base.set.version}
          </Link>{" "}
          for {d.countryName}. The cast shown is the regional one.
        </p>
      )}

      <div className="mt-6 grid gap-8 xl:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap gap-4 border-b border-line-200">
            {tabs.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setTab(k);
                  if (k !== "personas") setFocusSkill(null);
                }}
                className={cn(
                  "btn-ghost -mb-px border-b-2 px-1 pb-2 text-sm",
                  active === k ? "border-ink-950 text-ink-950" : "border-transparent text-ink-500",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {active === "profile" &&
            (profile && synthesis ? (
              <IdealProfileView
                key={synthesis.updated_at}
                synthesis={synthesis}
                aggregates={aggregates}
                skills={d.skills}
                canEdit={editable && d.canWrite}
                onSaved={refresh}
                overlay={set.kind === "overlay"}
              />
            ) : (
              <p className="text-sm text-ink-500">
                The profile is written at the end of the run.{" "}
                {set.kind === "regional"
                  ? "Fifty personas are cast first, checked, then counted."
                  : ""}
              </p>
            ))}
          {active === "personas" && (
            <>
              {focusSkill && (
                <p className="mb-3 text-xs text-ink-700">
                  Showing holders of {d.skills.find((s) => s.code === focusSkill)?.label}.{" "}
                  <button
                    type="button"
                    className="btn-ghost px-1 text-xs"
                    onClick={() => setFocusSkill(null)}
                  >
                    Clear
                  </button>
                </p>
              )}
              <PersonaGrid
                personas={d.personas}
                skills={d.skills}
                axes={axes}
                canRegenerate={set.kind === "regional" && editable && d.canWrite}
                onChanged={refresh}
                focusSkill={focusSkill}
              />
            </>
          )}
          {active === "skills" && (
            <>
              <SkillsPanel
                aggregates={aggregates}
                skills={d.skills}
                personas={d.personas}
                profile={profile}
                onPickSkill={(c) => {
                  setFocusSkill(c);
                  setTab("personas");
                }}
              />
              <ProposedSkills
                set={set}
                canPromote={d.capabilities.approveRegional}
                onChanged={refresh}
              />
            </>
          )}
          {active === "cabinet" && isPm && (
            <CabinetWeighting
              profile={profile}
              inputs={d.pmInputs}
              portfolios={d.portfolios}
              stale={d.stale}
              code={code}
            />
          )}
          {active === "convene" && (
            <ConvenePanel
              code={code}
              portfolios={d.portfolios}
              defaults={
                isPm ? d.pmInputs.slice(0, 4).map((i) => i.portfolio_code) : [portfolio.code]
              }
            />
          )}
        </div>

        <div className="space-y-4">
          <RunRail
            set={set}
            personas={set.kind === "overlay" ? 0 : d.personas.length}
            canRun={d.canWrite}
            aiAvailable={d.aiAvailable}
            loop={loop}
          />
          <ApprovalBar data={d} onChanged={refresh} />
          {set.scope_key === REGIONAL && (
            <p className="text-[11px] text-ink-500">
              Regional profiles are shared by every country. Each country re-weights the approved
              one with an overlay.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
