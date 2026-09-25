import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { AuditTable, TableSkeleton } from "@/components/standards/AuditTable";
import { IMPACT_LABEL, MICRO, STATUS_META } from "@/components/standards/labels";
import { MappingSuggestions } from "@/components/standards/MappingSuggestions";
import { PlanSheet } from "@/components/standards/PlanSheet";
import { StandardsRow } from "@/components/standards/StandardsRow";
import { SummaryStrip } from "@/components/standards/SummaryStrip";
import { getStandardsAudit, snapshotNow, type PlanSummary } from "@/lib/standards/audit.functions";
import { gapOrder, STATUS_ORDER, type AuditRow, type ReqStatus } from "@/lib/standards/scoring";
import { cn } from "@/lib/utils";
import "@/lib/explain/standards-entries";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/standards")({
  head: ({ params }) => ({
    meta: [
      { title: `Standards audit · ${params.code} — GDPVision` },
      {
        name: "description",
        content: `Reporting-standards coverage, data gaps and approved collection plans for ${params.code}.`,
      },
      { property: "og:title", content: `Standards audit · ${params.code}` },
      {
        property: "og:description",
        content: `Reporting-standards coverage and collection plans for ${params.code}.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StandardsPage,
});

type Tab = "gaps" | "approval" | "plans" | "all";
const PLAN_ORDER: Record<string, number> = { returned: 0, submitted: 1, draft: 2, approved: 3 };

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function StandardsPage() {
  const { code } = Route.useParams();
  const qc = useQueryClient();
  const fetchAudit = useServerFn(getStandardsAudit);
  const record = useServerFn(snapshotNow);
  const q = useQuery({
    queryKey: ["standards-audit", code],
    queryFn: () => fetchAudit({ data: { code } }),
  });

  const [tab, setTab] = useState<Tab>("gaps");
  const [standard, setStandard] = useState<string | null>(null);
  const [status, setStatus] = useState<ReqStatus | "">("");
  const [impact, setImpact] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const data = q.data;
  const plans = useMemo(
    () => new Map<string, PlanSummary>((data?.plans ?? []).map((p) => [p.requirementId, p])),
    [data],
  );
  const awaiting = useMemo(
    () =>
      data && data.capabilities.approvePlans
        ? data.plans.filter((p) => p.status === "submitted" && p.submittedBy !== data.userId)
        : [],
    [data],
  );

  const visible = useMemo(() => {
    if (!data) return [];
    let rows: AuditRow[] = data.rows;
    if (tab === "gaps") rows = rows.filter((r) => r.status !== "collected");
    if (tab === "approval") {
      const ids = new Set(awaiting.map((p) => p.requirementId));
      rows = rows.filter((r) => ids.has(r.id));
    }
    if (tab === "plans") rows = rows.filter((r) => plans.has(r.id));
    if (standard) rows = rows.filter((r) => r.standardCode === standard);
    if (status) rows = rows.filter((r) => r.status === status);
    if (impact) rows = rows.filter((r) => r.impact === impact);
    const s = search.trim().toLowerCase();
    if (s)
      rows = rows.filter(
        (r) => r.label.toLowerCase().includes(s) || (r.clause ?? "").toLowerCase().includes(s),
      );
    const sorted = [...rows];
    if (tab === "plans" || tab === "approval") {
      sorted.sort((a, b) => {
        const pa = plans.get(a.id)!;
        const pb = plans.get(b.id)!;
        return (
          (PLAN_ORDER[pa.status] ?? 9) - (PLAN_ORDER[pb.status] ?? 9) ||
          (pa.dueDate ?? "9999").localeCompare(pb.dueDate ?? "9999") ||
          gapOrder(a, b)
        );
      });
    } else {
      sorted.sort(gapOrder);
    }
    return sorted;
  }, [data, tab, standard, status, impact, search, plans, awaiting]);

  const openRow = data?.rows.find((r) => r.id === openId) ?? null;
  const filtered = !!(standard || status || impact || search.trim());

  async function onRecord() {
    setRecording(true);
    setRecordError(null);
    try {
      await record({ data: { code } });
      await qc.invalidateQueries({ queryKey: ["standards-audit", code] });
    } catch (e) {
      setRecordError((e as Error).message);
    } finally {
      setRecording(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; count?: number; show: boolean }> = [
    {
      id: "gaps",
      label: "Gap register",
      count: data ? data.rows.filter((r) => r.status !== "collected").length : undefined,
      show: true,
    },
    {
      id: "approval",
      label: "Awaiting my approval",
      count: awaiting.length,
      show: !!data?.capabilities.approvePlans,
    },
    { id: "plans", label: "Plans", count: data?.plans.length, show: true },
    { id: "all", label: "All requirements", count: data?.rows.length, show: true },
  ];

  const emptyText =
    tab === "approval"
      ? "Nothing is waiting for your approval."
      : tab === "plans"
        ? filtered
          ? "No plans match these filters."
          : "No collection plans yet. Open a requirement in the gap register to draft one."
        : tab === "gaps" && !filtered
          ? "No gaps: every requirement is collected."
          : "No requirements match these filters.";

  const select =
    "border border-line-200 bg-paper-0 px-2 py-1.5 text-xs text-ink-950 focus:border-ink-950 focus:outline-none";

  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Standards audit" },
      ]}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className={MICRO}>{code} · Reporting standards</div>
          <h1 className="mt-1 font-display text-3xl text-ink-950">Data standards audit</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-700">
            Which figures international standards require, which this country already publishes on
            time, and the approved plan that closes each gap.
          </p>
        </div>
        <Link
          to="/admin/countries/$code/investments"
          params={{ code }}
          className="btn-secondary px-3 py-2 text-xs"
        >
          Investment pipeline →
        </Link>
      </div>

      {q.isLoading && (
        <>
          <div
            className="mb-8 grid gap-6 border-y border-line-200 py-5 sm:grid-cols-4"
            aria-busy="true"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse bg-paper-50" />
            ))}
          </div>
          <TableSkeleton />
        </>
      )}

      {q.error && (
        <div className="border-l-2 border-signal-negative py-2 pl-4">
          <p className="text-sm text-signal-negative">
            The audit could not be loaded: {(q.error as Error).message}
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

      {data && data.rows.length === 0 && (
        <p className="border-l-2 border-line-200 py-6 pl-4 text-sm text-ink-500">
          The standards library has no requirements yet, so there is nothing to audit.
        </p>
      )}

      {data && data.rows.length > 0 && (
        <>
          <SummaryStrip
            summary={data.summary}
            rows={data.rows}
            snapshots={data.snapshots}
            currentMonth={currentMonth()}
            canRecord={data.capabilities.isAdmin}
            recording={recording}
            recordError={recordError}
            onRecord={onRecord}
          />

          <StandardsRow standards={data.standards} active={standard} onSelect={setStandard} />

          <MappingSuggestions
            code={code}
            pending={data.suggestionsPending}
            canApprove={data.capabilities.approvePlans}
          />

          <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-line-200">
            <div role="tablist" className="flex flex-wrap gap-5">
              {tabs
                .filter((t) => t.show)
                .map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "-mb-px border-b-2 pb-2 text-sm transition-colors",
                      tab === t.id
                        ? "border-gold-500 text-ink-950"
                        : "border-transparent text-ink-500 hover:text-ink-950",
                    )}
                  >
                    {t.label}
                    {t.count != null && (
                      <span
                        className={cn(
                          "ml-1.5 tabular-nums",
                          t.id === "approval" && t.count > 0 ? "text-gold-500" : "text-ink-400",
                        )}
                      >
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search requirements"
              aria-label="Search requirements"
              className={cn(select, "w-56")}
            />
            <select
              aria-label="Status"
              className={select}
              value={status}
              onChange={(e) => setStatus(e.target.value as ReqStatus | "")}
            >
              <option value="">Any status</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
            <select
              aria-label="Impact"
              className={select}
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
            >
              <option value="">Any impact</option>
              {["high", "medium", "low"].map((i) => (
                <option key={i} value={i}>
                  {IMPACT_LABEL[i]} impact
                </option>
              ))}
            </select>
            <select
              aria-label="Standard"
              className={select}
              value={standard ?? ""}
              onChange={(e) => setStandard(e.target.value || null)}
            >
              <option value="">Every standard</option>
              {data.standards.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            {filtered && (
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs"
                onClick={() => {
                  setStandard(null);
                  setStatus("");
                  setImpact("");
                  setSearch("");
                }}
              >
                Clear filters
              </button>
            )}
            <span className="ml-auto text-xs tabular-nums text-ink-500">
              {visible.length} shown
            </span>
          </div>

          <AuditTable
            rows={visible}
            plans={plans}
            onOpen={(r) => setOpenId(r.id)}
            empty={emptyText}
          />

          <PlanSheet
            code={code}
            row={openRow}
            capabilities={data.capabilities}
            userId={data.userId}
            onClose={() => setOpenId(null)}
          />
        </>
      )}
    </SuperAdminShell>
  );
}
