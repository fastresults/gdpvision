// Country Console · Mandate Compact — read-only PM Report Card view for
// country users. Shows the active (in_force → signed → draft) compact plus
// the latest scored quarter, wrapped in the mobile console shell.

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, ShieldCheck, TrendingUp } from "lucide-react";

import {
  getActiveMandateCompact,
  type PublicMandateCompact,
} from "@/lib/mandate-compact/publish.functions";
import { cn } from "@/lib/utils";

const activeCompactQuery = (code: string) =>
  queryOptions({
    queryKey: ["console-mandate", code],
    queryFn: () => getActiveMandateCompact({ data: { countryCode: code } }),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/_authenticated/console/$code/mandate")({
  head: () => ({
    meta: [
      { title: "Mandate Compact — GDPVision" },
      { name: "description", content: "The PM Report Card: every pledge, every ministry, every quarter." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(activeCompactQuery(params.code));
    return null;
  },
  notFoundComponent: () => (
    <div className="p-6 text-sm text-ink-500">No active compact for this country.</div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-rose-600">Failed to load Mandate Compact: {error.message}</div>
  ),
  component: ConsoleMandatePage,
});

function ConsoleMandatePage() {
  const { code } = Route.useParams();
  const { data } = useSuspenseQuery(activeCompactQuery(code));
  if (!data || !data.compact) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24 sm:p-6">
        <Header code={code} />
        <div className="rounded-2xl border border-dashed border-line-200 bg-paper-50 p-6 text-center text-sm text-ink-500">
          No Mandate Compact has been published yet for {code}.
        </div>
      </div>
    );
  }
  return <MandateView code={code} data={data as PublicMandateCompact} />;
}

function Header({ code }: { code: string }) {
  return (
    <header className="flex items-center gap-3">
      <Link
        to="/console/$code"
        params={{ code }}
        className="btn-ghost h-9 w-9 justify-center p-0"
        aria-label="Back to your study"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Mandate Compact · {code}</p>
        <h1 className="font-serif text-xl leading-tight text-ink-950">PM Report Card</h1>
      </div>
    </header>
  );
}

function MandateView({ code, data }: { code: string; data: PublicMandateCompact }) {
  const compact = data.compact!;
  const report = data.report;
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <Header code={code} />

      <section className="rounded-2xl border border-line-200 bg-paper-0 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink-950">
              {compact.title ?? `${compact.election_cycle} Compact`}
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              {compact.pm_name ? `PM ${compact.pm_name} · ` : ""}
              {compact.election_cycle}
            </p>
          </div>
          <StatusBadge status={compact.status} />
        </div>
        {compact.summary && <p className="mt-3 text-sm text-ink-700">{compact.summary}</p>}
      </section>

      {report && report.period ? (
        <ScoreboardSection report={report} />
      ) : (
        <div className="rounded-2xl border border-dashed border-line-200 bg-paper-50 p-5 text-sm text-ink-500">
          No quarterly scorecards yet. Once the delivery team records status updates for a quarter, the report card appears here.
        </div>
      )}

      <PillarSection pillars={compact.pillars} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    draft: "bg-paper-100 text-ink-700",
    signed: "bg-gold-500/25 text-ink-950",
    in_force: "bg-signal-lead/25 text-ink-900",
    concluded: "bg-ink-300 text-ink-50",
    superseded: "bg-ink-300 text-ink-50",
  };
  const icon = status === "in_force" || status === "signed" ? <ShieldCheck className="h-3 w-3" /> : null;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide", tone[status] ?? "bg-paper-100 text-ink-700")}>
      {icon} {status.replace("_", " ")}
    </span>
  );
}

