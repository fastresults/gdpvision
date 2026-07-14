// Super Admin QA — Chamber 01 v2 checklist. Every row exercises a real
// server function and links to the UI surface for manual verification.

import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import {
  askTheLedger,
  explainFigure,
  getInstanceOverview,
  getLedgerEnrichment,
  getPublishGate,
  getReconciliationReport,
  getSourceHealth,
  getTrustSignals,
  handoffFigure,
  listFigureSnapshots,
  listInstanceBindings,
  pinFigureSnapshot,
} from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

export const Route = createFileRoute("/_authenticated/admin/ledger-qa")({
  head: () => ({
    meta: [
      { title: "Ledger QA — Super Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: LedgerQaPage,
  pendingComponent: () => (
    <div className="mx-auto max-w-3xl px-8 py-24 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
      Loading ledger QA…
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-8 py-24 text-ink-500">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em]">QA unavailable</p>
      <p className="mt-4 text-sm">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-8 py-24 text-ink-500">Not found.</div>
  ),
});

type Verdict = { status: "pass" | "fail" | "warn" | "idle"; detail: string };
const IDLE_VERDICT: Verdict = { status: "idle", detail: "Manual — click Run (costs credits / writes data)" };
type Check = {
  key: string;
  label: string;
  surface: { to: string; label: string; params?: Record<string, string> };
  verdict: Verdict | null;
  loading: boolean;
  run: () => void;
};

function LedgerQaPage() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const options = bindings.length > 0 ? bindings : [{ country_code: "LCA", is_default: true }];
  const defaultCode = options.find((b) => b.is_default)?.country_code ?? options[0].country_code;
  const [code, setCode] = useState<string>(defaultCode);

  return (
    <main className="mx-auto max-w-6xl px-8 py-16">
      <SectionHeader
        eyebrow="Super Admin · Ledger QA"
        title="Chamber 01 v2 acceptance"
        lede="Every row exercises a real server function against the selected country. Green = the feature is wired end-to-end. Click the surface link to eyeball it."
      />

      <div className="mt-8 flex items-center gap-4">
        <label className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          Country
        </label>
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="border border-line-200 bg-white px-3 py-1.5 font-mono text-xs"
        >
          {options.map((b) => (
            <option key={b.country_code} value={b.country_code}>
              {b.country_code}
            </option>
          ))}
        </select>
      </div>

      <ChecklistTable countryCode={code} />
    </main>
  );
}

function ChecklistTable({ countryCode }: { countryCode: string }) {
  const qc = useQueryClient();
  const checks: Check[] = [
    useOverviewCheck(countryCode),
    useEnrichmentCheck(countryCode),
    useExplainFigureCheck(countryCode),
    useAskLedgerCheck(countryCode),
    useAskLedgerRefusalCheck(countryCode),
    useTrustSignalsCheck(countryCode),
    useReconciliationCheck(countryCode),
    useSourceHealthCheck(countryCode),
    usePublishGateCheck(countryCode),
    useSnapshotRoundtripCheck(countryCode),
    useHandoffCheck(countryCode),
  ];

  const passCount = checks.filter((c) => c.verdict?.status === "pass").length;
  const failCount = checks.filter((c) => c.verdict?.status === "fail").length;
  const warnCount = checks.filter((c) => c.verdict?.status === "warn").length;

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          {countryCode} · {checks.length} checks
        </h3>
        <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-widest">
          <span className="text-emerald-700">{passCount} pass</span>
          <span className="text-gold-500">{warnCount} warn</span>
          <span className="text-red-700">{failCount} fail</span>
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey: ["ledger-qa", countryCode] })}
            className="border border-ink-950 px-3 py-1.5 text-ink-950"
          >
            Run all
          </button>
        </div>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
            <th className="py-2 font-normal">Check</th>
            <th className="py-2 font-normal">Result</th>
            <th className="py-2 font-normal">Surface</th>
            <th className="py-2 pl-4 font-normal" />
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.key} className="border-b border-line-200/60 align-top">
              <td className="py-3 pr-4 text-ink-950">{c.label}</td>
              <td className="py-3 pr-4">
                <VerdictCell verdict={c.verdict} loading={c.loading} />
              </td>
              <td className="py-3 pr-4">
                <SurfaceLink surface={c.surface} />
              </td>
              <td className="py-3 pl-4 text-right">
                <button
                  type="button"
                  onClick={c.run}
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 underline underline-offset-4"
                >
                  {c.loading ? "…" : "Run"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function VerdictCell({ verdict, loading }: { verdict: Verdict | null; loading: boolean }): ReactNode {
  if (loading) {
    return <span className="font-mono text-[11px] text-ink-500">running…</span>;
  }
  if (!verdict) {
    return <span className="font-mono text-[11px] text-ink-500">—</span>;
  }
  const color =
    verdict.status === "pass"
      ? "text-emerald-700"
      : verdict.status === "warn"
        ? "text-gold-500"
        : verdict.status === "fail"
          ? "text-red-700"
          : "text-ink-500";
  const dot =
    verdict.status === "pass"
      ? "bg-emerald-600"
      : verdict.status === "warn"
        ? "bg-gold-500"
        : verdict.status === "fail"
          ? "bg-red-600"
          : "bg-ink-300";
  const label = verdict.status === "idle" ? "not run" : verdict.status;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={`mt-1 h-2 w-2 rounded-full ${dot}`} />
      <span className={`font-mono text-[11px] uppercase tracking-widest ${color}`}>
        {label}
      </span>
      <span className="font-mono text-[11px] text-ink-500">{verdict.detail}</span>
    </span>
  );
}

