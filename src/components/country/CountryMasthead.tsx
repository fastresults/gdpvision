// State-of-the-Nation masthead. Editorial composition: eyebrow with country
// name and date, headline, brief-strip on the right rail. Empty slots read
// "— not yet on record" per the country-home empty-state contract.

import { useEffect, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { flagUrl } from "@/lib/caricom-registry";
import { getCountryHomeSummary, type CountryHomeSummary } from "@/lib/country-home/summary.functions";

function fmtCompactUsd(v: number | null): string | null {
  if (v == null || !isFinite(v)) return null;
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)} T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)} B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)} M`;
  return v.toFixed(0);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
}

function fmtTimeShort(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function useCountUp(target: number | null, ms = 500): number | null {
  const [v, setV] = useState<number | null>(target);
  useEffect(() => {
    if (target == null) return;
    const start = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (0.2 + 0.8 * p)));
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const NotYet = () => (
  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
    — not yet on record
  </span>
);

export function summaryQueryOptions(code: string) {
  return queryOptions({
    queryKey: ["country-home-summary", code],
    queryFn: () => getCountryHomeSummary({ data: { countryCode: code } }),
    staleTime: 60_000,
  });
}

export function CountryMasthead({ code, name }: { code: string; name: string }) {
  const { data } = useQuery(summaryQueryOptions(code));
  const flag = flagUrl(code, "w160");
  const today = fmtDate(new Date());

  return (
    <section className="relative">
      {/* subtle top accent rule — draws in on mount */}
      <div className="relative mb-10 h-px w-full overflow-hidden bg-line-200">
        <span className="absolute inset-y-0 left-0 block h-full w-1/2 origin-left animate-[masthead-rule_600ms_ease-out_forwards] bg-ink-950" />
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        {/* Left — editorial column */}
        <div>
          <div className="flex items-center gap-3">
            {flag ? (
              <img
                src={flag}
                alt={`Flag of ${name}`}
                className="h-6 w-9 border border-line-200 object-cover shadow-sm"
              />
            ) : null}
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500">
              <span className="text-ink-950">{name}</span>
              <span className="mx-2 text-ink-500/60">·</span>
              <span>Sovereign instrument</span>
              <span className="mx-2 text-ink-500/60">·</span>
              <span>{today}</span>
            </p>
          </div>

          <h1 className="mt-6 font-serif text-[56px] leading-[1.05] tracking-tight text-ink-950">
            Welcome back.
          </h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-500">
            Your live economic picture, your scenario room, your cabinet dossier — grounded in
            verified sources and refreshed the moment new evidence lands.
          </p>

          {/* Attention band */}
          <AttentionBand code={code} summary={data} />
        </div>

        {/* Right — brief strip */}
        <BriefStrip summary={data} />
      </div>

      <style>{`
        @keyframes masthead-rule {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
      `}</style>
    </section>
  );
}

function BriefStrip({ summary }: { summary: CountryHomeSummary | undefined }) {
  const gdp = summary ? fmtCompactUsd(summary.gdp_usd) : null;
  const kpiUp = useCountUp(summary?.kpi_count ?? null);
  const srcUp = useCountUp(summary?.corpus_sources ?? null);
  const docUp = useCountUp(summary?.corpus_documents ?? null);

  return (
    <aside className="relative border-t border-b border-line-200 py-6 lg:border-l lg:border-r-0 lg:border-t-0 lg:border-b-0 lg:pl-8 lg:py-0">
      {/* gold hairline top — the accent */}
      <div className="hidden lg:block absolute left-8 right-0 top-0 h-px bg-gold-500/70" />
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
        Country brief
      </p>

      <dl className="mt-5 divide-y divide-line-200 border-y border-line-200">
        <Row
          label="GDP"
          value={
            gdp ? (
              <span>
                <span className="font-serif text-lg" data-numeric>{gdp}</span>
                <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">USD</span>
              </span>
            ) : null
          }
          hint={summary?.gdp_year ? String(summary.gdp_year) : undefined}
        />
        <Row
          label="KPIs on record"
          value={
            summary && summary.kpi_count > 0 ? (
              <span className="font-serif text-lg" data-numeric>{kpiUp ?? summary.kpi_count}</span>
            ) : null
          }
        />
        <Row
          label="Corpus"
          value={
            summary && (summary.corpus_sources + summary.corpus_documents) > 0 ? (
              <span>
                <span className="font-serif text-lg" data-numeric>{srcUp ?? summary.corpus_sources}</span>
                <span className="mx-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">sources</span>
                <span className="font-serif text-lg" data-numeric>{docUp ?? summary.corpus_documents}</span>
                <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">docs</span>
              </span>
            ) : null
          }
        />
        <Row
          label="Ministries"
          value={
            summary && summary.ministries > 0 ? (
              <span className="font-serif text-lg" data-numeric>{summary.ministries}</span>
            ) : null
          }
        />
        <Row
          label="Chambers"
          value={
            <span>
              <span className="font-serif text-lg" data-numeric>7</span>
              <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">live</span>
            </span>
          }
        />
      </dl>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        Last corpus commit ·{" "}
        <span className="text-ink-950">
          {fmtTimeShort(summary?.last_commit_at ?? null) ?? "—"}
        </span>
      </p>
    </aside>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode | null;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
        {label}
        {hint ? <span className="ml-1.5 text-ink-500/60">· {hint}</span> : null}
      </dt>
      <dd className="text-right tabular-nums text-ink-950">
        {value ?? <NotYet />}
      </dd>
    </div>
  );
}

function AttentionBand({
  code,
  summary,
}: {
  code: string;
  summary: CountryHomeSummary | undefined;
}) {
  const items: Array<{ label: string; href: string }> = [];
  if (summary?.pending_deliverables && summary.pending_deliverables > 0) {
    items.push({
      label: `${summary.pending_deliverables} Concierge ${summary.pending_deliverables === 1 ? "deliverable" : "deliverables"} ready`,
      href: "/concierge",
    });
  }
  if (summary?.next_cabinet_at) {
    const d = new Date(summary.next_cabinet_at);
    const rel = d.toLocaleDateString("en-GB", { weekday: "long" });
    items.push({ label: `Cabinet meets ${rel}`, href: `/admin/countries/${code}/cabinet` });
  }
  if (!items.length) return null;
  return (
    <div className="mt-8 flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
        Attention
      </span>
      <span className="text-ink-500/60">·</span>
      {items.map((it, i) => (
        <a
          key={i}
          href={it.href}
          className="border border-line-200 bg-paper-0 px-3 py-1 text-[12px] text-ink-950 transition hover:border-ink-950"
        >
          {it.label}
        </a>
      ))}
    </div>
  );
}
