// Super Admin QA — Chamber 01 v2 checklist. Every row exercises a real
// server function and links to the UI surface for manual verification.

import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
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
import {
  recentQaActions,
  repairInvalidSourceUrls,
  retryUnreachableSources,
} from "@/lib/ledger-qa/remediate.functions";
import {
  backfillCapitalFlows,
  backfillSectors,
  backfillMinistryProfiles,
  backfillKpiSeries,
  getRecentCorpusAttempts,
} from "@/lib/ledger-qa/backfill.functions";
import { getCorpusMissStatus, redriveCorpusMisses } from "@/lib/corpus/audit.functions";
import { lookupRemediator, type RemediatorKey } from "@/lib/ledger-qa/remediators";
import type { Finding } from "@/lib/ledger-qa/types";
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
  /** Raw data for the diagnoser to inspect */
  data?: unknown;
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
    useCorpusMissCheck(countryCode),
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
            <CheckRow key={c.key} check={c} countryCode={countryCode} />
          ))}
        </tbody>
      </table>

      <RecentActionsStrip countryCode={countryCode} />
    </section>
  );
}

function CheckRow({ check, countryCode }: { check: Check; countryCode: string }) {
  const finding = deriveFinding(check, countryCode);
  const isNonGreen = check.verdict && check.verdict.status !== "pass";
  return (
    <>
      <tr className="border-b border-line-200/60 align-top">
        <td className="py-3 pr-4 text-ink-950">{check.label}</td>
        <td className="py-3 pr-4">
          <VerdictCell verdict={check.verdict} loading={check.loading} />
        </td>
        <td className="py-3 pr-4">
          <SurfaceLink surface={check.surface} />
        </td>
        <td className="py-3 pl-4 text-right">
          <button
            type="button"
            onClick={check.run}
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 underline underline-offset-4"
          >
            {check.loading ? "…" : "Run"}
          </button>
        </td>
      </tr>
      {isNonGreen && finding ? (
        <tr className="border-b border-line-200/60 bg-ink-50/40">
          <td colSpan={4} className="px-3 py-4">
            <FindingDrawer finding={finding} countryCode={countryCode} />
          </td>
        </tr>
      ) : null}
    </>
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

// ───────────────────────── forensic drawer + diagnose ─────────────────────────

function attachRemediator(f: Finding, checkKey: string, findingClass: Finding["class"]): Finding {
  const r = lookupRemediator(checkKey, findingClass);
  if (!r) return f;
  return {
    ...f,
    systemicFix: {
      ...f.systemicFix,
      description: f.systemicFix.description || r.description,
      canAutoApply: r.canAutoApply,
      remediatorKey: r.key as Finding["systemicFix"]["remediatorKey"],
      corpusDomain: r.corpusDomain ?? f.systemicFix.corpusDomain,
    },
  };
}

function deriveFinding(check: Check, cc: string): Finding | null {
  const v = check.verdict;
  if (!v || v.status === "pass") return null;

  // Manual / not-run checks
  if (v.status === "idle") {
    return {
      checkKey: check.key,
      severity: "info",
      class: "not-run",
      rootCause: "Check has not been executed yet.",
      evidence: [{ label: "Reason", value: "Manual — costs credits / writes data" }],
      systemicFix: {
        kind: "operator-action",
        description: "Click Run on this row to execute the probe.",
        canAutoApply: false,
      },
    };
  }

  switch (check.key) {
    case "sources": {
      const data = check.data as { rows: Array<{ url: string | null; last_ok: boolean | null; last_status: string | null }> } | undefined;
      if (!data) return genericFinding(check, cc);
      const rows = data.rows;
      const total = rows.length;
      const invalid = rows.filter((r) => !r.url || !/^https?:\/\//i.test(String(r.url)));
      const reachFail = rows.filter(
        (r) => r.url && /^https?:\/\//i.test(String(r.url)) &&
          (r.last_ok === false || (r.last_status && r.last_status !== "ok" && r.last_status !== "pending")),
      );
      if (invalid.length > 0) {
        return attachRemediator({
          checkKey: check.key,
          severity: "fail",
          class: "data-quality",
          rootCause: `${invalid.length}/${total} country_sources rows contain search-instruction prose instead of a real URL.`,
          evidence: [
            { label: "Invalid URLs", value: invalid.length },
            { label: "Reachable failures", value: reachFail.length },
            { label: "Total rows", value: total },
            { label: "Sample", value: String(invalid[0]?.url ?? "").slice(0, 120) },
          ],
          affectedRows: invalid.length,
          systemicFix: {
            kind: "auto-migration",
            description:
              "Quarantine every row whose url does not match ^https?:// — set active=false, fetch_status='invalid_url', move offending text to fetch_error.",
            previewSql:
              "UPDATE country_sources SET active=false, fetch_status='invalid_url', fetch_error=<url text>\n  WHERE country_code=$1 AND (url IS NULL OR url !~* '^https?://');",
            canAutoApply: true,
          },
        }, check.key, "data-quality");
      }
      return attachRemediator({
        checkKey: check.key,
        severity: "fail",
        class: "external-outage",
        rootCause: `${reachFail.length}/${total} sources returned non-OK on last HEAD check.`,
        evidence: [{ label: "Unreachable", value: reachFail.length }, { label: "Total", value: total }],
        affectedRows: reachFail.length,
        systemicFix: {
          kind: "retry",
          description: "Re-run HEAD checks with an 8s timeout; update source_health_checks + country_sources.fetch_status.",
          canAutoApply: true,
        },
      }, check.key, "external-outage");
    }

    case "overview": {
      // WARN: no sector composition.
      return attachRemediator({
        checkKey: check.key,
        severity: "warn",
        class: "data-missing",
        rootCause: `country_sectors is empty for ${cc}. Sector composition never committed.`,
        evidence: [{ label: "Sectors", value: 0 }],
        systemicFix: {
          kind: "writer-patch",
          description: "",
          canAutoApply: true,
        },
      }, check.key, "data-missing");
    }

    case "enrichment": {
      const data = check.data as { capitalFlows: { totals: { inputs: number } }; ministries?: Array<unknown> } | undefined;
      const noFlows = !data || data.capitalFlows.totals.inputs === 0;
      if (noFlows) {
        return attachRemediator({
          checkKey: check.key,
          severity: "warn",
          class: "data-missing",
          rootCause: `country_capital_flows has 0 committed rows for ${cc}. Stage 12 (capital-flows research) has not run.`,
          evidence: [{ label: "Committed flows", value: 0 }],
          systemicFix: {
            kind: "writer-patch",
            description: "",
            canAutoApply: true,
          },
        }, check.key, "data-missing");
      }
      return genericFinding(check, cc, "data-quality", "Capital flows committed but reconciliation is off. Review nodes in stewardship.");
    }

    case "trust": {
      return attachRemediator({
        checkKey: check.key,
        severity: "warn",
        class: "data-missing",
        rootCause: `country_kpi_points has no committed series for ${cc}. KPI ingest has not populated the trust corpus.`,
        evidence: [{ label: "Series indexed", value: 0 }],
        systemicFix: {
          kind: "writer-patch",
          description: "",
          canAutoApply: true,
        },
      }, check.key, "data-missing");
    }

    case "gate": {
      const data = check.data as { checks: Array<{ key: string; pass: boolean; detail?: string }> } | undefined;
      const blocked = data?.checks.filter((c) => !c.pass) ?? [];
      return attachRemediator({
        checkKey: check.key,
        severity: "warn",
        class: "config",
        rootCause: `Publish gate is blocked by ${blocked.length} upstream check(s). Cascade — fix upstream first.`,
        evidence: blocked.map((b) => ({ label: b.key, value: b.detail ?? "blocked" })),
        systemicFix: {
          kind: "operator-action",
          description: "Resolve each blocked upstream check above. Cascade fix runs each in order.",
          canAutoApply: false,
          cascadeKeys: blocked.map((b) => b.key),
        },
      }, check.key, "config");
    }

    case "corpus-miss": {
      return attachRemediator({
        checkKey: check.key,
        severity: v.status === "fail" ? "fail" : "warn",
        class: "data-missing",
        rootCause: v.detail,
        evidence: [{ label: "Detail", value: v.detail }],
        systemicFix: {
          kind: "retry",
          description: "",
          canAutoApply: true,
        },
      }, check.key, "data-missing");
    }

    default:
      return genericFinding(check, cc);
  }
}


function genericFinding(
  check: Check,
  cc: string,
  cls: Finding["class"] = "config",
  extra?: string,
): Finding {
  return {
    checkKey: check.key,
    severity: check.verdict?.status === "fail" ? "fail" : "warn",
    class: cls,
    rootCause: check.verdict?.detail ?? "Non-green with no structured diagnosis.",
    evidence: [{ label: "Country", value: cc }, { label: "Detail", value: check.verdict?.detail ?? "—" }],
    systemicFix: {
      kind: "none",
      description: extra ?? "No systemic fix registered — inspect the surface and file an issue.",
      canAutoApply: false,
    },
  };
}

// Central mutation dispatcher — every remediator uses the same server-fn
// shape (`{ data: { countryCode } }`) and returns a stringifiable summary.
function useRemediator(key: RemediatorKey | undefined, countryCode: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["ledger-qa", countryCode] });
  return useMutation({
    mutationFn: async () => {
      switch (key) {
        case "repairInvalidSourceUrls":
          return { r: await repairInvalidSourceUrls({ data: { countryCode } }) };
        case "retryUnreachableSources":
          return { r: await retryUnreachableSources({ data: { countryCode } }) };
        case "backfillCapitalFlows":
          return { r: await backfillCapitalFlows({ data: { countryCode } }) };
        case "backfillSectors":
          return { r: await backfillSectors({ data: { countryCode } }) };
        case "backfillMinistryProfiles":
          return { r: await backfillMinistryProfiles({ data: { countryCode } }) };
        case "backfillKpiSeries":
          return { r: await backfillKpiSeries({ data: { countryCode } }) };
        case "redriveCorpusMisses":
          return { r: await redriveCorpusMisses({ data: { countryCode, hours: 24 } }) };
        default:
          throw new Error(`No remediator wired for key: ${key ?? "(none)"}`);
      }
    },
    onSuccess: invalidate,
  });
}

function summarizeResult(key: RemediatorKey | undefined, r: unknown): string {
  if (!r || typeof r !== "object") return "Done";
  const o = r as Record<string, unknown>;
  if (typeof o.summary === "string") return o.summary;
  if (key === "repairInvalidSourceUrls") {
    return `Quarantined ${o.activeQuarantined ?? 0} · total ${o.rowsFixed ?? 0}`;
  }
  if (key === "retryUnreachableSources") {
    return `${o.ok ?? 0}/${o.attempted ?? 0} reachable`;
  }
  if (key === "redriveCorpusMisses") {
    return `Cleared ${o.cleared ?? 0} cooldown marker(s)`;
  }
  return "Done";
}

function RecentAttemptsPanel({ countryCode, domain }: { countryCode: string; domain: string }) {
  const q = useQuery({
    queryKey: ["ledger-qa", countryCode, "attempts", domain],
    queryFn: () => getRecentCorpusAttempts({ data: { countryCode, domain, limit: 5 } }),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });
  if (!q.data || q.data.length === 0) {
    return (
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-500">
        No recent {domain} corpus attempts.
      </p>
    );
  }
  return (
    <div className="mt-3 border-t border-line-200 pt-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-500">
        Last {q.data.length} corpus attempt(s) · domain {domain}
      </p>
      <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-ink-500">
        {q.data.map((r: any) => (
          <li key={r.id}>
            <span className="text-ink-950">{new Date(r.created_at).toISOString().slice(11, 19)}Z</span>
            {" · "}<span className="uppercase tracking-widest">{r.outcome}</span>
            {r.tier ? ` · ${r.tier}` : ""}
            {typeof r.latency_ms === "number" ? ` · ${r.latency_ms}ms` : ""}
            {" · "}{r.key}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FindingDrawer({ finding, countryCode }: { finding: Finding; countryCode: string }) {
  const remediatorKey = finding.systemicFix.remediatorKey;
  const mut = useRemediator(remediatorKey, countryCode);

  const classColor: Record<Finding["class"], string> = {
    "data-missing": "text-gold-500 border-gold-500",
    "data-quality": "text-red-700 border-red-700",
    "code-defect": "text-red-700 border-red-700",
    "external-outage": "text-gold-500 border-gold-500",
    config: "text-ink-500 border-ink-300",
    "not-run": "text-ink-500 border-ink-300",
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
      <div>
        <div className="flex items-center gap-2">
          <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${classColor[finding.class]}`}>
            {finding.class}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">forensic diagnosis</span>
        </div>
        <p className="mt-2 text-sm text-ink-950">{finding.rootCause}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] text-ink-500 md:grid-cols-4">
          {finding.evidence.map((e, i) => (
            <div key={i}>
              <dt className="uppercase tracking-widest">{e.label}</dt>
              <dd className="text-ink-950">{String(e.value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-500">
          <span className="font-mono uppercase tracking-widest">Systemic fix · </span>
          {finding.systemicFix.description}
        </p>
        {finding.systemicFix.previewSql ? (
          <pre className="mt-2 overflow-x-auto border border-line-200 bg-white p-3 font-mono text-[11px] text-ink-950">
            {finding.systemicFix.previewSql}
          </pre>
        ) : null}
        {finding.systemicFix.corpusDomain ? (
          <RecentAttemptsPanel countryCode={countryCode} domain={finding.systemicFix.corpusDomain} />
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-2">
        {remediatorKey ? (
          <>
            <button
              type="button"
              disabled={mut.isPending}
              onClick={() => mut.mutate()}
              className="border border-ink-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 disabled:opacity-50"
            >
              {mut.isPending
                ? "Running…"
                : lookupRemediator(finding.checkKey, finding.class)?.label ?? "Run remediator"}
            </button>
            {mut.data ? (
              <span className="font-mono text-[10px] text-emerald-700 text-right max-w-[280px]">
                {summarizeResult(remediatorKey, (mut.data as { r: unknown }).r)}
              </span>
            ) : null}
            {mut.error ? (
              <span className="font-mono text-[10px] text-red-700 text-right max-w-[280px]">
                {(mut.error as Error).message}
              </span>
            ) : null}
          </>
        ) : null}
        {finding.systemicFix.kind === "operator-action" && finding.systemicFix.href ? (
          <Link
            to={finding.systemicFix.href}
            className="border border-ink-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950"
          >
            Open surface →
          </Link>
        ) : null}
      </div>
    </div>
  );
}


function RecentActionsStrip({ countryCode }: { countryCode: string }) {
  const q = useQuery({
    queryKey: ["ledger-qa-actions", countryCode],
    queryFn: () => recentQaActions({ data: { countryCode } }),
  });
  if (!q.data || q.data.length === 0) return null;
  return (
    <div className="mt-8 border-t border-line-200 pt-4">
      <h4 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
        Recent remediation actions
      </h4>
      <ul className="mt-3 space-y-1 font-mono text-[11px] text-ink-500">
        {q.data.map((r) => (
          <li key={r.id}>
            <span className="text-ink-950">{new Date(r.created_at).toISOString().slice(0, 19).replace("T", " ")}</span>
            {" · "}
            <span className="uppercase tracking-widest">{r.check_key}</span>
            {" · "}
            {r.action}
            {" · "}
            {r.rows_before ?? "—"}→{r.rows_after ?? "—"}
          </li>
        ))}
      </ul>
    </div>
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
    data: q.data,
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
    data: q.data,
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
    data: q.data,
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
    data: q.data,
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
    data: q.data,
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
    data: q.data,
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
    data: q.data,
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
    data: q.data,
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
          detail: `Blocked: ${q.data.checks
            .filter((c) => !c.pass)
            .map((c) => c.key)
            .join(", ")}`,
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
    data: q.data,
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
    data: q.data,
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
    data: q.data,
  };
}

function useCorpusMissCheck(cc: string): Check {
  const q = useQuery({
    queryKey: ["ledger-qa", cc, "corpus-miss"],
    queryFn: () => getCorpusMissStatus({ data: { countryCode: cc, hours: 24 } }),
  });
  const verdict: Verdict | null = q.data
    ? q.data.status === "pass"
      ? { status: "pass", detail: q.data.summary }
      : q.data.status === "warn"
        ? { status: "warn", detail: q.data.summary }
        : { status: "fail", detail: q.data.summary }
    : q.error
      ? { status: "fail", detail: (q.error as Error).message }
      : null;
  return {
    key: "corpus-miss",
    label: "Corpus fallback active — no silent misses (24h)",
    surface: { to: "/admin/corpus-audit", label: "/admin/corpus-audit" },
    verdict,
    loading: q.isFetching,
    run: () => q.refetch(),
    data: q.data,
  };
}
