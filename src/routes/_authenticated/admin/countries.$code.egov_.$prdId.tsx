import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { ApprovalPanel } from "@/components/egov/ApprovalPanel";
import { BrandPreview } from "@/components/egov/BrandPreview";
import { MICRO, PRD_META, SECTION_META } from "@/components/egov/labels";
import { SectionEditor } from "@/components/egov/SectionEditor";
import { SharePanel } from "@/components/egov/SharePanel";
import { Explain } from "@/components/explain/Explain";
import { draftSection } from "@/lib/egov/draft.functions";
import {
  checkStale,
  exportPrdMarkdown,
  getPrd,
  saveSection,
  transitionPrd,
} from "@/lib/egov/prd.functions";
import { EGOV_STAGES, EGOV_STAGE_BY_KEY, type EgovStage } from "@/lib/egov/stages";
import { cn } from "@/lib/utils";
import "@/lib/explain/egov-entries";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/egov_/$prdId")({
  head: ({ params }) => ({
    meta: [
      { title: `PRD · ${params.code} — GDPVision` },
      { name: "description", content: `E-government platform PRD for ${params.code}.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrdPage,
});

type View = EgovStage | "brand";

function PrdPage() {
  const { code, prdId } = Route.useParams();
  const qc = useQueryClient();
  const fetchPrd = useServerFn(getPrd);
  const draft = useServerFn(draftSection);
  const save = useServerFn(saveSection);
  const transition = useServerFn(transitionPrd);
  const stale = useServerFn(checkStale);
  const exportMd = useServerFn(exportPrdMarkdown);

  const key = ["egov-prd", code, prdId];
  const q = useQuery({ queryKey: key, queryFn: () => fetchPrd({ data: { code, prdId } }) });

  const [view, setView] = useState<View>("country_context");
  const [busyStage, setBusyStage] = useState<EgovStage | "all" | "check" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = q.data;
  const sections = useMemo(() => data?.sections ?? [], [data]);
  const byKey = useMemo(() => new Map(sections.map((s) => [s.stage_key, s])), [sections]);
  const drafted = sections.filter((s) => s.status !== "pending").length;
  const staleCount = sections.filter((s) => s.status === "stale").length;
  const gapCount = sections.filter((s) => s.status === "gap").length;
  const editable = !!data && (data.prd.status === "draft" || data.prd.status === "returned");

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  function blockedBy(stage: EgovStage): string[] {
    return EGOV_STAGE_BY_KEY[stage].after
      .filter((k) => byKey.get(k)?.status === "pending")
      .map((k) => EGOV_STAGE_BY_KEY[k].short);
  }

  async function onDraft(stage: EgovStage) {
    setBusyStage(stage);
    setError(null);
    setNotice(null);
    try {
      const r = await draft({ data: { code, prdId, stage } });
      setNotice(
        r.status === "gap"
          ? `${EGOV_STAGE_BY_KEY[stage].short}: the corpus could not ground this section; it is recorded as a gap.`
          : `${EGOV_STAGE_BY_KEY[stage].short}: drafted from ${r.contextLines} context lines, ${r.citations} cited.`,
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
      for (const s of EGOV_STAGES) {
        const cur = byKey.get(s.key);
        if (!cur || cur.status !== "pending") continue;
        setNotice(`Drafting ${s.label}…`);
        await draft({ data: { code, prdId, stage: s.key } });
        await refresh();
      }
      setNotice("Every pending section has been drafted.");
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
      const r = await stale({ data: { code, prdId } });
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
      const r = await exportMd({ data: { code, prdId } });
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
    await transition({ data: { code, prdId, to, note } });
    await refresh();
  }

  const current = view === "brand" ? null : (byKey.get(view) ?? null);
  const meta = data ? PRD_META[data.prd.status] : null;

  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Digital Government Studio", to: "/admin/countries/$code/egov", params: { code } },
        { label: data ? `v${data.prd.version}` : "PRD" },
      ]}
    >
      {q.isLoading && <div className="h-40 animate-pulse bg-paper-50" aria-busy="true" />}
      {q.error && (
        <div className="border-l-2 border-signal-negative py-2 pl-4">
          <p className="text-sm text-signal-negative">
            The PRD could not be loaded: {(q.error as Error).message}
          </p>
        </div>
      )}

      {data && meta && (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line-200 pb-5">
            <div>
              <div className={MICRO}>
                {code} · PRD v{data.prd.version} · <span className={meta.text}>{meta.label}</span>
              </div>
              <h1 className="mt-1 font-display text-3xl text-ink-950">{data.prd.title}</h1>
              <p className="mt-1 text-sm text-ink-700">
                <Explain
                  id="egov.prd.progress"
                  ctx={{ drafted, total: EGOV_STAGES.length, gaps: gapCount, stale: staleCount }}
                >
                  {drafted} of {EGOV_STAGES.length} sections drafted
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
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {editable && data.aiAvailable && drafted < EGOV_STAGES.length && (
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
                to="/admin/countries/$code/egov/$prdId/document"
                params={{ code, prdId }}
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
                {EGOV_STAGES.map((s) => {
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
                          {busyStage === s.key && <span className="ml-1 text-ink-400">…</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
                <li className="mt-2 border-t border-line-200 pt-2">
                  <button
                    type="button"
                    onClick={() => setView("brand")}
                    className={cn(
                      "-ml-px flex w-full items-center gap-2 border-l-2 py-1.5 pl-3 text-left text-xs transition-colors",
                      view === "brand"
                        ? "border-gold-500 text-ink-950"
                        : "border-transparent text-ink-700 hover:text-ink-950",
                    )}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 shrink-0 border"
                      style={{ borderColor: data.brand.accent }}
                    />
                    Brand tokens
                  </button>
                </li>
              </ol>
            </nav>

            <main className="min-w-0">
              {view === "brand" ? (
                <BrandPreview brand={data.brand} />
              ) : current ? (
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
                />
              ) : null}
            </main>

            <div className="space-y-6">
              <ApprovalPanel
                prd={data.prd}
                capabilities={data.capabilities}
                userId={data.userId}
                allDrafted={drafted === EGOV_STAGES.length}
                staleCount={staleCount}
                history={data.history}
                busy={busyStage != null}
                onTransition={onTransition}
              />
              <SharePanel
                code={code}
                prdId={prdId}
                approved={data.prd.status === "approved"}
                canShare={data.capabilities.approve}
              />
              <aside className="border-t border-line-200 pt-4">
                <div className={MICRO}>Scope</div>
                <dl className="mt-2 space-y-1 text-xs text-ink-700">
                  <div>
                    <dt className="inline text-ink-500">Platform · </dt>
                    <dd className="inline">{data.prd.scope.platform_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-ink-500">Audiences · </dt>
                    <dd className="inline">{data.prd.scope.audiences.join(", ") || "all"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-ink-500">Priorities · </dt>
                    <dd className="inline">{data.prd.scope.priorities.join(", ") || "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-ink-500">Hosting · </dt>
                    <dd className="inline">{data.prd.scope.hosting || "—"}</dd>
                  </div>
                </dl>
              </aside>
            </div>
          </div>
        </>
      )}
    </SuperAdminShell>
  );
}
