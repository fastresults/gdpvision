import { useMemo, useState, type ReactNode } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useChildMatches,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { Explain } from "@/components/explain/Explain";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Oc4idsExportButton } from "@/components/investments/Oc4idsExportDialog";
import {
  draftToContent,
  EMPTY_DRAFT,
  ProfileFields,
  type ProjectDraft,
} from "@/components/investments/ProjectForm";
import {
  ApprovalMark,
  ErrorText,
  errMessage,
  formatUsd,
  inputCls,
  MicroLabel,
  ReadinessRule,
} from "@/components/investments/ui";
import { listInvestments, saveInvestment } from "@/lib/investments/pipeline.functions";
import { APPROVAL_LABEL, STAGE_LABEL, STAGES } from "@/lib/investments/readiness";
import { cn } from "@/lib/utils";
// Must come after any standards-entries import; it re-registers "investments.readiness".
import "@/lib/explain/investments-entries";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/investments")({
  head: ({ params }) => ({
    meta: [
      { title: `Investment pipeline · ${params.code} — GDPVision` },
      {
        name: "description",
        content: `National investment opportunities for ${params.code}, checked for investor readiness and approved by a second person before they are shared.`,
      },
      { property: "og:title", content: `Investment pipeline · ${params.code}` },
      {
        property: "og:description",
        content: `National investment opportunities for ${params.code}.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvestmentsRoute,
});

// The project workspace (countries.$code.investments.$id.tsx) is a child of
// this route; render it in place of the list when it matches.
function InvestmentsRoute() {
  const children = useChildMatches();
  if (children.length > 0) return <Outlet />;
  return <PipelinePage />;
}

type ApprovalFilter = "all" | "draft" | "submitted" | "approved" | "returned" | "withdrawn";

function PipelinePage() {
  const { code } = Route.useParams();
  const list = useServerFn(listInvestments);
  const q = useQuery({ queryKey: ["investments", code], queryFn: () => list({ data: { code } }) });

  const [approval, setApproval] = useState<ApprovalFilter>("all");
  const [stage, setStage] = useState<string>("all");
  const [sector, setSector] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);
  const caps = q.data?.capabilities;
  const userId = q.data?.userId;
  const awaitingMe = (r: (typeof rows)[number]) =>
    r.approval_status === "submitted" && !!caps?.approveInvestments && r.submitted_by !== userId;

  const sectors = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.sector?.trim()).filter((s): s is string => !!s))).sort(),
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (mine && !awaitingMe(r)) return false;
    if (approval !== "all" && r.approval_status !== approval) return false;
    if (stage !== "all" && r.stage !== stage) return false;
    if (sector !== "all" && (r.sector ?? "").trim() !== sector) return false;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      if (
        ![r.title, r.sector, r.structure, r.summary].some((v) =>
          (v ?? "").toLowerCase().includes(s),
        )
      )
        return false;
    }
    return true;
  });

  const totalCapex = rows.reduce((s, r) => s + Number(r.capex_usd ?? 0), 0);
  const approved = rows.filter((r) => r.approval_status === "approved");
  const approvedCapex = approved.reduce((s, r) => s + Number(r.capex_usd ?? 0), 0);
  const awaiting = rows.filter((r) => r.approval_status === "submitted");
  const myQueue = rows.filter(awaitingMe);

  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Investment pipeline" },
      ]}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <MicroLabel>Chamber · Investment</MicroLabel>
          <h1 className="mt-1 font-display text-3xl text-ink-950">National investment pipeline</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-700">
            Every opportunity in one standard format. A project reaches investors only after all ten
            readiness checks pass and a second person with an approver role approves it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/countries/$code/investors"
            params={{ code }}
            className="btn-ghost px-3 py-2 text-xs"
          >
            Investors
          </Link>
          <Link
            to="/admin/countries/$code/standards"
            params={{ code }}
            className="btn-ghost px-3 py-2 text-xs"
          >
            Standards audit
          </Link>
          <Oc4idsExportButton code={code} />
          <button
            type="button"
            className="btn-primary px-3 py-2 text-xs"
            onClick={() => setAdding(true)}
          >
            Add project
          </button>
        </div>
      </div>

      {q.data && (
        <div className="mb-6 grid grid-cols-2 border-y border-line-200 sm:grid-cols-4">
          <Stat label="Projects" value={String(rows.length)} />
          <Stat
            label="Total capital cost"
            value={
              <Explain
                id="investments.pipeline_capex"
                ctx={{
                  count: rows.length,
                  capex: totalCapex,
                  missingCapex: rows.filter((r) => !r.capex_usd).length,
                }}
              >
                {formatUsd(totalCapex, { empty: "US$0" })}
              </Explain>
            }
          />
          <Stat
            label="Approved for investors"
            tone="text-signal-positive"
            value={
              <Explain
                id="investments.approved_capex"
                ctx={{ count: approved.length, capex: approvedCapex, missingCapex: 0 }}
              >
                {approved.length} · {formatUsd(approvedCapex, { empty: "US$0" })}
              </Explain>
            }
          />
          <Stat
            label="Awaiting approval"
            tone={awaiting.length ? "text-signal-caution" : undefined}
            value={
              <Explain id="investments.awaiting">
                {awaiting.length}
                {myQueue.length ? ` · ${myQueue.length} for you` : ""}
              </Explain>
            }
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-ink-700">
          <span className="mb-1 block">Search</span>
          <input
            className={cn(inputCls, "w-56")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, sector, summary"
          />
        </label>
        <label className="text-xs text-ink-700">
          <span className="mb-1 block">Approval</span>
          <select
            className={cn(inputCls, "w-44")}
            value={approval}
            onChange={(e) => setApproval(e.target.value as ApprovalFilter)}
          >
            <option value="all">All</option>
            {Object.entries(APPROVAL_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-700">
          <span className="mb-1 block">Stage</span>
          <select
            className={cn(inputCls, "w-40")}
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="all">All</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-700">
          <span className="mb-1 block">Sector</span>
          <select
            className={cn(inputCls, "w-44")}
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          >
            <option value="all">All</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {caps?.approveInvestments && (
          <button
            type="button"
            aria-pressed={mine}
            onClick={() => setMine((v) => !v)}
            className={cn(
              "btn-secondary px-3 py-1.5 text-xs",
              mine &&
                "border-ink-950 text-ink-950 underline decoration-gold-500 decoration-2 underline-offset-4",
            )}
          >
            Awaiting my approval{myQueue.length ? ` (${myQueue.length})` : ""}
          </button>
        )}
      </div>

      {q.isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {q.error && <ErrorText>{errMessage(q.error)}</ErrorText>}
      {q.data && rows.length === 0 && (
        <p className="border-l-2 border-l-gold-500 pl-3 text-sm text-ink-700">
          No projects yet. Add the first opportunity to start its readiness checks.
        </p>
      )}
      {q.data && rows.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-ink-500">No projects match these filters.</p>
      )}

      {filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-line-200 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
              <tr>
                <th className="py-2 pr-3">Project</th>
                <th className="pr-3">Sector</th>
                <th className="pr-3">Stage</th>
                <th className="pr-3 text-right">Capital cost</th>
                <th className="pr-3">Readiness</th>
                <th className="pr-3">Approval</th>
                <th className="pr-3 text-right">Links</th>
                <th className="text-right">Interest</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "border-b border-line-100 align-top",
                    awaitingMe(r) && "border-l-2 border-l-signal-caution",
                  )}
                >
                  <td className="py-2.5 pr-3 pl-1">
                    <Link
                      to="/admin/countries/$code/investments/$id"
                      params={{ code, id: r.id }}
                      className="text-ink-950 underline decoration-line-200 underline-offset-4 hover:decoration-ink-950"
                    >
                      {r.title}
                    </Link>
                    {r.structure && <div className="text-xs text-ink-500">{r.structure}</div>}
                  </td>
                  <td className="pr-3 text-ink-800">
                    {r.sector ?? <span className="text-ink-400">—</span>}
                  </td>
                  <td className="pr-3 text-ink-800">
                    {STAGE_LABEL[r.stage as (typeof STAGES)[number]] ?? r.stage}
                  </td>
                  <td className="pr-3 text-right tabular-nums text-ink-950">
                    {formatUsd(r.capex_usd)}
                  </td>
                  <td className="pr-3">
                    <Explain id="investments.readiness" ctx={{ checks: r.readiness }} mark={false}>
                      <ReadinessRule score={r.score} />
                    </Explain>
                  </td>
                  <td className="pr-3">
                    <ApprovalMark status={r.approval_status} />
                    {awaitingMe(r) && (
                      <div className="text-[11px] text-signal-caution">Waiting for you</div>
                    )}
                  </td>
                  <td className="pr-3 text-right tabular-nums text-ink-700">
                    {r.activeLinks || "—"}
                  </td>
                  <td className="text-right tabular-nums text-ink-700">{r.openInterests || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddProjectDialog code={code} open={adding} onOpenChange={setAdding} />
    </SuperAdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="border-line-200 px-4 py-3 [&:not(:first-child)]:border-l">
      <MicroLabel>{label}</MicroLabel>
      <div className={cn("mt-1 font-display text-2xl tabular-nums text-ink-950", tone)}>
        {value}
      </div>
    </div>
  );
}

function AddProjectDialog({
  code,
  open,
  onOpenChange,
}: {
  code: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const save = useServerFn(saveInvestment);
  const navigate = useNavigate();
  const [d, setD] = useState<ProjectDraft>(EMPTY_DRAFT);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ProjectDraft>(k: K, v: ProjectDraft[K]) =>
    setD((p) => ({ ...p, [k]: v }));

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const r = await save({ data: { code, content: draftToContent(d) } });
      onOpenChange(false);
      setD(EMPTY_DRAFT);
      await navigate({ to: "/admin/countries/$code/investments/$id", params: { code, id: r.id } });
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setErr(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-none border-line-200 bg-paper-0 sm:rounded-none">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-normal text-ink-950">
            Add a project
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-600">
            Start with the profile. The commercial, impact and preparation details, and the
            readiness checks, are in the project workspace that opens next.
          </DialogDescription>
        </DialogHeader>
        <ProfileFields d={d} set={set} />
        <ErrorText>{err}</ErrorText>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={submit}
          >
            {busy ? "Creating…" : "Create and open"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
