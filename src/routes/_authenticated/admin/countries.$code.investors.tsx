import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { Explain } from "@/components/explain/Explain";
import { InterestCard, isOverdue } from "@/components/investments/InterestCard";
import { InterestEditor } from "@/components/investments/InterestEditor";
import { InvestorEditor, KycMark } from "@/components/investments/InvestorEditor";
import {
  ErrorText,
  errMessage,
  formatUsd,
  inputCls,
  MicroLabel,
  tabListCls,
  tabTriggerCls,
} from "@/components/investments/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listInterests,
  listInvestors,
  type InterestView,
  type InvestorView,
} from "@/lib/investments/investors.functions";
import {
  INTEREST_STAGE_GATE,
  INTEREST_STAGE_LABEL,
  INTEREST_STAGES,
  INVESTOR_KIND_LABEL,
} from "@/lib/syndication/db";
import { cn } from "@/lib/utils";
// Must come after any standards-entries import; it re-registers "investments.readiness".
import "@/lib/explain/investments-entries";

type Tab = "pipeline" | "directory";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/investors")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({
    tab: s.tab === "directory" ? "directory" : undefined,
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Investors · ${params.code} — GDPVision` },
      {
        name: "description",
        content: `Investor directory and interest pipeline for ${params.code}'s investment projects.`,
      },
      { property: "og:title", content: `Investors · ${params.code}` },
      {
        property: "og:description",
        content: `Investor directory and interest pipeline for ${params.code}.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvestorsPage,
});

function InvestorsPage() {
  const { code } = Route.useParams();
  const { tab: tabParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab: Tab = tabParam ?? "pipeline";

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
        { label: "Investors" },
      ]}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <MicroLabel>Chamber · Investment</MicroLabel>
          <h1 className="mt-1 font-display text-3xl text-ink-950">Investors</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-700">
            Who is interested in which project, what happens next, and the investor directory. An
            interest cannot reach the data room without a signed NDA, or due diligence without a
            matched investor whose KYC is cleared.
          </p>
        </div>
        <Link
          to="/admin/countries/$code/investments"
          params={{ code }}
          className="btn-ghost px-3 py-2 text-xs"
        >
          Investment pipeline
        </Link>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) =>
          navigate({ search: { tab: v === "directory" ? "directory" : undefined }, replace: true })
        }
      >
        <TabsList className={tabListCls}>
          <TabsTrigger value="pipeline" className={tabTriggerCls}>
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="directory" className={tabTriggerCls}>
            Directory
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="pt-6">
          <PipelineBoard code={code} />
        </TabsContent>
        <TabsContent value="directory" className="pt-6">
          <Directory code={code} />
        </TabsContent>
      </Tabs>
    </SuperAdminShell>
  );
}

// ------------------------------------------------------------------ pipeline

function PipelineBoard({ code }: { code: string }) {
  const fetchI = useServerFn(listInterests);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["investor-interests", code, "all"],
    queryFn: () => fetchI({ data: { code } }),
  });
  const [project, setProject] = useState("all");
  const [showClosed, setShowClosed] = useState(true);
  const [editing, setEditing] = useState<InterestView | null>(null);
  const [adding, setAdding] = useState(false);

  const all = q.data?.interests ?? [];
  const rows = all.filter((i) => project === "all" || i.project_id === project);
  const stages = INTEREST_STAGES.filter(
    (s) => showClosed || (s !== "closed_won" && s !== "closed_lost"),
  );
  const unmatched = rows.filter((i) => !i.investor_id && i.source === "share_link").length;
  const overdue = rows.filter((i) => isOverdue(i)).length;

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["investor-interests", code] });
    await qc.invalidateQueries({ queryKey: ["investors", code] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-700">
            <span className="mb-1 block">Project</span>
            <select
              className={cn(inputCls, "w-64")}
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="all">All projects</option>
              {(q.data?.projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-1.5 text-xs text-ink-700">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
            />
            Show closed
          </label>
          {unmatched > 0 && (
            <span className="pb-1.5 text-xs text-signal-caution">
              {unmatched} enquiries to match to an investor
            </span>
          )}
          {overdue > 0 && (
            <span className="pb-1.5 text-xs text-signal-negative">
              {overdue} overdue next steps
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-xs"
          disabled={!q.data?.projects.length}
          onClick={() => setAdding(true)}
        >
          Add interest
        </button>
      </div>

      {q.isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {q.error && <ErrorText>{errMessage(q.error)}</ErrorText>}
      {q.data && q.data.projects.length === 0 && (
        <p className="text-sm text-ink-500">
          No projects yet. Add one in the{" "}
          <Link
            to="/admin/countries/$code/investments"
            params={{ code }}
            className="underline underline-offset-2"
          >
            investment pipeline
          </Link>
          .
        </p>
      )}

      {q.data && (
        <div className="-mx-2 overflow-x-auto px-2 pb-2">
          <div className="flex gap-3" style={{ minWidth: `${stages.length * 15}rem` }}>
            {stages.map((s) => {
              const col = rows.filter((i) => i.stage === s);
              const amount = col.reduce((t, i) => t + Number(i.indicative_amount_usd ?? 0), 0);
              const withoutAmount = col.filter((i) => i.indicative_amount_usd == null).length;
              return (
                <section key={s} className="flex w-60 shrink-0 flex-col">
                  <header
                    className={cn(
                      "border-t-2 pb-2 pt-2",
                      s === "closed_lost"
                        ? "border-t-line-200"
                        : s === "closed_won"
                          ? "border-t-signal-positive"
                          : "border-t-gold-500",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm text-ink-950">{INTEREST_STAGE_LABEL[s]}</h3>
                      <span className="text-xs tabular-nums text-ink-500">{col.length}</span>
                    </div>
                    <div className="text-xs tabular-nums text-ink-700">
                      <Explain
                        id="investments.interest_by_stage"
                        ctx={{
                          stage: INTEREST_STAGE_LABEL[s],
                          count: col.length,
                          amount,
                          withoutAmount,
                        }}
                      >
                        {formatUsd(amount, { empty: "US$0" })}
                      </Explain>
                    </div>
                    {INTEREST_STAGE_GATE[s] && (
                      <div className="mt-1 text-[11px] text-ink-500">
                        Gate: {INTEREST_STAGE_GATE[s]}
                      </div>
                    )}
                  </header>
                  <div className="flex flex-1 flex-col gap-2">
                    {col.map((i) => (
                      <InterestCard
                        key={i.id}
                        interest={i}
                        showProject={project === "all"}
                        onOpen={() => setEditing(i)}
                      />
                    ))}
                    {col.length === 0 && (
                      <div className="border border-dashed border-line-200 py-4 text-center text-[11px] text-ink-400">
                        None
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {q.data && (
        <InterestEditor
          open={adding || !!editing}
          onOpenChange={(v) => {
            if (!v) {
              setAdding(false);
              setEditing(null);
            }
          }}
          code={code}
          interest={editing}
          defaultProjectId={project !== "all" ? project : undefined}
          projects={q.data.projects}
          investors={q.data.investors}
          userId={q.data.userId}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ directory

function ticket(i: InvestorView): string {
  if (i.ticket_min_usd == null && i.ticket_max_usd == null) return "—";
  if (i.ticket_min_usd != null && i.ticket_max_usd != null)
    return `${formatUsd(i.ticket_min_usd)} – ${formatUsd(i.ticket_max_usd)}`;
  if (i.ticket_min_usd != null) return `from ${formatUsd(i.ticket_min_usd)}`;
  return `up to ${formatUsd(i.ticket_max_usd)}`;
}

function Directory({ code }: { code: string }) {
  const fetchInv = useServerFn(listInvestors);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["investors", code],
    queryFn: () => fetchInv({ data: { code } }),
  });
  const [editing, setEditing] = useState<InvestorView | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");

  const rows = (q.data?.investors ?? []).filter((i) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return [i.name, i.hq_country, INVESTOR_KIND_LABEL[i.kind], ...i.sectors].some((v) =>
      (v ?? "").toLowerCase().includes(s),
    );
  });
  const current = editing ? (q.data?.investors.find((i) => i.id === editing.id) ?? editing) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-xs text-ink-700">
          <span className="mb-1 block">Search</span>
          <input
            className={cn(inputCls, "w-64")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, kind, sector"
          />
        </label>
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-xs"
          onClick={() => setAdding(true)}
        >
          Add investor
        </button>
      </div>
      {q.isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {q.error && <ErrorText>{errMessage(q.error)}</ErrorText>}
      {q.data && q.data.investors.length === 0 && (
        <p className="text-sm text-ink-500">No investors yet.</p>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line-200 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
              <tr>
                <th className="py-2 pr-3">Name</th>
                <th className="pr-3">Kind</th>
                <th className="pr-3">Ticket</th>
                <th className="pr-3">Sectors</th>
                <th className="pr-3">KYC</th>
                <th className="text-right">Open interests</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-b border-line-100 align-top">
                  <td className="py-2.5 pr-3">
                    <button
                      type="button"
                      className="text-left text-ink-950 underline decoration-line-200 underline-offset-4 hover:decoration-ink-950"
                      onClick={() => setEditing(i)}
                    >
                      {i.name}
                    </button>
                    {i.hq_country && <div className="text-xs text-ink-500">{i.hq_country}</div>}
                  </td>
                  <td className="pr-3 text-ink-800">{INVESTOR_KIND_LABEL[i.kind]}</td>
                  <td className="pr-3 tabular-nums text-ink-800">{ticket(i)}</td>
                  <td className="pr-3 text-xs text-ink-700">
                    {i.sectors.length ? i.sectors.join(", ") : "—"}
                  </td>
                  <td className="pr-3">
                    <KycMark status={i.kyc_status} />
                  </td>
                  <td className="text-right tabular-nums text-ink-800">{i.openInterests || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InvestorEditor
        open={adding || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setAdding(false);
            setEditing(null);
          }
        }}
        code={code}
        investor={current}
        canDecideKyc={!!q.data?.capabilities.compliance}
        onSaved={async () => {
          await qc.invalidateQueries({ queryKey: ["investors", code] });
          await qc.invalidateQueries({ queryKey: ["investor-interests", code] });
        }}
      />
    </div>
  );
}