function SurfaceLink({ surface }: { surface: Check["surface"] }) {
  // Keep it simple: use generic string href to avoid typed-param gymnastics.
  return (
    <Link
      to={surface.to}
      params={surface.params as never}
      className="font-mono text-[11px] uppercase tracking-widest text-ink-500 underline underline-offset-4 hover:text-ink-950"
    >
      {surface.label}
    </Link>
  );
}

// ───────────────────────────── individual checks ──────────────────────────────

function useOverviewCheck(cc: string): Check {
  const q = useQuery({
    queryKey: ["ledger-qa", cc, "overview"],
    queryFn: () => getInstanceOverview({ data: { countryCode: cc } }),
  });
  const verdict: Verdict | null = q.data
    ? q.data.composition.length > 0
      ? { status: "pass", detail: `${q.data.composition.length} sectors, ring rendered` }
      : { status: "warn", detail: "No sector composition yet" }
    : q.error
      ? { status: "fail", detail: (q.error as Error).message }
      : null;
  return {
    key: "overview",
    label: "Signature ring + composition load",
    surface: { to: "/instrument", label: "/instrument" },
    verdict,
    loading: q.isFetching,
    run: () => q.refetch(),
  };
}

function useEnrichmentCheck(cc: string): Check {
  const q = useQuery({
    queryKey: ["ledger-qa", cc, "enrichment"],
    queryFn: () => getLedgerEnrichment({ data: { countryCode: cc } }),
  });
  const verdict: Verdict | null = q.data
    ? (() => {
        const { capitalFlows, ministries } = q.data;
        const inputs = capitalFlows.values.filter((v) =>
          capitalFlows.nodes.find((n) => n.node_key === v.node_key)?.side === "input",
        ).length;
        const outputs = capitalFlows.values.filter((v) =>
          capitalFlows.nodes.find((n) => n.node_key === v.node_key)?.side === "output",
        ).length;
        const residualPct =
          capitalFlows.totals.inputs > 0
            ? Math.abs(capitalFlows.totals.residual / capitalFlows.totals.inputs) * 100
            : 0;
        if (inputs === 0 && outputs === 0) {
          return {
            status: "warn",
            detail: `No capital_flows committed for ${cc} — run Stage 12 (capital_flows research) via country onboarding`,
          };
        }
        if (inputs >= 3 && outputs >= 4 && residualPct <= 10 && ministries.length > 0) {
          return {
            status: "pass",
            detail: `Sankey ${inputs}→${outputs}, residual ${residualPct.toFixed(1)}%, ${ministries.length} ministries`,
          };
        }
        return {
          status: "warn",
          detail: `Sankey ${inputs}→${outputs}, residual ${residualPct.toFixed(1)}%${ministries.length === 0 ? " · no ministries" : ""}`,
        };
      })()
    : q.error
      ? { status: "fail", detail: (q.error as Error).message }
      : null;
  return {
    key: "enrichment",
    label: "Sankey ≥3 inputs / ≥4 outputs / ≤10% residual + ministries",
    surface: { to: "/instrument", label: "/instrument" },
    verdict,
    loading: q.isFetching,
    run: () => q.refetch(),
  };
}

function useExplainFigureCheck(cc: string): Check {
  const q = useQuery({
    queryKey: ["ledger-qa", cc, "explain"],
    queryFn: () =>
      explainFigure({
        data: {
          countryCode: cc,
          figureKind: "composition_total",
          figureRef: { country_code: cc },
          label: "Composition total — QA probe",
        },
      }),
    // manual only — grounding call costs credits
    enabled: false,
    retry: false,
  });
  const verdict: Verdict | null = q.data
    ? q.data.grounded && q.data.citations.length > 0
      ? { status: "pass", detail: `${q.data.citations.length} citations` }
      : { status: "warn", detail: q.data.refusal_reason ?? "Ungrounded refusal (contract holds)" }
    : q.error
      ? { status: "fail", detail: (q.error as Error).message }
      : IDLE_VERDICT;
  return {
    key: "explain",
    label: "Why this number? — Second Brain grounded",
    surface: { to: "/instrument", label: "/instrument" },
    verdict,
    loading: q.isFetching,
    run: () => q.refetch(),
  };
}

