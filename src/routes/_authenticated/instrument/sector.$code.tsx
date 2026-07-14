import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { getSectorDetail, listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { WhyThisNumber } from "@/components/marketing/WhyThisNumber";
import { WhyThisNumberPanel } from "@/components/ledger/WhyThisNumberPanel";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function sectorQuery(countryCode: string, sectorCode: string) {
  return queryOptions({
    queryKey: ["sector-detail", countryCode, sectorCode],
    queryFn: () => getSectorDetail({ data: { countryCode, sectorCode } }),
  });
}

export const Route = createFileRoute("/_authenticated/instrument/sector/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.code} — Sector Detail — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: SectorDetailPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-8 py-24 text-ink-500">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em]">Sector not found</p>
      <Link to="/instrument" className="mt-4 inline-block underline underline-offset-4">
        Back to instrument
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-8 py-24 text-ink-500">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em]">Sector unavailable</p>
      <p className="mt-4 text-sm">{error.message}</p>
    </div>
  ),
});

function SectorDetailPage() {
  const { code } = Route.useParams();
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const defaultCode =
    bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const [countryCode] = useState(defaultCode);

  const meta = CANONICAL_SECTORS.find((s) => s.slug === code);
  if (!meta) throw notFound();

  const { data } = useSuspenseQuery(sectorQuery(countryCode, code));
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <Link
        to="/instrument"
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
      >
        ← National Ledger
      </Link>

      <div className="mt-6 flex items-baseline gap-6">
        <span
          className="inline-block h-10 w-1"
          style={{ backgroundColor: `var(${meta.cssVar})` }}
          aria-hidden
        />
        <SectionHeader
          eyebrow={`${data.country.name} · Sector ${String(meta.index).padStart(2, "0")}`}
          title={meta.label}
        />
      </div>

      <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
        <button
          onClick={() => setPanelOpen(true)}
          className="border-t border-line-200 pt-4 text-left transition-colors hover:border-ink-950"
          title="Why this number? — grounded in the Second Brain"
        >
          <p className="flex items-baseline justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            <span>Share of GDP</span>
            <span className="text-ink-500 group-hover:text-ink-950">ⓘ ask</span>
          </p>
          <p className="mt-2 font-serif text-4xl text-ink-950" data-numeric>
            {data.sector.share_pct.toFixed(1)}%
          </p>
        </button>
        <Stat label="Confidence" value={data.sector.confidence_grade} why="confidence" />
        <Stat label="Currency" value={data.country.currency} />
      </div>

      <section className="mt-16">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          Series ({data.series.length})
        </h3>

        {data.series.length === 0 ? (
          <p className="mt-6 max-w-xl text-sm text-ink-500">
            No time series ingested for this sector yet. Data Stewards seed series through the
            stewardship queue; the sector composition above uses the seeded Phase 0 baseline.
          </p>
        ) : (
          <div className="mt-8 space-y-12">
            {data.series.map((s) => (
              <SeriesBlock key={s.id} series={s} accentVar={meta.cssVar} countryCode={countryCode} sectorLabel={meta.label} />
            ))}
          </div>
        )}
      </section>

      <WhyThisNumberPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        countryCode={countryCode}
        figureKind="sector_share"
        figureRef={{ sector_code: code, country_code: countryCode }}
        label={`${meta.label} — share of GDP (${data.country.name})`}
        value={data.sector.share_pct}
        unit="%"
        confidenceGrade={data.sector.confidence_grade}
      />
    </main>
  );
}

function Stat({ label, value, why }: { label: string; value: string; why?: string }) {
  return (
    <div className="border-t border-line-200 pt-4">
      <p className="flex items-baseline justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
        <span>{label}</span>
        {why && <WhyThisNumber slug={why} label="Why?" />}
      </p>
      <p className="mt-2 font-serif text-4xl text-ink-950" data-numeric>
        {value}
      </p>
    </div>
  );
}

function SeriesBlock({
  series,
  accentVar,
}: {
  series: {
    id: string;
    metric: string;
    unit: string;
    frequency: string;
    confidence_grade: string;
    source_name: string | null;
    points: Array<{ period: string; value: number }>;
  };
  accentVar: string;
}) {
  const path = useMemo(() => buildPath(series.points), [series.points]);
  const last = series.points[series.points.length - 1];

  return (
    <div className="border-t border-line-200 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="font-serif text-2xl text-ink-950">{series.metric}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            {series.unit} · {series.frequency} · Grade {series.confidence_grade}
            {series.source_name ? ` · ${series.source_name}` : ""}
          </p>
        </div>
        {last ? (
          <p className="font-serif text-3xl text-ink-950" data-numeric>
            {last.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              {last.period}
            </span>
          </p>
        ) : null}
      </div>
      {path ? (
        <svg viewBox="0 0 600 120" className="mt-6 h-32 w-full" aria-hidden>
          <path
            d={path}
            fill="none"
            stroke={`var(${accentVar})`}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <p className="mt-6 text-xs text-ink-500">No observations recorded.</p>
      )}
    </div>
  );
}

function buildPath(points: Array<{ period: string; value: number }>): string | null {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 600;
  const h = 120;
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.value - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
