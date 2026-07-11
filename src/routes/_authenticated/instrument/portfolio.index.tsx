import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { listMinistries } from "@/lib/scenarios.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function ministriesQuery(code: string) {
  return queryOptions({
    queryKey: ["ministries", code],
    queryFn: () => listMinistries({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/instrument/portfolio/")({
  head: () => ({
    meta: [
      { title: "Portfolios — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: PortfolioIndex,
});

function PortfolioIndex() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const defaultCode =
    bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const [code] = useState(defaultCode);
  const { data: ministries } = useSuspenseQuery(ministriesQuery(code));

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <SectionHeader eyebrow={`${code} · Portfolios`} title="Ministry workspaces" />

      {ministries.length === 0 ? (
        <p className="mt-12 max-w-xl text-sm text-ink-500">
          No portfolios configured for this instance yet. Data Stewards define ministry ↔ sector
          mapping during onboarding.
        </p>
      ) : (
        <ul className="mt-12 divide-y divide-line-200 border-t border-line-200">
          {ministries.map((m) => (
            <li key={m.id}>
              <Link
                to="/instrument/portfolio/$ministry"
                params={{ ministry: m.slug }}
                className="grid grid-cols-[1fr_auto] items-center gap-8 py-6 hover:bg-paper-100"
              >
                <div>
                  <p className="font-serif text-2xl text-ink-950">{m.name}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {m.sectors.map((s) => {
                      const meta = CANONICAL_SECTORS.find((c) => c.slug === s.sector_code);
                      return (
                        <span
                          key={s.sector_code}
                          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-500"
                        >
                          <span
                            className="inline-block h-2 w-1"
                            style={{ backgroundColor: `var(${meta?.cssVar ?? "--ink-500"})` }}
                          />
                          {meta?.label ?? s.sector_code}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                  Open →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