function useAskLedgerCheck(cc: string): Check {
  const q = useQuery({
    queryKey: ["ledger-qa", cc, "ask"],
    queryFn: () =>
      askTheLedger({
        data: { countryCode: cc, question: `Summarize ${cc}'s largest sector and its share.` },
      }),
    enabled: false,
    retry: false,
  });
  const verdict: Verdict | null = q.data
    ? q.data.grounded
      ? { status: "pass", detail: `Grounded · ${q.data.citations.length} citations` }
      : { status: "warn", detail: q.data.refusal_reason ?? "Refused (no corpus evidence)" }
    : q.error
      ? { status: "fail", detail: (q.error as Error).message }
      : IDLE_VERDICT;
  return {
    key: "ask",
    label: "Ask the Ledger — grounded answer",
    surface: { to: "/instrument", label: "/instrument" },
    verdict,
    loading: q.isFetching,
    run: () => q.refetch(),
  };
}

function useAskLedgerRefusalCheck(cc: string): Check {
  const q = useQuery({
    queryKey: ["ledger-qa", cc, "ask-refusal"],
    queryFn: () =>
      askTheLedger({
        data: {
          countryCode: cc,
          question: "What is the average shoe size of the Prime Minister's cabinet?",
        },
      }),
    enabled: false,
    retry: false,
  });
  const verdict: Verdict | null = q.data
    ? !q.data.grounded
      ? { status: "pass", detail: "Refused ungrounded probe (contract holds)" }
      : { status: "fail", detail: "Answered without valid corpus evidence" }
    : q.error
      ? { status: "fail", detail: (q.error as Error).message }
      : IDLE_VERDICT;
  return {
    key: "ask-refuse",
    label: "Ask the Ledger — refuses ungrounded probe",
    surface: { to: "/instrument", label: "/instrument" },
    verdict,
    loading: q.isFetching,
    run: () => q.refetch(),
  };
}

function useTrustSignalsCheck(cc: string): Check {
  const q = useQuery({
    queryKey: ["ledger-qa", cc, "trust"],
    queryFn: () => getTrustSignals({ data: { countryCode: cc } }),
  });
  const verdict: Verdict | null = q.data
    ? (() => {
        const f = q.data.freshness;
        const total = f.fresh + f.aging + f.stale + f.unknown;
        const coverage = q.data.citationCoverage.coverage_pct;
        if (total > 0 && coverage >= 95) {
          return { status: "pass", detail: `Coverage ${coverage}% · ${f.stale} stale` };
        }
        if (total > 0) {
          return { status: "warn", detail: `Coverage ${coverage}% · ${f.stale} stale` };
        }
        return { status: "warn", detail: "No series indexed yet" };
      })()
    : q.error
      ? { status: "fail", detail: (q.error as Error).message }
      : null;
  return {
    key: "trust",
    label: "Freshness + citation coverage ≥95%",
    surface: { to: "/instrument", label: "/instrument" },
    verdict,
    loading: q.isFetching,
    run: () => q.refetch(),
  };
}

function useReconciliationCheck(cc: string): Check {
  const q = useQuery({
    queryKey: ["ledger-qa", cc, "recon"],
    queryFn: () => getReconciliationReport({ data: { countryCode: cc } }),
  });
  const verdict: Verdict | null = q.data
    ? q.data.issues.length === 0
      ? { status: "pass", detail: "Shares & flows reconcile" }
      : { status: "warn", detail: `${q.data.issues.length} residuals flagged` }
    : q.error
      ? { status: "fail", detail: (q.error as Error).message }
      : null;
  return {
    key: "recon",
    label: "Reconciliation — sector shares & capital flows",
    surface: { to: "/instrument/stewardship", label: "/instrument/stewardship" },
    verdict,
    loading: q.isFetching,
    run: () => q.refetch(),
  };
}

