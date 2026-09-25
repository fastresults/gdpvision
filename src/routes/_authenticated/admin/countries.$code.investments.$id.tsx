import { useEffect, useState, type ReactNode } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useChildMatches,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { Explain } from "@/components/explain/Explain";
import { CompliancePanel } from "@/components/investments/CompliancePanel";
import { HistoryTimeline } from "@/components/investments/HistoryTimeline";
import { InvestorPackagesPanel } from "@/components/investments/packages/InvestorPackagesPanel";
import {
  ProjectForm,
  draftToContent,
  toDraft,
  type ProjectDraft,
} from "@/components/investments/ProjectForm";
import { ProjectInterestPanel } from "@/components/investments/ProjectInterestPanel";
import { ProjectMediaPanel } from "@/components/investments/ProjectMediaPanel";
import { ReadinessList } from "@/components/investments/ReadinessList";
import { ShareLinksPanel } from "@/components/investments/ShareLinksPanel";
import {
  ApprovalMark,
  ErrorText,
  errMessage,
  formatDate,
  formatUsd,
  inputCls,
  MicroLabel,
  Note,
  ReadinessRule,
  tabListCls,
  tabTriggerCls,
} from "@/components/investments/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteInvestment,
  getInvestment,
  saveInvestment,
  transitionInvestment,
  type ProjectView,
} from "@/lib/investments/pipeline.functions";
import { STAGE_LABEL, type ReadinessCheck } from "@/lib/investments/readiness";
import { cn } from "@/lib/utils";
// Must come after any standards-entries import; it re-registers "investments.readiness".
import "@/lib/explain/investments-entries";

const TABS = [
  "overview",
  "media",
  "readiness",
  "compliance",
  "materials",
  "share",
  "interest",
  "history",
] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  overview: "Overview",
  media: "Photos and documents",
  readiness: "Readiness",
  compliance: "Compliance",
  materials: "Investor materials",
  share: "Share links",
  interest: "Interest",
  history: "History",
};

