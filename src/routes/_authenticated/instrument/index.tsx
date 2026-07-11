import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getInstanceOverview, listInstanceBindings } from "@/lib/ledger.functions";
import { SignatureRing } from "@/components/marketing/SignatureRing";
import { Wordmark } from "@/components/marketing/Wordmark";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { supabase } from "@/integrations/supabase/client";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

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

function InstanceHome() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const navigate = useNavigate();

  // Default country: first binding, else LCA (Saint Lucia pilot).
  const defaultCode =
    bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const [code] = useState<string>(defaultCode);
  const { data: overview } = useSuspenseQuery(overviewQuery(code));

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <Link to="/instrument"><Wordmark /></Link>
        <div className="flex items-center gap-6 text-xs uppercase tracking-widest text-ink-500">
          <span data-numeric>
            {overview.country.name} · {overview.country.currency}
          </span>
          <button onClick={signOut} className="hover:text-ink-950">Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-16">
        <SectionHeader
          eyebrow={overview.country.isCbiState ? "CBI Pilot Instance" : "Sovereign Instance"}
          title={`The ${overview.country.name} Instrument`}
        />

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
                </tr>
              </thead>
              <tbody>
                {CANONICAL_SECTORS.map((s) => {
                  const row = overview.composition.find((c) => c.sector_code === s.slug);
                  return (
                    <tr key={s.slug} className="border-b border-line-200/60">
                      <td className="py-3">
                        <span
                          className="mr-3 inline-block h-3 w-1 align-middle"
                          style={{ backgroundColor: `var(${s.cssVar})` }}
                        />
                        {s.label}
                      </td>
                      <td className="py-3 text-right font-mono">
                        {row ? `${row.share_pct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-3 pl-6 font-mono text-ink-500">
                        {row?.confidence_grade ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-12 border-l-2 border-gold-500 pl-6">
              <p className="text-xs uppercase tracking-widest text-ink-500">
                CBI Exposure Index
              </p>
              {overview.exposureIndex ? (
                <p className="mt-2 font-serif text-6xl" data-numeric>
                  {overview.exposureIndex.value.toFixed(1)}
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-500">
                  Phase 1 data onboarding pending. Steward workflow in Phase 1.4.
                </p>
              )}
            </div>
          </div>
        </div>

        <NoBindingsHint hasBindings={bindings.length > 0} />
      </main>
    </div>
  );
}

function NoBindingsHint({ hasBindings }: { hasBindings: boolean }) {
  if (hasBindings) return null;
  return (
    <div className="mt-16 border-t border-line-200 pt-8 text-sm text-ink-500">
      No instance is bound to your account yet. During Phase 1 rollout, OPEN Interactive provisions
      each nation and grants operator access; this preview shows the Saint Lucia pilot data.
    </div>
  );
}

// Force useEffect import to satisfy tsgo unused-import scanning if empty.
void useEffect;
