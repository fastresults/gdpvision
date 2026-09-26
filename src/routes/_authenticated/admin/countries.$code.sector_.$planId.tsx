import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { ApprovalPanel } from "@/components/egov/ApprovalPanel";
import { SectionEditor } from "@/components/egov/SectionEditor";
import { Explain } from "@/components/explain/Explain";
import { MICRO, PLAN_META, SECTION_META, formatWhen } from "@/components/sector/labels";
import { draftPlanSection } from "@/lib/sector/draft.functions";
import {
  checkPlanStale,
  exportPlanMarkdown,
  getPlan,
  savePlanSection,
  transitionPlan,
} from "@/lib/sector/plan.functions";
import { SECTOR_STAGES, SECTOR_STAGE_BY_KEY, type SectorStage } from "@/lib/sector/stages";
import { cn } from "@/lib/utils";
import "@/lib/explain/egov-entries";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/sector_/$planId")({
  head: ({ params }) => ({
    meta: [
      { title: `Sector plan · ${params.code} — GDPVision` },
      { name: "description", content: `Sector Development Plan for ${params.code}.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlanPage,
});

const AGENT_LABEL: Record<string, string> = {
  diagnostician: "Diagnostician",
  strategist: "Strategist",
  planner: "Planner",
  economist: "Economist",
  measurer: "Measurer",
  drafter: "Drafter",
};

function PlanPage() {
  const { code, planId } = Route.useParams();
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getPlan);
  const draft = useServerFn(draftPlanSection);
  const save = useServerFn(savePlanSection);
  const transition = useServerFn(transitionPlan);
  const stale = useServerFn(checkPlanStale);
  const exportMd = useServerFn(exportPlanMarkdown);

  const key = ["sector-plan", code, planId];
  const q = useQuery({ queryKey: key, queryFn: () => fetchPlan({ data: { code, planId } }) });

  const [view, setView] = useState<SectorStage>("diagnostic");
  const [busyStage, setBusyStage] = useState<SectorStage | "all" | "check" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = q.data;
  const sections = useMemo(() => data?.sections ?? [], [data]);
  const byKey = useMemo(() => new Map(sections.map((s) => [s.stage_key, s])), [sections]);
  const drafted = sections.filter((s) => s.status !== "pending").length;
  const staleCount = sections.filter((s) => s.status === "stale").length;
  const gapCount = sections.filter((s) => s.status === "gap").length;
  const findings = sections.reduce((n, s) => n + s.audit.length, 0);
  const editable = !!data && (data.plan.status === "draft" || data.plan.status === "returned");
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  function blockedBy(stage: SectorStage): string[] {
    return SECTOR_STAGE_BY_KEY[stage].after
      .filter((k) => byKey.get(k)?.status === "pending")
      .map((k) => SECTOR_STAGE_BY_KEY[k].short);
  }

  async function onDraft(stage: SectorStage) {
    setBusyStage(stage);
    setError(null);
    setNotice(null);
    try {
      const r = await draft({ data: { code, planId, stage } });
      const short = SECTOR_STAGE_BY_KEY[stage].short;
      setNotice(
        r.status === "gap"
          ? `${short}: the corpus could not ground this section; it is recorded as a gap.`
          : `${short}: drafted from ${r.contextLines} context lines, ${r.citations} cited${r.findings ? `; the Auditor left ${r.findings} note${r.findings === 1 ? "" : "s"}` : ""}.`,
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyStage(null);
    }
  }

  async function onDraftAll() {
    setBusyStage("all");
    setError(null);
    setNotice(null);
    try {
      for (const s of SECTOR_STAGES) {
        const cur = byKey.get(s.key);
        if (!cur || cur.status !== "pending") continue;
        setNotice(`${AGENT_LABEL[s.agent]} drafting ${s.label}…`);
        await draft({ data: { code, planId, stage: s.key } });
        await refresh();
      }
      setNotice(
        "Every pending section has been drafted. Review the Auditor's notes before submitting.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyStage(null);
      await refresh();
    }
  }

  async function onCheck() {
    setBusyStage("check");
    setError(null);
    try {
      const r = await stale({ data: { code, planId } });
      setNotice(
        r.stale.length
          ? `${r.stale.length} section${r.stale.length === 1 ? " is" : "s are"} out of date.`
          : "Every section is current with the corpus.",
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyStage(null);
    }
  }

  async function onExport() {
    setError(null);
    try {
      const r = await exportMd({ data: { code, planId } });
      const blob = new Blob([r.markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onSave(sectionId: string, body: string) {
    await save({ data: { code, sectionId, body } });
    await refresh();
  }

  async function onTransition(to: "submitted" | "approved" | "returned" | "draft", note?: string) {
    await transition({ data: { code, planId, to, note } });
    await refresh();
  }

  const current = byKey.get(view) ?? null;
  const stageMeta = SECTOR_STAGE_BY_KEY[view];
  const meta = data ? PLAN_META[data.plan.status] : null;

  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Sector Studio", to: "/admin/countries/$code/sector", params: { code } },
        { label: data ? `${data.sectorLabel} v${data.plan.version}` : "Plan" },
      ]}
    >
      {q.isLoading && <div className="h-40 animate-pulse bg-paper-50" aria-busy="true" />}
      {q.error && (
        <div className="border-l-2 border-signal-negative py-2 pl-4">
          <p className="text-sm text-signal-negative">
            The plan could not be loaded: {(q.error as Error).message}
          </p>
        </div>
      )}

      {data && meta && (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line-200 pb-5">
            <div>
              <div className={MICRO}>
                {code} · {data.sectorLabel} · Plan v{data.plan.version} ·{" "}
                <span className={meta.text}>{meta.label}</span>
              </div>
              <h1 className="mt-1 font-display text-3xl text-ink-950">{data.plan.title}</h1>
              <p className="mt-1 text-sm text-ink-700">
                <Explain
                  id="egov.prd.progress"
                  ctx={{ drafted, total: SECTOR_STAGES.length, gaps: gapCount, stale: staleCount }}
                >
                  {drafted} of {SECTOR_STAGES.length} sections drafted
                </Explain>
                {gapCount > 0 && (
                  <span className="text-signal-negative">
                    {" "}
                    · {gapCount} gap{gapCount === 1 ? "" : "s"}
                  </span>
                )}
                {staleCount > 0 && (
                  <span className="text-signal-caution"> · {staleCount} out of date</span>
                )}
                {findings > 0 && (
                  <span className="text-ink-500">
                    {" "}
                    · {findings} Auditor note{findings === 1 ? "" : "s"}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {editable && data.aiAvailable && drafted < SECTOR_STAGES.length && (
                <button
                  type="button"
                  className="btn-primary px-3 py-2 text-xs"
                  disabled={busyStage != null}
                  onClick={onDraftAll}
                >
                  {busyStage === "all" ? "Drafting…" : "Draft all pending"}
                </button>
              )}
              {drafted > 0 && (
                <button
                  type="button"
                  className="btn-ghost px-3 py-2 text-xs"
                  disabled={busyStage != null}
                  onClick={onCheck}
                >
                  {busyStage === "check" ? "Checking…" : "Check for corpus changes"}
                </button>
              )}
              <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={onExport}>
                Export markdown
              </button>
              <Link
                to="/admin/countries/$code/sector/$planId/document"
                params={{ code, planId }}
                className="btn-secondary px-3 py-2 text-xs"
              >
                Document view
              </Link>
            </div>
          </div>

          {notice && (
            <p className="mb-4 border-l-2 border-gold-500 py-1 pl-3 text-sm text-ink-700">
              {notice}
            </p>
          )}
          {error && (
            <p className="mb-4 border-l-2 border-signal-negative py-1 pl-3 text-sm text-signal-negative">
              {error}
            </p>
          )}
          {!data.aiAvailable && (
            <p className="mb-4 text-xs text-ink-500">
              Drafting is unavailable on this server; sections can be written by hand.
            </p>
          )}

          <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
            <nav aria-label="Sections" className="lg:sticky lg:top-6 lg:self-start">
              <div className={MICRO}>Sections</div>
              <ol className="mt-2 border-l border-line-200">
                {SECTOR_STAGES.map((s) => {
                  const sec = byKey.get(s.key);
                  const sm = SECTION_META[sec?.status ?? "pending"];
                  const active = view === s.key;
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => setView(s.key)}
                        className={cn(
                          "-ml-px flex w-full items-start gap-2 border-l-2 py-1.5 pl-3 text-left text-xs transition-colors",
                          active
                            ? "border-gold-500 text-ink-950"
                            : "border-transparent text-ink-700 hover:text-ink-950",
                        )}
                        aria-current={active ? "true" : undefined}
                      >
                        <span
                          className={cn(
                            "mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full border",
                            sm.border,
                            sm.hollow ? "" : "bg-current",
                            sm.text,
                          )}
                        />
                        <span>
                          <span className="font-mono text-[10px] text-ink-400">
                            {String(s.ordinal).padStart(2, "0")}
                          </span>{" "}
                          {s.short}
                          {sec && sec.audit.length > 0 && (
                            <span className="ml-1 font-mono text-[10px] text-ink-400">
                              ·{sec.audit.length}
                            </span>
                          )}
                          {busyStage === s.key && <span className="ml-1 text-ink-400">…</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 text-[11px] leading-snug text-ink-500">
                Each section is drafted by one agent role from its own context pack; the Auditor
                checks every draft and edit.
              </p>
            </nav>

            <main className="min-w-0">
              {current ? (
                <>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                    Agent · {AGENT_LABEL[stageMeta.agent]}
                  </div>
                  <SectionEditor
                    key={current.id}
                    section={current}
                    citations={data.citations.filter((c) => c.section_id === current.id)}
                    canDraft={editable && data.aiAvailable}
                    canEdit={true}
                    busy={busyStage === current.stage_key || busyStage === "all"}
                    blockedBy={blockedBy(current.stage_key)}
                    onDraft={() => onDraft(current.stage_key)}
                    onSave={(body) => onSave(current.id, body)}
                    desc={stageMeta.desc}
                    noun="plan"
                  />
                  {current.audit.length > 0 && (
                    <aside className="mt-8 border-t border-line-200 pt-4" aria-label="Auditor">
                      <div className={MICRO}>Auditor</div>
                      <ul className="mt-2 space-y-1.5">
                        {current.audit.map((f, i) => (
                          <li
                            key={i}
                            className="border-l-2 border-signal-caution py-0.5 pl-3 text-xs text-ink-700"
                          >
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                              {f.kind}
                            </span>{" "}
                            {f.message}
                          </li>
                        ))}
                      </ul>
                    </aside>
                  )}
                </>
              ) : null}
            </main>

            <div className="space-y-6">
              <ApprovalPanel
                prd={data.plan}
                capabilities={data.capabilities}
                userId={data.userId}
                allDrafted={drafted === SECTOR_STAGES.length}
                staleCount={staleCount}
                history={data.history}
                busy={busyStage != null}
                onTransition={onTransition}
                approvedNote="A Cabinet commitment to deliver it has been raised."
              />
              {data.commitment && (
                <aside className="border-t border-line-200 pt-4" aria-label="Cabinet commitment">
                  <div className={MICRO}>Cabinet commitment</div>
                  <p className="mt-1 text-sm text-ink-950">{data.commitment.title}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {data.commitment.status}
                    {data.commitment.due_at
                      ? ` · due ${formatWhen(data.commitment.due_at).split(",")[0]}`
                      : ""}
                  </p>
                  <Link
                    to="/admin/countries/$code/cabinet"
                    params={{ code }}
                    className="mt-2 inline-block text-xs text-ink-700 underline decoration-line-200 underline-offset-4 hover:text-ink-950"
                  >
                    Open the Cabinet Room
                  </Link>
                </aside>
              )}
              <aside className="border-t border-line-200 pt-4">
                <div className={MICRO}>Scope</div>
                <dl className="mt-2 space-y-1 text-xs text-ink-700">
                  <div>
                    <dt className="inline text-ink-500">Sector · </dt>
                    <dd className="inline">{data.sectorLabel}</dd>
                  </div>
                  <div>
                    <dt className="inline text-ink-500">Lead ministry · </dt>
                    <dd className="inline">{data.plan.scope.lead_ministry || "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-ink-500">Horizon · </dt>
                    <dd className="inline">{data.plan.scope.horizon_years} years</dd>
                  </div>
                  {data.plan.scope.ambition && (
                    <div>
                      <dt className="inline text-ink-500">Ambition · </dt>
                      <dd className="inline">{data.plan.scope.ambition}</dd>
                    </div>
                  )}
                </dl>
              </aside>
            </div>
          </div>
        </>
      )}
    </SuperAdminShell>
  );
}