function ScoreboardSection({ report }: { report: NonNullable<PublicMandateCompact["report"]> }) {
  const t = report.totals;
  const pct = (n: number) => `${n.toFixed(1)}%`;
  return (
    <section className="rounded-2xl border border-line-200 bg-paper-0 p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <TrendingUp className="h-4 w-4" /> Delivery scoreboard · {report.period}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          {t.deliverables_reported}/{t.deliverables_total} deliverables reported
        </span>
      </header>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatChip label="Weighted" value={pct(t.weighted_progress)} tone="gold" />
        <StatChip label="Delivered" value={pct(t.delivered_pct)} tone="lead" />
        <StatChip label="On track" value={pct(t.on_track_pct)} tone="lead-soft" />
        <StatChip label="At risk" value={pct(t.at_risk_pct)} tone="amber" />
        <StatChip label="Off / broken" value={pct(t.off_track_pct + t.broken_pct)} tone="rose" />
      </div>

      {report.ministries.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {report.ministries.map((m) => (
            <li key={m.id} className="rounded-xl border border-line-100 bg-paper-50 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ink-900">{m.ministry_name}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                  {m.deliverables_reported}/{m.deliverables_total} reported · {m.weighted_progress.toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-paper-100">
                {[
                  { pct: m.delivered_pct, cls: "bg-signal-lead" },
                  { pct: m.on_track_pct, cls: "bg-signal-lead/60" },
                  { pct: m.at_risk_pct, cls: "bg-gold-500" },
                  { pct: m.off_track_pct, cls: "bg-amber-500" },
                  { pct: m.broken_pct, cls: "bg-rose-500" },
                ].map((s, i) => s.pct > 0 && <div key={i} className={s.cls} style={{ width: `${s.pct}%` }} />)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {report.recent_updates.length > 0 && (
        <details className="mt-4 rounded-xl border border-line-100 bg-paper-50 p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-500">
            Recent status updates ({report.recent_updates.length})
          </summary>
          <ul className="mt-2 grid gap-1 text-xs">
            {report.recent_updates.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 rounded bg-paper-0 px-2 py-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{u.period}</span>
                <span className="rounded-full bg-paper-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-700">
                  {u.status.replace("_", " ")}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-700">{u.narrative ?? "—"}</span>
                {u.evidence_url && (
                  <a href={u.evidence_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900">
                    evidence <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function PillarSection({ pillars }: { pillars: NonNullable<PublicMandateCompact["compact"]>["pillars"] }) {
  if (!pillars.length) {
    return (
      <section className="rounded-2xl border border-dashed border-line-200 bg-paper-50 p-5 text-sm text-ink-500">
        No pillars yet. The compact is still being decomposed.
      </section>
    );
  }
  return (
    <section className="grid gap-3">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Transformational pillars</h3>
      {pillars.map((p) => (
        <details key={p.id} className="rounded-2xl border border-line-200 bg-paper-0 p-4" open>
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm font-semibold text-ink-900">
            <span>{p.title}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              {p.pledges.length} pledge{p.pledges.length === 1 ? "" : "s"}
            </span>
          </summary>
          {p.narrative && <p className="mt-2 text-xs text-ink-500">{p.narrative}</p>}
          <ul className="mt-3 grid gap-2">
            {p.pledges.map((pl) => (
              <li key={pl.id} className="rounded-lg bg-paper-50 p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-ink-900">{pl.title}</span>
                  {pl.pledge_type && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">{pl.pledge_type}</span>
                  )}
                </div>
                {pl.verbatim_quote && (
                  <blockquote className="mt-1 border-l-2 border-line-200 pl-2 text-xs italic text-ink-500">
                    "{pl.verbatim_quote}"
                  </blockquote>
                )}
                {pl.deliverables.length > 0 && (
                  <ul className="mt-2 grid gap-1 text-xs text-ink-600">
                    {pl.deliverables.map((d) => (
                      <li key={d.id} className="flex gap-2">
                        <span className="w-40 shrink-0 truncate font-medium text-ink-500">
                          {d.lead_ministry_name ?? "Unassigned"}
                        </span>
                        <span className="min-w-0">{d.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}

function StatChip({ label, value, tone }: { label: string; value: string; tone: "gold" | "lead" | "lead-soft" | "amber" | "rose" }) {
  const bg: Record<string, string> = {
    gold: "bg-gold-500/15",
    lead: "bg-signal-lead/20",
    "lead-soft": "bg-signal-lead/10",
    amber: "bg-amber-500/15",
    rose: "bg-rose-500/15",
  };
  return (
    <div className={cn("rounded-xl px-3 py-2", bg[tone])}>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums text-ink-950">{value}</div>
    </div>
  );
}
