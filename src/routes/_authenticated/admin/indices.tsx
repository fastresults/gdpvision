import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { EvidenceTab } from "@/components/indices/admin/EvidenceTab";
import { MethodTab } from "@/components/indices/admin/MethodTab";
import { OverviewTab, nextActions, type Goto } from "@/components/indices/admin/OverviewTab";
import { RunsTab } from "@/components/indices/admin/RunsTab";
import { getIndicesOverview } from "@/lib/indices/review.functions";
import { useUrlState } from "@/lib/nav/url-state";

// Caribbean Indices back office: one place to keep the four indexes current
// (runs), complete (evidence), honest (method & licences) and published
// (edition review and sign-off). Server functions re-check every role.

export const Route = createFileRoute("/_authenticated/admin/indices")({
  head: () => ({
    meta: [
      { title: "Caribbean Indices — GDPVision" },
      { name: "description", content: "Run, review, evidence and publish the Caribbean Indices." },
      { property: "og:title", content: "Caribbean Indices — GDPVision" },
      {
        property: "og:description",
        content: "Run, review, evidence and publish the Caribbean Indices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IndicesAdminPage,
});

const TABS = ["overview", "runs", "evidence", "method"] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = {
  overview: "Overview",
  runs: "Runs & editions",
  evidence: "Evidence",
  method: "Method & licences",
};

function IndicesAdminPage() {
  const fetchOverview = useServerFn(getIndicesOverview);
  const q = useQuery({
    queryKey: ["indices-overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 60_000,
  });
  const navigate = useNavigate();
  const [tab] = useUrlState<Tab>("tab", "overview", { allowed: TABS });
  const [run, setRun] = useUrlState<string>("run", null);
  const [licence, setLicence] = useUrlState<"1">("licence", null, { replace: true });

  // one navigation per move, so tab + run land together and Back undoes both
  const goto: Goto = (next, opts = {}) =>
    navigate({
      to: ".",
      search: ((prev: Record<string, unknown>) => {
        const out: Record<string, unknown> = {
          ...prev,
          tab: next === "overview" ? undefined : next,
        };
        out.run = next === "runs" ? (opts.run ?? prev.run) : undefined;
        out.licence =
          next === "method" && opts.licence ? "1" : next === "method" ? prev.licence : undefined;
        return out;
      }) as never,
    });

  const todo = q.data ? nextActions(q.data, goto).filter((a) => a.tone !== "quiet").length : 0;

  return (
    <SuperAdminShell
      eyebrow="Back office · Caribbean Indices"
      crumbs={[{ label: "Caribbean Indices" }]}
    >
      <div className="min-h-dvh bg-paper-0 px-8 py-8 text-ink-950">
        <h1 className="font-serif text-3xl">Caribbean Indices</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-500">
          Growth (CGX), Human (CHX), Governance (CGV) and Capital (CCX), scored from cited, licensed
          data by fixed formulas. Runs score privately; only a signed-off official edition reaches
          GDP Advisor.
        </p>

        <nav className="mt-6 flex flex-wrap gap-2 border-b border-line-200 pb-3">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={tab === t ? "btn-primary" : "btn-secondary"}
              onClick={() => goto(t)}
            >
              {LABEL[t]}
              {t === "overview" && todo > 0 ? ` (${todo})` : ""}
              {t === "evidence" && q.data?.evidence.unverified
                ? ` (${q.data.evidence.unverified})`
                : ""}
            </button>
          ))}
        </nav>

        {q.isLoading && <p className="mt-8 text-sm text-ink-500">Loading…</p>}
        {q.error && (
          <p className="mt-8 text-sm text-red-700">
            {(q.error as Error).message === "Forbidden"
              ? "You need the admin or data steward role to use this page."
              : (q.error as Error).message}
          </p>
        )}
        {q.data && tab === "overview" && <OverviewTab o={q.data} goto={goto} />}
        {q.data && tab === "runs" && <RunsTab o={q.data} runId={run} setRunId={setRun} />}
        {q.data && tab === "evidence" && <EvidenceTab o={q.data} />}
        {q.data && tab === "method" && (
          <MethodTab
            o={q.data}
            licenceOnly={licence === "1"}
            setLicenceOnly={(v) => setLicence(v ? "1" : null)}
          />
        )}
      </div>
    </SuperAdminShell>
  );
}
