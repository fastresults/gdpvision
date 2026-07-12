import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listCountryKpis, type ConsumerKpi } from "@/lib/country-data/consume.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function kpisQuery(code: string) {
  return queryOptions({
    queryKey: ["country-kpis", code],
    queryFn: () => listCountryKpis({ data: { countryCode: code } }),
    // Reflect source toggles quickly without a manual refresh.
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
}

export const Route = createFileRoute("/_authenticated/instrument/mandate/scorecard")({
  head: () => ({
    meta: [
      { title: "National Scorecard — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: Scorecard,
});

function Scorecard() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code =
    bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: kpis, dataUpdatedAt, isFetching, refetch } = useSuspenseQuery(kpisQuery(code));

  const byCategory = groupBy(kpis, (k) => k.category ?? "Uncategorized");

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <div className="flex items-baseline justify-between">
        <SectionHeader eyebrow={`${code} · Mandate`} title="National Scorecard" />
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
            {isFetching ? "Syncing…" : `Live · updated ${new Date(dataUpdatedAt).toLocaleTimeString()}`}
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
          >
            Refresh
          </button>
          <Link
            to="/instrument/mandate/studio"
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
          >
            KPI studio →
          </Link>
        </div>
      </div>

      {kpis.length === 0 ? (
        <p className="mt-16 max-w-xl text-sm text-ink-500">
          No KPIs ingested yet for {code}. Complete the country onboarding wizard
          (KPI Seed stage) or add sources via the Data dashboard to populate this
          scorecard.
        </p>
      ) : (
        <div className="mt-12 space-y-16">
          {Object.entries(byCategory).map(([category, rows]) => (
            <section key={category}>
              <h2 className="mb-6 text-xs uppercase tracking-widest text-ink-500">
                {category}
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((k) => (
                  <KpiTile key={k.id} kpi={k} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function KpiTile({ kpi }: { kpi: ConsumerKpi }) {
  const val = kpi.latest_value;
  const status = deriveStatus(kpi);
  return (
    <div className="border border-line-200 p-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
        {kpi.kpi_code}
      </p>
      <p className="mt-1 text-sm text-ink-950">{kpi.label}</p>

      <p className="mt-6 font-serif text-5xl text-ink-950" data-numeric>
        {val != null ? formatValue(val, kpi.unit) : "—"}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">
        {kpi.latest_period ?? "no reading"}
        {kpi.target != null ? ` · target ${formatValue(kpi.target, kpi.unit)}` : ""}
      </p>

      <div className="mt-6 flex items-center justify-between">
        <StatusPill status={status} />
        {kpi.source ? (
          <a
            href={kpi.source.url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-ink-950"
            title={kpi.source.title}
          >
            {kpi.source.org} ↗
          </a>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-400">
            no source
          </span>
        )}
      </div>
    </div>
  );
}

function deriveStatus(kpi: ConsumerKpi): "on_track" | "at_risk" | "off_track" | "pending" {
  if (kpi.latest_value == null || kpi.target == null) return "pending";
  const gap = kpi.direction === "down" ? kpi.target - kpi.latest_value : kpi.latest_value - kpi.target;
  const denom = Math.abs(kpi.target) || 1;
  const pct = gap / denom;
  if (pct >= 0) return "on_track";
  if (pct >= -0.1) return "at_risk";
  return "off_track";
}

function formatValue(v: number, unit: string | null) {
  const s = Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 1 }) : v.toString();
  return unit ? `${s} ${unit}` : s;
}

function groupBy<T, K extends string>(rows: T[], key: (r: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const r of rows) {
    const k = key(r);
    (out[k] ??= []).push(r);
  }
  return out;
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "on_track" ? "border-ink-950 text-ink-950" :
    status === "at_risk" ? "border-amber-600 text-amber-700" :
    status === "off_track" ? "border-red-700 text-red-700" :
    "border-line-200 text-ink-500";
  return (
    <span className={`inline-block rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${tone}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
