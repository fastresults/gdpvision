import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { getExposureHistory, listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function exposureQuery(code: string) {
  return queryOptions({
    queryKey: ["exposure-history", code],
    queryFn: () => getExposureHistory({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/instrument/exposure")({
  head: () => ({
    meta: [
      { title: "CBI Exposure Index — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: ExposurePage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-8 py-24 text-ink-500">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em]">Exposure unavailable</p>
      <p className="mt-4 text-sm">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-8 py-24 text-ink-500">Not found.</div>
  ),
});

function ExposurePage() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const defaultCode =
    bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const [code] = useState(defaultCode);
  const { data } = useSuspenseQuery(exposureQuery(code));

  const latest = data.history[data.history.length - 1] ?? null;
  const spark = useMemo(() => buildPath(data.history.map((h) => h.value)), [data.history]);

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <SectionHeader
        eyebrow={`${data.country.name} · CBI Exposure`}
        title="Exposure Index"
        lede="Composite reading of the nation's structural reliance on Citizenship-by-Investment revenue, decomposed by contributing channel."
      />

      <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            Latest reading
          </p>
          {latest ? (
            <>
              <p className="mt-4 font-serif text-8xl leading-none text-ink-950" data-numeric>
                {latest.value.toFixed(1)}
              </p>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                {latest.period} · Grade {latest.confidence_grade}
                {latest.methodology_ref ? ` · ${latest.methodology_ref}` : ""}
              </p>
              {spark ? (
                <svg viewBox="0 0 600 120" className="mt-8 h-32 w-full" aria-hidden>
                  <path d={spark} fill="none" stroke="var(--gold-500)" strokeWidth={1.5} />
                </svg>
              ) : null}
            </>
          ) : (
            <p className="mt-6 text-sm text-ink-500">
              No exposure observations yet. Once fiscal-revenue and CBI-receipt series are ingested
              from Stewardship, the index compounds automatically.
            </p>
          )}
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            Decomposition
          </p>
          {latest && Object.keys(latest.decomposition).length > 0 ? (
            <table className="mt-6 w-full text-sm" data-numeric>
              <thead>
                <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
                  <th className="py-2 font-normal">Channel</th>
                  <th className="py-2 text-right font-normal">Weight</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(latest.decomposition).map(([key, weight]) => {
                  const sector = CANONICAL_SECTORS.find((s) => s.slug === key);
                  return (
                    <tr key={key} className="border-b border-line-200/60">
                      <td className="py-3">
                        <span
                          className="mr-3 inline-block h-3 w-1 align-middle"
                          style={{
                            backgroundColor: sector
                              ? `var(${sector.cssVar})`
                              : "var(--ink-500)",
                          }}
                        />
                        {sector?.label ?? key}
                      </td>
                      <td className="py-3 text-right font-mono">
                        {Number(weight).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="mt-6 text-sm text-ink-500">
              Decomposition surfaces here once the index is computed with a methodology reference.
            </p>
          )}
        </div>
      </div>

      <section className="mt-20">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          History ({data.history.length})
        </h3>
        {data.history.length === 0 ? (
          <p className="mt-6 max-w-xl text-sm text-ink-500">
            No history recorded. Series ingestion happens in{" "}
            <Link to="/instrument/stewardship" className="underline underline-offset-4">
              Stewardship
            </Link>
            .
          </p>
        ) : (
          <table className="mt-6 w-full text-sm" data-numeric>
            <thead>
              <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
                <th className="py-2 font-normal">Period</th>
                <th className="py-2 text-right font-normal">Value</th>
                <th className="py-2 pl-6 font-normal">Grade</th>
                <th className="py-2 pl-6 font-normal">Methodology</th>
              </tr>
            </thead>
            <tbody>
              {[...data.history].reverse().map((h) => (
                <tr key={h.period} className="border-b border-line-200/60">
                  <td className="py-3 font-mono">{h.period}</td>
                  <td className="py-3 text-right font-mono">{h.value.toFixed(2)}</td>
                  <td className="py-3 pl-6 font-mono text-ink-500">{h.confidence_grade}</td>
                  <td className="py-3 pl-6 text-ink-500">{h.methodology_ref ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function buildPath(values: number[]): string | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 600;
  const h = 120;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
