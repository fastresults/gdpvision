import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { Explain } from "@/components/explain/Explain";
import {
  listScorecardQueue,
  reviewScorecardKpi,
  type QueueRow,
} from "@/lib/portfolio/scorecard-queue.functions";
import "@/lib/explain/portfolio-entries";
import { useUrlState } from "@/lib/nav/url-state";

export const Route = createFileRoute("/_authenticated/admin/scorecards")({
  head: () => ({
    meta: [
      { title: "Delivery scorecards — GDPVision" },
      { name: "description", content: "Qualify ministry delivery KPIs across every country." },
      { property: "og:title", content: "Delivery scorecards — GDPVision" },
      { property: "og:description", content: "Qualify ministry delivery KPIs across every country." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScorecardsPage,
});

const TABS = [
  ["in_review", "In review"],
  ["returned", "Returned"],
  ["stale", "Stale"],
  ["qualified", "Qualified"],
] as const;

function ScorecardsPage() {
  const list = useServerFn(listScorecardQueue);
  const q = useQuery({ queryKey: ["scorecard-queue"], queryFn: () => list() });
  const [tab, setTab] = useUrlState<QueueRow["state"]>("tab", "in_review");
  const [countryQ, setCountryQ] = useUrlState<string>("country", null, { replace: true });
  const country = countryQ ?? "";
  const setCountry = (v: string) => setCountryQ(v || null);

  const rows = (q.data?.rows ?? []).filter((r) => r.state === tab && (!country || r.country_code === country));

  return (
    <SuperAdminShell eyebrow="Back office · Delivery scorecards" crumbs={[{ label: "Delivery scorecards" }]}>
      <div className="min-h-dvh bg-paper-0 px-8 py-8 text-ink-950">
        <h1 className="font-serif text-3xl">Delivery scorecards</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-500">
          AI drafts ministry KPIs from each country’s data; a second authorised person qualifies them here. Only
          qualified KPIs with current actuals receive On / At risk / Off.
        </p>

        {q.isLoading && <p className="mt-8 text-sm text-ink-500">Loading…</p>}
        {q.error && <p className="mt-8 text-sm text-red-700">{(q.error as Error).message}</p>}

        {q.data && (
          <>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full text-sm" data-numeric>
                <thead>
                  <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
                    <th className="py-2 font-normal">Country</th>
                    <th className="py-2 text-right font-normal">
                      <Explain id="portfolio.scorecard-coverage" ctx={{}}>Coverage</Explain>
                    </th>
                    <th className="py-2 text-right font-normal">Setups started</th>
                    <th className="py-2 text-right font-normal">In review</th>
                    <th className="py-2 text-right font-normal">Qualified</th>
                    <th className="py-2 text-right font-normal">Stale</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.coverage.map((c) => (
                    <tr key={c.code} className="border-b border-line-200/60">
                      <td className="py-2">
                        <button type="button" className="hover:underline" onClick={() => setCountry(country === c.code ? "" : c.code)}>
                          {c.name} <span className="font-mono text-[10px] text-ink-500">{c.code}</span>
                        </button>
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        <Explain id="portfolio.scorecard-coverage" ctx={c}>
                          {c.ministries ? `${Math.round((c.qualifiedMinistries / c.ministries) * 100)}%` : "—"}
                        </Explain>
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">{c.started}/{c.ministries}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{c.inReview}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{c.qualified}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{c.stale}</td>
                      <td className="py-2 text-right">
                        <Link
                          to="/admin/countries/$code/portfolio"
                          params={{ code: c.code }}
                          className="font-mono text-[10px] uppercase tracking-[0.2em] hover:underline"
                        >
                          Set up →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-2">
              {TABS.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={tab === k ? "btn-primary" : "btn-secondary"}
                >
                  {label} ({(q.data?.rows ?? []).filter((r) => r.state === k && (!country || r.country_code === country)).length})
                </button>
              ))}
              {country && (
                <button type="button" className="btn-ghost" onClick={() => setCountry("")}>
                  Filter: {country} ✕
                </button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {rows.length === 0 && <p className="text-sm text-ink-500">Nothing here.</p>}
              {rows.map((r) => (
                <ReviewCard key={r.id} r={r} />
              ))}
            </div>
          </>
        )}
      </div>
    </SuperAdminShell>
  );
}

function ReviewCard({ r }: { r: QueueRow }) {
  const qc = useQueryClient();
  const review = useServerFn(reviewScorecardKpi);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(action: "approve" | "return") {
    setBusy(true);
    try {
      await review({ data: { kpiId: r.id, action, note: note || undefined, confirmInferred: confirm } });
      toast.success(action === "approve" ? "KPI qualified" : "Returned to preparer");
      await qc.invalidateQueries({ queryKey: ["scorecard-queue"] });
      await qc.invalidateQueries({ queryKey: ["portfolio-delivery-kpis", r.country_code] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const fmt = (n: number | null) => (n == null ? "—" : n.toFixed(2));
  return (
    <div className="border border-line-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-ink-950">
          {r.metric} <span className="text-ink-500">({r.unit})</span>
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          {r.country_code} · {r.ministry} · {r.source === "ai" ? "AI drafted" : "Manual"}
          {r.inferred ? " · Inferred" : ""}
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-6">
        <D l="Baseline" v={`${fmt(r.baseline)} @ ${r.baseline_period ?? "?"}`} />
        <D l="Target" v={`${fmt(r.target)} @ ${r.target_period ?? "?"}`} />
        <D l="Direction" v={r.direction} />
        <D l="Basis" v={r.target_basis?.replace("_", " ") ?? "—"} />
        <D l="Peer median" v={fmt(r.peer_median)} />
        <D l="Latest actual" v={r.latest ? `${fmt(r.latest.value)} @ ${r.latest.period}` : "—"} />
      </dl>
      {r.ai_rationale && <p className="mt-2 text-xs text-ink-500">{r.ai_rationale}</p>}
      {r.evidence_url && (
        <a href={r.evidence_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs underline">
          {r.evidence_url}
        </a>
      )}
      {r.review_note && <p className="mt-2 text-xs text-red-700">Review note: {r.review_note}</p>}
      {r.state === "in_review" && (
        <div className="mt-3 space-y-2">
          <input
            className="w-full border border-line-200 bg-transparent px-2 py-1 text-sm"
            placeholder="Note (required to return)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {r.inferred && (
            <label className="flex items-center gap-2 text-xs text-ink-700">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              I have checked the inferred figures against the evidence.
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy || r.owner_is_me}
              title={r.owner_is_me ? "You prepared this KPI; a second person must approve" : undefined}
              onClick={() => act("approve")}
            >
              Qualify
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => act("return")}>
              Return
            </button>
            {r.owner_is_me && <span className="self-center text-xs text-ink-500">You prepared this — needs a second person.</span>}
          </div>
        </div>
      )}
      {(r.state === "returned" || r.state === "stale") && (
        <Link
          to="/admin/countries/$code/portfolio"
          params={{ code: r.country_code }}
          className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.2em] underline"
        >
          Open setup in portfolio →
        </Link>
      )}
    </div>
  );
}

function D({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">{l}</dt>
      <dd className="mt-0.5 tabular-nums text-ink-950">{v}</dd>
    </div>
  );
}
