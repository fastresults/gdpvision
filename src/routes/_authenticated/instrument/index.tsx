import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getInstanceOverview, listInstanceBindings } from "@/lib/ledger.functions";
import { SignatureRing } from "@/components/marketing/SignatureRing";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";
import { WhyThisNumberPanel } from "@/components/ledger/WhyThisNumberPanel";
import { LedgerEnrichments } from "@/components/ledger/LedgerEnrichments";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function overviewQuery(code: string) {
  return queryOptions({
    queryKey: ["instance-overview", code],
    queryFn: () => getInstanceOverview({ data: { countryCode: code } }),
    enabled: !!code,
  });
}

export const Route = createFileRoute("/_authenticated/instrument/")({
  head: () => ({
    meta: [
      { title: "The Instrument — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: InstanceHome,
});

type PanelState =
  | null
  | {
      kind: "sector_share" | "cbi_exposure";
      ref: Record<string, string | number | null>;
      label: string;
      value?: number | null;
      unit?: string;
      grade?: string;
    };

function InstanceHome() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const defaultCode =
    bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const [code] = useState<string>(defaultCode);
  const { data: overview } = useSuspenseQuery(overviewQuery(code));
  const [panel, setPanel] = useState<PanelState>(null);

  const compositionTotal = overview.composition.reduce((s, r) => s + r.share_pct, 0);
  const reconciliationDelta = 100 - compositionTotal;

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <SectionHeader
        eyebrow={overview.country.isCbiState ? "CBI Pilot Instance" : "Sovereign Instance"}
        title={`The ${overview.country.name} Instrument`}
      />

      {Math.abs(reconciliationDelta) > 0.5 && (
        <div className="mt-8 flex items-baseline gap-4 border-l-2 border-amber-500 bg-amber-50/40 px-4 py-3 text-sm text-amber-900">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Reconciliation</span>
          <span>
            Sector shares sum to {compositionTotal.toFixed(1)}% — {reconciliationDelta > 0 ? "+" : ""}
            {reconciliationDelta.toFixed(1)}% unallocated. Never silently rescaled.
          </span>
        </div>
      )}

      <div className="mt-16 grid grid-cols-1 gap-16 lg:grid-cols-[520px_1fr]">
        <div>
          <SignatureRing size={520} animate={true} />
          <p className="mt-6 text-xs uppercase tracking-widest text-ink-500">
            National Signature — 12 sector composition
          </p>
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-widest text-ink-500">
            National Ledger — sector composition
          </h2>
          <table className="mt-6 w-full text-sm" data-numeric>
            <thead>
              <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
                <th className="py-2 font-normal">Sector</th>
                <th className="py-2 text-right font-normal">Share</th>
                <th className="py-2 pl-6 font-normal">Grade</th>
                <th className="py-2 pl-6 text-right font-normal">Why?</th>
              </tr>
            </thead>
            <tbody>
              {CANONICAL_SECTORS.map((s) => {
                const row = overview.composition.find((c) => c.sector_code === s.slug);
                return (
                  <tr key={s.slug} className="border-b border-line-200/60">
                    <td className="py-3">
                      <Link
                        to="/instrument/sector/$code"
                        params={{ code: s.slug }}
                        className="group inline-flex items-center hover:text-ink-950"
                      >
                        <span
                          className="mr-3 inline-block h-3 w-1 align-middle"
                          style={{ backgroundColor: `var(${s.cssVar})` }}
                        />
                        <span className="group-hover:underline underline-offset-4">{s.label}</span>
                      </Link>
                    </td>
                    <td className="py-3 text-right font-mono">
                      {row ? `${row.share_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-3 pl-6 font-mono text-ink-500">
                      {row?.confidence_grade ?? "—"}
                    </td>
                    <td className="py-3 pl-6 text-right">
                      {row && (
                        <button
                          onClick={() =>
                            setPanel({
                              kind: "sector_share",
                              ref: { sector_code: s.slug, country_code: overview.country.code },
                              label: `${s.label} — share of GDP (${overview.country.name})`,
                              value: row.share_pct,
                              unit: "%",
                              grade: row.confidence_grade,
                            })
                          }
                          className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
                          title="Why this number? — grounded in the Second Brain"
                        >
                          ⓘ ask
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-12 border-l-2 border-gold-500 pl-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs uppercase tracking-widest text-ink-500">CBI Exposure Index</p>
              {overview.exposureIndex && (
                <button
                  onClick={() =>
                    setPanel({
                      kind: "cbi_exposure",
                      ref: {
                        country_code: overview.country.code,
                        period: overview.exposureIndex!.period,
                      },
                      label: `CBI Exposure Index — ${overview.country.name} ${overview.exposureIndex!.period}`,
                      value: overview.exposureIndex!.value,
                      unit: "/100",
                      grade: overview.exposureIndex!.confidence_grade,
                    })
                  }
                  className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
                >
                  ⓘ why?
                </button>
              )}
            </div>
            {overview.exposureIndex ? (
              <Link to="/instrument/exposure" className="mt-2 block hover:opacity-80">
                <p className="font-serif text-6xl" data-numeric>
                  {overview.exposureIndex.value.toFixed(1)}
                </p>
                <p className="mt-2 text-xs uppercase tracking-widest text-ink-500">
                  {overview.exposureIndex.period} · Grade {overview.exposureIndex.confidence_grade}
                </p>
              </Link>
            ) : (
              <p className="mt-2 text-sm text-ink-500">
                No exposure reading yet. Ingest a series from{" "}
                <Link to="/instrument/stewardship" className="underline underline-offset-4">
                  Stewardship
                </Link>{" "}
                to seed the index.
              </p>
            )}
          </div>
        </div>
      </div>

      <LedgerEnrichments countryCode={overview.country.code} countryName={overview.country.name} />

      {bindings.length === 0 ? (
        <div className="mt-16 border-t border-line-200 pt-8 text-sm text-ink-500">
          No instance is bound to your account yet. During Phase 1 rollout, OPEN Interactive
          provisions each nation and grants operator access; this preview shows the Saint Lucia
          pilot data.
        </div>
      ) : null}


      {panel && (
        <WhyThisNumberPanel
          open={true}
          onOpenChange={(o) => !o && setPanel(null)}
          countryCode={overview.country.code}
          figureKind={panel.kind}
          figureRef={panel.ref}
          label={panel.label}
          value={panel.value ?? undefined}
          unit={panel.unit}
          confidenceGrade={panel.grade}
        />
      )}
    </main>
  );
}
