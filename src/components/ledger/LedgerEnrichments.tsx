// Phase 2 — Ledger enrichments rendered below the composition table.
// Time-scrubber, CBI exposure sparkline + wind-down simulator,
// peer comparator strip, capital-flows summary, ministry↔sector heatmap,
// and "what changed since last visit" digest. All degrade gracefully when
// the underlying tables are empty — the wiring is the point until
// stewards backfill history.

import { useMemo, useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getLedgerEnrichment, type LedgerEnrichment } from "@/lib/ledger.functions";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

const enrichmentQuery = (
  code: string,
  fn: (input: { data: { countryCode: string } }) => Promise<LedgerEnrichment>,
) =>
  queryOptions({
    queryKey: ["ledger-enrichment", code],
    queryFn: () => fn({ data: { countryCode: code } }),
    staleTime: 60_000,
  });

export function LedgerEnrichments({
  countryCode,
  countryName,
}: {
  countryCode: string;
  countryName: string;
}) {
  const fn = useServerFn(getLedgerEnrichment);
  const { data } = useSuspenseQuery(enrichmentQuery(countryCode, fn));

  return (
    <section className="mt-24 space-y-16 border-t border-line-200 pt-16">
      <RecentChangesStrip revisions={data.recentRevisions} />
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <ExposureSparkline history={data.exposureHistory} countryName={countryName} />
        <PeerComparator peers={data.peerComposition} selfCode={countryCode} />
      </div>
      <CapitalFlowsSummary flows={data.capitalFlows} periods={data.capitalFlowsPeriods} />
      <MinistrySectorMatrix ministries={data.ministries} />
    </section>
  );
}

// ─── "What changed since last visit" ────────────────────────────────────────

