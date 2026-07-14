// Phase 3 — Trust signals: freshness meter, grade-downgrade alerts,
// citation coverage. Renders above the ledger enrichments. Empty tables
// degrade gracefully — the wiring is the point until stewards backfill.

import { useMemo } from "react";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  acknowledgeGradeAlert,
  getTrustSignals,
  type TrustSignals as TrustSignalsShape,
} from "@/lib/ledger.functions";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

const trustQuery = (
  code: string,
  fn: (input: { data: { countryCode: string } }) => Promise<TrustSignalsShape>,
) =>
  queryOptions({
    queryKey: ["ledger-trust", code],
    queryFn: () => fn({ data: { countryCode: code } }),
    staleTime: 60_000,
  });

export function TrustSignals({ countryCode }: { countryCode: string }) {
  const fn = useServerFn(getTrustSignals);
  const ack = useServerFn(acknowledgeGradeAlert);
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(trustQuery(countryCode, fn));

  const ackMutation = useMutation({
    mutationFn: (id: string) => ack({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ledger-trust", countryCode] }),
  });

  const sectorLabel = useMemo(
    () => new Map(CANONICAL_SECTORS.map((s) => [s.slug, s.label])),
    [],
  );

  return (
    <section className="mt-16 border-t border-line-200 pt-16">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <FreshnessTile freshness={data.freshness} sectorLabel={sectorLabel} />
        <GradeAlertsTile
          alerts={data.gradeAlerts}
          sectorLabel={sectorLabel}
          onAck={(id) => ackMutation.mutate(id)}
          pendingId={ackMutation.isPending ? ackMutation.variables : null}
        />
        <CitationCoverageTile coverage={data.citationCoverage} sectorLabel={sectorLabel} />
      </div>
    </section>
  );
}

function FreshnessTile({
  freshness,
  sectorLabel,
}: {
  freshness: TrustSignalsShape["freshness"];
  sectorLabel: Map<string, string>;
}) {
  const total = Math.max(1, freshness.total);
  const pct = (n: number) => (n / total) * 100;
  return (
    <div>
      <Eyebrow title="Freshness" note={`${freshness.total} series`} />
      {freshness.total === 0 ? (
        <p className="mt-4 text-sm text-ink-500">No series in this ledger yet.</p>
      ) : (
        <>
          <div className="mt-4 flex h-2 w-full overflow-hidden bg-line-200">
            <div className="h-full bg-emerald-600" style={{ width: `${pct(freshness.fresh)}%` }} />
            <div className="h-full bg-amber-500" style={{ width: `${pct(freshness.aging)}%` }} />
            <div className="h-full bg-red-600" style={{ width: `${pct(freshness.stale)}%` }} />
            <div className="h-full bg-ink-500/40" style={{ width: `${pct(freshness.unknown)}%` }} />
          </div>
          <ul className="mt-3 grid grid-cols-4 gap-2 text-[10px] font-mono uppercase tracking-widest text-ink-500">
            <li>Fresh <span className="ml-1 text-ink-950" data-numeric>{freshness.fresh}</span></li>
            <li>Aging <span className="ml-1 text-ink-950" data-numeric>{freshness.aging}</span></li>
            <li>Stale <span className="ml-1 text-ink-950" data-numeric>{freshness.stale}</span></li>
            <li>Unknown <span className="ml-1 text-ink-950" data-numeric>{freshness.unknown}</span></li>
          </ul>
          {freshness.worst.length > 0 && (
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Oldest observations
              </p>
              <ul className="mt-2 divide-y divide-line-200/70">
                {freshness.worst.map((r) => (
                  <li key={r.series_id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono text-[10px] uppercase text-ink-500">
                        {r.sector_code ? sectorLabel.get(r.sector_code) ?? r.sector_code : "—"}
                      </span>{" "}
                      <span className="text-ink-950">{r.metric}</span>
                    </span>
                    <span className="font-mono text-xs text-ink-700" data-numeric>
                      {r.age_days}d · [{r.confidence_grade}]
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GradeAlertsTile({
  alerts,
  sectorLabel,
  onAck,
  pendingId,
}: {
  alerts: TrustSignalsShape["gradeAlerts"];
  sectorLabel: Map<string, string>;
  onAck: (id: string) => void;
  pendingId: string | null;
}) {
  const unacked = alerts.filter((a) => !a.acknowledged_at);
  return (
    <div>
      <Eyebrow
        title="Grade downgrades"
        note={unacked.length > 0 ? `${unacked.length} unacknowledged` : "all clear"}
      />
      {alerts.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">
          No downgrades logged. Alerts auto-fire when a series' grade drops.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line-200/70">
          {alerts.slice(0, 6).map((a) => (
            <li key={a.id} className="flex items-baseline justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  {a.sector_code ? sectorLabel.get(a.sector_code) ?? a.sector_code : "—"}
                </span>{" "}
                <span className="text-ink-950">
                  {a.previous_grade ?? "?"} → {a.new_grade}
                </span>
                {a.reason && <span className="ml-2 text-ink-500">· {a.reason}</span>}
              </span>
              <span className="font-mono text-[10px] text-ink-500">
                {new Date(a.created_at).toISOString().slice(0, 10)}
              </span>
              {!a.acknowledged_at ? (
                <button
                  onClick={() => onAck(a.id)}
                  disabled={pendingId === a.id}
                  className="font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-ink-950 disabled:opacity-50"
                >
                  Ack
                </button>
              ) : (
                <span className="font-mono text-[10px] uppercase text-emerald-700">Acked</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CitationCoverageTile({
  coverage,
  sectorLabel,
}: {
  coverage: TrustSignalsShape["citationCoverage"];
  sectorLabel: Map<string, string>;
}) {
  const good = coverage.coverage_pct >= 95;
  const warn = coverage.coverage_pct >= 70 && !good;
  const tone = good ? "text-emerald-700" : warn ? "text-amber-700" : "text-red-700";
  return (
    <div>
      <Eyebrow
        title="Citation coverage"
        note={`${coverage.with_citations}/${coverage.total_dossiers} dossiers`}
      />
      {coverage.total_dossiers === 0 ? (
        <p className="mt-4 text-sm text-ink-500">
          No sector dossiers committed yet. Run onboarding to seed dossiers.
        </p>
      ) : (
        <>
          <p className={`mt-4 font-serif text-5xl ${tone}`} data-numeric>
            {coverage.coverage_pct.toFixed(1)}%
          </p>
          <div className="mt-2 h-1 w-full bg-line-200">
            <div
              className={`h-full ${good ? "bg-emerald-600" : warn ? "bg-amber-500" : "bg-red-600"}`}
              style={{ width: `${Math.min(100, coverage.coverage_pct)}%` }}
            />
          </div>
          {coverage.unbacked.length > 0 && (
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Unbacked dossiers
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {coverage.unbacked.slice(0, 6).map((u) => (
                  <li key={u.id} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-ink-950">
                      {sectorLabel.get(u.sector_code) ?? u.sector_code}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-ink-500">{u.kind}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Eyebrow({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        {title}
        {note && <span className="ml-2 text-ink-500/70">· {note}</span>}
      </p>
      <div className="mt-2 h-px w-12 bg-ink-700" aria-hidden />
    </div>
  );
}