export const Route = createFileRoute("/_authenticated/admin/countries/$code/investments/$id")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab; view?: string } => ({
    view: typeof s.view === "string" && /^[0-9a-f-]{36}$/i.test(s.view) ? s.view : undefined,
    tab:
      typeof s.tab === "string" && (TABS as readonly string[]).includes(s.tab)
        ? (s.tab as Tab)
        : undefined,
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Investment project · ${params.code} — GDPVision` },
      {
        name: "description",
        content:
          "Project workspace: readiness, approval, compliance, investor materials, share links and interest.",
      },
      { property: "og:title", content: `Investment project · ${params.code}` },
      { property: "og:description", content: "Investment project workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProjectRoute,
});

// Child routes (the other builder's package print view,
// countries.$code.investments.$id.package.$packageId.tsx) render in place of the workspace.
function ProjectRoute() {
  const children = useChildMatches();
  if (children.length > 0) return <Outlet />;
  return <ProjectWorkspace />;
}

type Data = Awaited<ReturnType<typeof getInvestment>>;

function ProjectWorkspace() {
  const { code, id } = Route.useParams();
  const { tab: tabParam, view: viewParam } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const fetchP = useServerFn(getInvestment);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["investment", code, id],
    queryFn: () => fetchP({ data: { code, id } }),
  });
  const tab: Tab = tabParam ?? "overview";

  const setTab = (t: Tab) =>
    navigate({ search: { tab: t === "overview" ? undefined : t }, replace: true });

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["investment", code, id] }),
      qc.invalidateQueries({ queryKey: ["investments", code] }),
      qc.invalidateQueries({ queryKey: ["share-links", code, id] }),
    ]);
  };

  function jumpTo(section: ReadinessCheck["section"]) {
    if (section === "compliance") return setTab("compliance");
    setTab("overview");
    setTimeout(
      () =>
        document
          .getElementById(`section-${section}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60,
    );
  }

  const p = q.data?.project;

  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        {
          label: "Investment pipeline",
          to: "/admin/countries/$code/investments",
          params: { code },
        },
        { label: p?.title ?? "Project" },
      ]}
    >
      {q.isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {q.error && (
        <div className="space-y-2">
          <ErrorText>{errMessage(q.error)}</ErrorText>
          <Link
            to="/admin/countries/$code/investments"
            params={{ code }}
            className="btn-ghost px-3 py-1.5 text-xs"
          >
            Back to the pipeline
          </Link>
        </div>
      )}
      {q.data && p && (
        <>
          <Header data={q.data} code={code} onChanged={refresh} onGo={setTab} />

          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-8">
            <TabsList className={tabListCls}>
              {TABS.map((t) => (
                <TabsTrigger key={t} value={t} className={tabTriggerCls}>
                  {TAB_LABEL[t]}
                  {t === "readiness" && p.score < 10 && (
                    <span className="ml-1.5 text-[11px] tabular-nums text-signal-negative">
                      {10 - p.score}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="pt-6">
              <OverviewTab code={code} project={p} onSaved={refresh} />
            </TabsContent>
            <TabsContent value="media" className="pt-6">
              <ProjectMediaPanel
                code={code}
                projectId={id}
                canEdit={q.data.capabilities.approveInvestments}
              />
            </TabsContent>
            <TabsContent value="readiness" className="pt-6">
              <div className="max-w-3xl">
                <ReadinessList checks={p.readiness} onFix={jumpTo} />
              </div>
            </TabsContent>
            <TabsContent value="compliance" className="pt-6">
              <div className="max-w-3xl">
                <CompliancePanel
                  code={code}
                  projectId={id}
                  projectApproved={p.approval_status === "approved"}
                  onSaved={refresh}
                />
              </div>
            </TabsContent>
            <TabsContent value="materials" className="pt-6">
              <InvestorPackagesPanel
                code={code}
                projectId={id}
                projectApproved={p.approval_status === "approved"}
                projectVersion={p.version}
                canApprove={q.data.capabilities.approveInvestments}
                viewId={viewParam ?? null}
                onView={(v) =>
                  navigate({
                    search: (prev: { tab?: Tab; view?: string }) => ({
                      ...prev,
                      tab: "materials",
                      view: v ?? undefined,
                    }),
                    replace: v === null,
                  })
                }
              />
            </TabsContent>
            <TabsContent value="share" className="pt-6">
              <ShareLinksPanel
                code={code}
                projectId={id}
                projectApproved={p.approval_status === "approved"}
                canApprove={q.data.capabilities.approveInvestments}
                onChanged={refresh}
              />
            </TabsContent>
            <TabsContent value="interest" className="pt-6">
              <ProjectInterestPanel code={code} projectId={id} />
            </TabsContent>
            <TabsContent value="history" className="pt-6">
              <div className="max-w-3xl">
                <HistoryTimeline items={q.data.history} />
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </SuperAdminShell>
  );
}

// ------------------------------------------------------------------ header

function Header({
  data,
  code,
  onChanged,
  onGo,
}: {
  data: Data;
  code: string;
  onChanged: () => Promise<void>;
  onGo: (t: Tab) => void;
}) {
  const p = data.project;
  return (
    <div className="space-y-4">
      <div>
        <MicroLabel>
          {[p.sector, p.structure].filter(Boolean).join(" · ") || "Sector and structure not set"} ·
          version {p.version}
        </MicroLabel>
        <h1 className="mt-1 font-display text-3xl text-ink-950">{p.title}</h1>
      </div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 border-y border-line-200 py-3">
        <Fact label="Stage">{STAGE_LABEL[p.stage as keyof typeof STAGE_LABEL] ?? p.stage}</Fact>
        <Fact label="Capital cost">{formatUsd(p.capex_usd, { empty: "Not set" })}</Fact>
        <Fact label="Readiness">
          <Explain id="investments.readiness" ctx={{ checks: p.readiness }}>
            <ReadinessRule score={p.score} className="min-w-[5rem]" />
          </Explain>
        </Fact>
        <Fact label="Approval">
          <ApprovalMark status={p.approval_status} className="text-sm" />
          {p.approval_status === "approved" && p.approved_at && (
            <span className="ml-2 text-xs text-ink-500">since {formatDate(p.approved_at)}</span>
          )}
          {p.approval_status === "submitted" && p.submitted_at && (
            <span className="ml-2 text-xs text-ink-500">since {formatDate(p.submitted_at)}</span>
          )}
        </Fact>
      </div>
      {p.approval_status === "returned" && p.returned_note && (
        <Note
          tone="negative"
          title={`Returned for changes${p.returned_at ? ` on ${formatDate(p.returned_at)}` : ""}`}
        >
          <p className="whitespace-pre-wrap">{p.returned_note}</p>
        </Note>
      )}
      <NextAction data={data} code={code} onChanged={onChanged} onGo={onGo} />
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <MicroLabel>{label}</MicroLabel>
      <div className="mt-1 text-sm text-ink-950">{children}</div>
    </div>
  );
}

function NextAction({
  data,
  code,
  onChanged,
  onGo,
}: {
  data: Data;
  code: string;
  onChanged: () => Promise<void>;
  onGo: (t: Tab) => void;
}) {
  const transition = useServerFn(transitionInvestment);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState("");
  const p = data.project;
  const approver = data.capabilities.approveInvestments;
  const failing = 10 - p.score;

  async function go(
    to: "submitted" | "approved" | "returned" | "draft" | "withdrawn",
    confirmText?: string,
  ) {
    if (confirmText && !window.confirm(confirmText)) return;
    setErr(null);
    setBusy(true);
    try {
      await transition({
        data: { code, id: p.id, to, note: to === "returned" ? note.trim() : undefined },
      });
      setReturning(false);
      setNote("");
      await onChanged();
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  let title: string;
  let body: ReactNode = null;
  let actions: ReactNode = null;
  let tone: "positive" | "caution" | "muted" | "negative" = "muted";

  const editable =
    p.approval_status === "draft" ||
    p.approval_status === "returned" ||
    p.approval_status === "withdrawn";
  if (editable && failing > 0) {
    title = `Complete ${failing} ${failing === 1 ? "check" : "checks"}`;
    body = "All ten readiness checks must pass before the project can be submitted for approval.";
    actions = (
      <button
        type="button"
        className="btn-primary px-3 py-1.5 text-xs"
        onClick={() => onGo("readiness")}
      >
        See what is missing
      </button>
    );
  } else if (editable) {
    title = "Submit for approval";
    tone = "caution";
    body =
      "Every check passes. A second person with an approver role — not you — will approve it or return it with a note.";
    actions = (
      <button
        type="button"
        className="btn-primary px-3 py-1.5 text-xs"
        disabled={busy}
        onClick={() => go("submitted")}
      >
        Submit for approval
      </button>
    );
  } else if (p.approval_status === "submitted" && data.viewerIsSubmitter) {
    title = "Awaiting approval by someone else";
    tone = "caution";
    body =
      "You submitted this project, so another approver must approve or return it. You can withdraw the submission to make changes.";
    actions = (
      <button
        type="button"
        className="btn-secondary px-3 py-1.5 text-xs"
        disabled={busy}
        onClick={() => go("draft", "Withdraw the submission and return the project to draft?")}
      >
        Withdraw submission
      </button>
    );
  } else if (p.approval_status === "submitted" && approver) {
    title = "Approve or return";
    tone = "caution";
    body =
      "Check the readiness list and the materials, then approve the project for investors or return it with a note saying what must change.";
    actions = (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={() => go("approved")}
        >
          Approve for investors
        </button>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={() => setReturning((v) => !v)}
        >
          Return with a note
        </button>
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={() => go("draft", "Withdraw this submission and return the project to draft?")}
        >
          Withdraw submission
        </button>
      </div>
    );
  } else if (p.approval_status === "submitted") {
    title = "Awaiting approval";
    tone = "caution";
    body =
      "A country admin, cabinet secretary or principal who did not submit the project will approve it or return it.";
  } else if (p.approval_status === "approved" && approver) {
    title = "Create share link";
    tone = "positive";
    body = "The project is approved. Share it with named investors, or take it off the market.";
    actions = (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-xs"
          onClick={() => onGo("share")}
        >
          Create share link
        </button>
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={() =>
            go(
              "withdrawn",
              "Take this project off the market? Its share links pause and it must be submitted and approved again.",
            )
          }
        >
          Take off the market
        </button>
      </div>
    );
  } else {
    title = "Approved for investors";
    tone = "positive";
    body = "An investment approver can create share links and approve investor materials.";
  }

  const border = {
    positive: "border-l-signal-positive",
    caution: "border-l-signal-caution",
    muted: "border-l-gold-500",
    negative: "border-l-signal-negative",
  }[tone];

  return (
    <div className={cn("border border-line-200 border-l-2 px-4 py-3", border)}>
      <MicroLabel>Next step</MicroLabel>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <div className="font-display text-lg text-ink-950">{title}</div>
          {body && <p className="mt-0.5 text-sm text-ink-700">{body}</p>}
        </div>
        {actions}
      </div>
      {returning && (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-ink-700">
            What needs to change?
            <textarea
              className={cn(inputCls, "mt-1")}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary px-3 py-1.5 text-xs"
              disabled={busy || !note.trim()}
              onClick={() => go("returned")}
            >
              Return to the team
            </button>
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => setReturning(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {err && (
        <div className="mt-2">
          <ErrorText>{err}</ErrorText>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ overview

function sameDraft(a: ProjectDraft, b: ProjectDraft) {
  return (Object.keys(a) as Array<keyof ProjectDraft>).every(
    (k) => String(a[k]).trim() === String(b[k]).trim(),
  );
}

function OverviewTab({
  code,
  project,
  onSaved,
}: {
  code: string;
  project: ProjectView;
  onSaved: () => Promise<void>;
}) {
  const save = useServerFn(saveInvestment);
  const del = useServerFn(deleteInvestment);
  const navigate = useNavigate();
  const [d, setD] = useState<ProjectDraft>(() => toDraft(project));
  const [base, setBase] = useState<ProjectDraft>(() => toDraft(project));
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<ReactNode>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Take the server's copy when it changes (after a save or a transition), unless the person is mid-edit.
  useEffect(() => {
    const next = toDraft(project);
    setBase(next);
    setD((cur) => (sameDraft(cur, base) ? next : cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.version, project.approval_status, project.updated_at]);

  const dirty = !sameDraft(d, base);
  const live = project.approval_status === "approved" || project.approval_status === "submitted";
  const deletable = !live;
  const set = <K extends keyof ProjectDraft>(k: K, v: ProjectDraft[K]) => {
    setMsg(null);
    setD((p) => ({ ...p, [k]: v }));
  };

  async function doSave() {
    setErr(null);
    setMsg(null);
    setConfirming(false);
    setBusy(true);
    try {
      const r = await save({
        data: {
          code,
          id: project.id,
          expectedVersion: project.version,
          content: draftToContent(d),
        },
      });
      await onSaved();
      setMsg(
        r.reopened ? (
          <span className="text-signal-caution">
            Saved as version {r.version}. The project is back in draft; its share links are paused
            until it is approved again.
          </span>
        ) : (
          <span className="text-signal-positive">Saved.</span>
        ),
      );
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (
      !window.confirm(
        `Delete “${project.title}”? Its compliance record, links and interest are deleted with it. This cannot be undone.`,
      )
    )
      return;
    setErr(null);
    setBusy(true);
    try {
      await del({ data: { code, id: project.id } });
      await navigate({ to: "/admin/countries/$code/investments", params: { code } });
    } catch (e) {
      setErr(errMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="max-w-3xl">
        {live && (
          <Note
            tone="caution"
            className="mb-6"
            title={
              project.approval_status === "approved"
                ? "This project is approved"
                : "This project is awaiting approval"
            }
          >
            {project.approval_status === "approved"
              ? "Saving any change sends it back to draft. Its share links pause and it must be submitted and approved again."
              : "Saving any change withdraws the submission and returns the project to draft."}
          </Note>
        )}
        <ProjectForm d={d} set={set} disabled={busy} />
        <div className="sticky bottom-0 mt-8 flex flex-wrap items-center gap-3 border-t border-line-200 bg-paper-0 py-3">
          <button
            type="button"
            className="btn-primary px-4 py-2 text-xs"
            disabled={busy || !dirty}
            onClick={() => (live ? setConfirming(true) : doSave())}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          {dirty && (
            <button
              type="button"
              className="btn-ghost px-3 py-2 text-xs"
              disabled={busy}
              onClick={() => setD(base)}
            >
              Discard changes
            </button>
          )}
          {!dirty && !msg && <span className="text-xs text-ink-500">No unsaved changes.</span>}
          {msg && <span className="text-xs">{msg}</span>}
          <ErrorText>{err}</ErrorText>
        </div>
      </div>
      <aside className="space-y-4 text-sm lg:border-l lg:border-line-200 lg:pl-6">
        <div>
          <MicroLabel>Compliance</MicroLabel>
          <p className="mt-1 text-xs text-ink-700">
            Beneficial owners and AML due diligence are kept in the restricted compliance record,
            not on this form.
          </p>
          <p className="mt-2 text-xs">
            <span
              className={project.bo_disclosed ? "text-signal-positive" : "text-signal-negative"}
            >
              {project.bo_disclosed ? "Owners disclosed" : "Owners not disclosed"}
            </span>
            {" · "}
            <span className={project.aml_cleared ? "text-signal-positive" : "text-signal-negative"}>
              {project.aml_cleared ? "AML cleared" : "AML not cleared"}
            </span>
          </p>
        </div>
        <div>
          <MicroLabel>Record</MicroLabel>
          <p className="mt-1 text-xs text-ink-700">
            Created {formatDate(project.created_at)} · updated{" "}
            {formatDate(project.updated_at, true)}
          </p>
        </div>
        {deletable && (
          <button
            type="button"
            className="btn-ghost px-0 py-1 text-xs"
            disabled={busy}
            onClick={doDelete}
          >
            <span className="text-signal-negative">Delete this project</span>
          </button>
        )}
      </aside>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-md rounded-none border-line-200 bg-paper-0 sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal text-ink-950">
              {project.approval_status === "approved"
                ? "Reopen an approved project?"
                : "Withdraw the submission?"}
            </DialogTitle>
            <DialogDescription className="text-sm text-ink-700">
              {project.approval_status === "approved"
                ? "Saving will return the project to draft as a new version. Share links pause, and investors who open them will see “This link is not available” until it is approved again. Approved investor materials belong to the old version and will need a new version."
                : "Saving will return the project to draft. It will need to be submitted again and approved by someone other than the submitter."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => setConfirming(false)}
            >
              Keep editing
            </button>
            <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={doSave}>
              Save and reopen
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