function RecentChangesStrip({ revisions }: { revisions: LedgerEnrichment["recentRevisions"] }) {
  return (
    <div>
      <SectionEyebrow title="What changed since last visit" note="Data-revision digest" />
      {revisions.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">
          No revisions recorded yet — stewards' edits stream in here as they land.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line-200/70">
          {revisions.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  {r.sector_code ?? "—"}
                </span>{" "}
                <span className="text-ink-950">{r.metric ?? "series"}</span>
                {r.period && (
                  <span className="ml-2 font-mono text-[10px] text-ink-500">{r.period}</span>
                )}
                {r.reason && <span className="ml-2 text-ink-500">· {r.reason}</span>}
              </span>
              <span className="font-mono text-xs text-ink-700" data-numeric>
                {r.previous_value ?? "—"} → {r.new_value ?? "—"}
              </span>
              <span className="font-mono text-[10px] text-ink-500">
                {new Date(r.created_at).toISOString().slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Time-scrubbed CBI Exposure sparkline + wind-down simulator ──────────────

function ExposureSparkline({
  history,
  countryName,
}: {
  history: LedgerEnrichment["exposureHistory"];
  countryName: string;
}) {
  const [selected, setSelected] = useState<number>(history.length ? history.length - 1 : 0);
  const [windDown, setWindDown] = useState<number>(0); // 0..40 (%)

  const point = history[selected] ?? null;
  const simulated = useMemo(() => {
    if (!point) return null;
    // Simple linear simulator: reduce CBI contribution proportional to slider.
    // Uses the raw index value as a stand-in until decomposition arrives.
    return Math.max(0, point.value * (1 - windDown / 100));
  }, [point, windDown]);

  return (
    <div>
      <SectionEyebrow title="CBI Exposure Index" note="Time-scrub · wind-down simulator" />
      {history.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">
          No exposure history yet for {countryName}. Ingest a series in Stewardship to seed the
          index.
        </p>
      ) : (
        <>
          <Sparkline
            points={history.map((h) => ({ x: h.period, y: h.value }))}
            highlightIndex={selected}
          />
          <div className="mt-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-widest text-ink-500">
            <span>{history[0]?.period}</span>
            <span>{history[history.length - 1]?.period}</span>
          </div>
          <input
            type="range"
            min={0}
            max={history.length - 1}
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
            className="mt-2 w-full accent-ink-950"
            aria-label="Time scrubber"
          />
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line-200 pt-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                {point?.period} · actual · Grade {point?.confidence_grade}
              </p>
              <p className="font-serif text-4xl text-ink-950" data-numeric>
                {point?.value.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Simulated · CBI wind-down {windDown}%
              </p>
              <p className="font-serif text-4xl text-gold-700" data-numeric>
                {simulated?.toFixed(1)}
              </p>
            </div>
          </div>
          <label className="mt-4 block">
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              Wind-down slider (illustrative — full decomposition ships with stewardship v2)
            </span>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={windDown}
              onChange={(e) => setWindDown(Number(e.target.value))}
              className="mt-1 w-full accent-gold-500"
            />
          </label>
        </>
      )}
    </div>
  );
}

function Sparkline({
  points,
  highlightIndex,
}: {
  points: Array<{ x: string; y: number }>;
  highlightIndex: number;
}) {
  if (!points.length) return null;
  const W = 480;
  const H = 96;
  const min = Math.min(...points.map((p) => p.y));
  const max = Math.max(...points.map((p) => p.y));
  const span = max - min || 1;
  const step = W / Math.max(1, points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = H - ((p.y - min) / span) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const hx = highlightIndex * step;
  const hy = H - ((points[highlightIndex]?.y ?? min - min) - min) / span * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-24 w-full">
      <path d={path} fill="none" stroke="var(--ink-950)" strokeWidth={1.5} />
      <line x1={hx} y1={0} x2={hx} y2={H} stroke="var(--ink-500)" strokeDasharray="2 3" />
      <circle cx={hx} cy={hy} r={3} fill="var(--ink-950)" />
    </svg>
  );
}

// ─── Peer comparator (CBI states side-by-side) ───────────────────────────────

function PeerComparator({
  peers,
  selfCode,
}: {
  peers: LedgerEnrichment["peerComposition"];
  selfCode: string;
}) {
  const cbiPeers = peers.filter((p) => p.is_cbi_state);
  return (
    <div>
      <SectionEyebrow title="Peer comparator" note="OECS CBI cohort" />
      {cbiPeers.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">No peer instances committed yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {cbiPeers.map((p) => (
            <li
              key={p.country_code}
              className={`flex items-baseline justify-between border-b border-line-200/60 py-2 text-sm ${
                p.country_code === selfCode ? "text-ink-950" : "text-ink-700"
              }`}
            >
              <span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  {p.country_code}
                </span>{" "}
                {p.country_name}
              </span>
              <span className="font-mono text-xs">
                {p.top_sector_code} · <span data-numeric>{p.top_sector_share.toFixed(1)}%</span>
                <span className="ml-2 text-ink-500">[{p.grade}]</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Capital flows summary (Sankey-lite) ────────────────────────────────────

function CapitalFlowsSummary({
  flows,
  periods,
}: {
  flows: LedgerEnrichment["capitalFlows"];
  periods: string[];
}) {
  const nodeMap = new Map(flows.nodes.map((n) => [n.node_key, n]));
  const inputs = flows.values
    .map((v) => ({ v, n: nodeMap.get(v.node_key) }))
    .filter((x) => x.n?.side === "input")
    .sort((a, b) => b.v.value_usd_m - a.v.value_usd_m);
  const outputs = flows.values
    .map((v) => ({ v, n: nodeMap.get(v.node_key) }))
    .filter((x) => x.n?.side === "output")
    .sort((a, b) => b.v.value_usd_m - a.v.value_usd_m);
  const total = Math.max(flows.totals.inputs, flows.totals.outputs, 1);
  const residualPct = flows.totals.inputs
    ? Math.abs(flows.totals.residual) / flows.totals.inputs
    : 0;

  return (
    <div>
      <SectionEyebrow
        title="Sovereign capital flows"
        note={flows.period ? `${flows.period} · ${periods.length} periods` : "no data"}
      />
      {!flows.period ? (
        <p className="mt-4 text-sm text-ink-500">
          No capital-flow ledger committed yet. Run onboarding stage 12 to seed.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto_1fr]">
          <FlowsColumn title="Inputs" total={flows.totals.inputs} rows={inputs} scale={total} />
          <div className="hidden self-center border-l border-line-200 pl-4 text-center font-mono text-[10px] uppercase tracking-widest text-ink-500 lg:block">
            Consolidated<br />Treasury
          </div>
          <FlowsColumn title="Outputs" total={flows.totals.outputs} rows={outputs} scale={total} />
        </div>
      )}
      {flows.period && residualPct > 0.1 && (
        <p className="mt-4 border-l-2 border-amber-500 bg-amber-50/40 px-3 py-2 text-xs text-amber-900">
          Reconciliation residual {(residualPct * 100).toFixed(1)}% — never silently rescaled.
        </p>
      )}
    </div>
  );
}

function FlowsColumn({
  title,
  total,
  rows,
  scale,
}: {
  title: string;
  total: number;
  rows: Array<{ v: { node_key: string; value_usd_m: number; confidence_grade: string }; n?: { label: string } }>;
  scale: number;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
        {title} · ${Math.round(total).toLocaleString()}M
      </p>
      <ul className="mt-2 space-y-1.5">
        {rows.map(({ v, n }) => (
          <li key={v.node_key} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-ink-950">{n?.label ?? v.node_key}</span>
              <span className="font-mono text-xs text-ink-700" data-numeric>
                ${Math.round(v.value_usd_m).toLocaleString()}M
              </span>
            </div>
            <div className="mt-1 h-1 bg-line-200">
              <div
                className="h-full bg-ink-950"
                style={{ width: `${Math.min(100, (v.value_usd_m / scale) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Ministry × sector matrix ────────────────────────────────────────────────

function MinistrySectorMatrix({ ministries }: { ministries: LedgerEnrichment["ministries"] }) {
  const sectorMap = new Map(CANONICAL_SECTORS.map((s) => [s.slug, s]));
  const maxWeight =
    Math.max(1, ...ministries.flatMap((m) => m.sectors.map((s) => s.weight))) || 1;

  return (
    <div>
      <SectionEyebrow title="Ministry × sector map" note="Portfolio weight" />
      {ministries.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">No ministries committed for this instance yet.</p>
      ) : (
        <div className="mt-4 overflow-auto">
          <table className="min-w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-paper-0 px-2 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  Ministry
                </th>
                {CANONICAL_SECTORS.map((s) => (
                  <th
                    key={s.slug}
                    className="px-1 py-2 text-center align-bottom"
                    title={s.label}
                  >
                    <div
                      className="mx-auto mb-1 h-2 w-2 rounded-full"
                      style={{ backgroundColor: `var(${s.cssVar})` }}
                    />
                    <div className="font-mono text-[9px] uppercase text-ink-500">
                      {s.slug.slice(0, 3)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ministries.map((m) => (
                <tr key={m.id} className="border-t border-line-200/60">
                  <td className="sticky left-0 z-10 bg-paper-0 px-2 py-1.5 text-ink-950">
                    <div className="max-w-[220px] truncate" title={m.name}>
                      {m.name}
                    </div>
                  </td>
                  {CANONICAL_SECTORS.map((s) => {
                    const w = m.sectors.find((x) => x.sector_code === s.slug)?.weight ?? 0;
                    const meta = sectorMap.get(s.slug);
                    if (!w) return <td key={s.slug} className="px-1 py-1.5" />;
                    const alpha = 0.15 + 0.75 * (w / maxWeight);
                    return (
                      <td key={s.slug} className="px-1 py-1.5 text-center">
                        <div
                          className="mx-auto flex h-6 w-6 items-center justify-center rounded text-[10px] font-medium tabular-nums text-paper-0"
                          style={{
                            backgroundColor: `var(${meta?.cssVar ?? "--ink-950"})`,
                            opacity: alpha,
                          }}
                          title={`${m.name} → ${s.label}: weight ${w.toFixed(2)}`}
                        >
                          {w >= 0.5 ? w.toFixed(1) : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── shared ─────────────────────────────────────────────────────────────────

function SectionEyebrow({ title, note }: { title: string; note?: string }) {
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