function useSourceHealthCheck(cc: string): Check {
  const q = useQuery({
    queryKey: ["ledger-qa", cc, "sources"],
    queryFn: () => getSourceHealth({ data: { countryCode: cc } }),
  });
  const verdict: Verdict | null = q.data
    ? (() => {
        const rows = q.data.rows;
        const total = rows.length;
        if (total === 0) return { status: "warn", detail: "No sources registered" };
        const invalidUrls = rows.filter(
          (r) => !r.url || !/^https?:\/\//i.test(r.url),
        ).length;
        const broken = rows.filter(
          (r) =>
            r.last_ok === false ||
            (r.last_status && r.last_status !== "ok" && r.last_status !== "pending"),
        ).length;
        const reachFailures = Math.max(0, broken - invalidUrls);
        if (invalidUrls > 0) {
          return {
            status: "fail",
            detail: `${invalidUrls}/${total} rows have non-URL text (upstream ingestion bug) · ${reachFailures} reachable failures`,
          };
        }
        return broken === 0
          ? { status: "pass", detail: `${total} sources, all reachable` }
          : { status: "fail", detail: `${broken}/${total} unreachable` };
      })()
    : q.error
      ? { status: "fail", detail: (q.error as Error).message }
      : null;
  return {
    key: "sources",
    label: "Source health — all active URLs reachable",
    surface: { to: "/instrument/stewardship", label: "/instrument/stewardship" },
    verdict,
    loading: q.isFetching,
    run: () => q.refetch(),
  };
}

function usePublishGateCheck(cc: string): Check {
  const q = useQuery({
    queryKey: ["ledger-qa", cc, "gate"],
    queryFn: () => getPublishGate({ data: { countryCode: cc } }),
  });
  const verdict: Verdict | null = q.data
    ? q.data.green
      ? { status: "pass", detail: "All gates green" }
      : {
          status: "warn",
          detail: `${q.data.checks.filter((c) => !c.pass).length} gate(s) blocked`,
        }
    : q.error
      ? { status: "fail", detail: (q.error as Error).message }
      : null;
  return {
    key: "gate",
    label: "Publish gate — composition, coverage, freshness, sources",
    surface: { to: "/instrument/stewardship", label: "/instrument/stewardship" },
    verdict,
    loading: q.isFetching,
    run: () => q.refetch(),
  };
}

function useSnapshotRoundtripCheck(cc: string): Check {
  const q = useQuery({
    queryKey: ["ledger-qa", cc, "snapshot-rt"],
    queryFn: async () => {
      const label = `QA snapshot probe · ${new Date().toISOString()}`;
      const pinned = await pinFigureSnapshot({
        data: {
          countryCode: cc,
          figureKind: "composition_total",
          figureRef: { country_code: cc, probe: "qa" },
          label,
          value: 100,
          unit: "%",
          confidenceGrade: "C",
          scope: "personal",
          note: "Ledger-QA round-trip probe",
          citations: [],
          sourceSnapshot: [],
        },
      });
      const list = await listFigureSnapshots({
        data: { countryCode: cc, scope: "personal", limit: 25 },
      });
      const found = list.find((r) => r.id === pinned.id);
      return { pinnedId: pinned.id, found: Boolean(found) };
    },
    enabled: false,
    retry: false,
  });
  const verdict: Verdict | null = q.data
    ? q.data.found
      ? { status: "pass", detail: "Pinned → retrieved (immutable)" }
      : { status: "fail", detail: "Pinned but not returned by listFigureSnapshots" }
    : q.error
      ? { status: "fail", detail: (q.error as Error).message }
      : IDLE_VERDICT;
  return {
    key: "snapshot-rt",
    label: "Snapshot pin round-trip (immutable)",
    surface: { to: "/instrument", label: "/instrument" },
    verdict,
    loading: q.isFetching,
    run: () => q.refetch(),
  };
}

function useHandoffCheck(cc: string): Check {
  const q = useQuery({
    queryKey: ["ledger-qa", cc, "handoff"],
    queryFn: async () => {
      const res = await handoffFigure({
        data: {
          target: "narrative",
          countryCode: cc,
          sectorCode: "cross-cutting",
          figureLabel: "QA handoff probe",
          figureValue: 42,
          figureUnit: "%",
          confidenceGrade: "C",
          note: "Ledger-QA handoff probe",
        },
      });
      return res;
    },
    enabled: false,
    retry: false,
  });
  const verdict: Verdict | null = q.data
    ? q.data.signalId
      ? { status: "pass", detail: `Signal created ${q.data.signalId.slice(0, 8)}…` }
      : { status: "fail", detail: "No signal id returned" }
    : q.error
      ? { status: "fail", detail: (q.error as Error).message }
      : IDLE_VERDICT;
  return {
    key: "handoff",
    label: "Speak-this-number handoff → Narrative signal",
    surface: { to: "/narrative", label: "/narrative" },
    verdict,
    loading: q.isFetching,
    run: () => q.refetch(),
  };
}
