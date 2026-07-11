import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getStewardshipQueue, listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function queueQuery(code: string) {
  return queryOptions({
    queryKey: ["stewardship-queue", code],
    queryFn: () => getStewardshipQueue({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/instrument/stewardship")({
  head: () => ({
    meta: [
      { title: "Data Stewardship — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: StewardshipPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-8 py-24 text-ink-500">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em]">Queue unavailable</p>
      <p className="mt-4 text-sm">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-8 py-24 text-ink-500">Not found.</div>
  ),
});

const GRADES = ["A", "B", "C", "D"] as const;

function StewardshipPage() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const defaultCode =
    bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const [code] = useState(defaultCode);
  const { data } = useSuspenseQuery(queueQuery(code));

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <SectionHeader
        eyebrow={`${code} · Data Stewardship`}
        title="Ingestion & Revisions"
        lede="Every numeric-bearing row in the Ledger carries source, vintage and confidence grade. This queue is the point of custody."
      />

      {!data.isSteward ? (
        <div className="mt-12 border-l-2 border-gold-500 pl-6 text-sm text-ink-500">
          You are signed in without a Data Steward role on this instance. Stewardship actions
          (ingest, revise, sign-off) require the <code className="font-mono">data_steward</code> or{" "}
          <code className="font-mono">admin</code> role. Read-only summary shown below.
        </div>
      ) : null}

      <section className="mt-16">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          Confidence distribution — {data.seriesCounts.total} series
        </h3>
        <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
          {GRADES.map((g) => (
            <div key={g} className="border-t border-line-200 pt-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                Grade {g}
              </p>
              <p className="mt-2 font-serif text-4xl text-ink-950" data-numeric>
                {data.seriesCounts.graded[g] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            Recent revisions
          </h3>
          {data.isSteward ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              CSV ingest — Phase 1.5
            </p>
          ) : null}
        </div>

        {data.revisions.length === 0 ? (
          <p className="mt-6 max-w-xl text-sm text-ink-500">
            No revisions recorded on this instance. All ledger writes append here with actor,
            reason, and prior value — the immutable audit trail begins on first ingest.
          </p>
        ) : (
          <table className="mt-6 w-full text-sm" data-numeric>
            <thead>
              <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
                <th className="py-2 font-normal">When</th>
                <th className="py-2 font-normal">Series</th>
                <th className="py-2 font-normal">Period</th>
                <th className="py-2 text-right font-normal">Previous</th>
                <th className="py-2 text-right font-normal">New</th>
                <th className="py-2 pl-6 font-normal">Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.revisions.map((r) => (
                <tr key={r.id} className="border-b border-line-200/60 align-top">
                  <td className="py-3 font-mono text-ink-500">
                    {new Date(r.created_at).toISOString().slice(0, 10)}
                  </td>
                  <td className="py-3">
                    {r.series ? (
                      <Link
                        to="/instrument/sector/$code"
                        params={{ code: r.series.sector_code }}
                        className="hover:underline underline-offset-4"
                      >
                        {r.series.metric}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 font-mono">{r.period ?? "—"}</td>
                  <td className="py-3 text-right font-mono text-ink-500">
                    {r.previous_value !== null
                      ? r.previous_value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : "—"}
                  </td>
                  <td className="py-3 text-right font-mono">
                    {r.new_value !== null
                      ? r.new_value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : "—"}
                  </td>
                  <td className="py-3 pl-6 text-ink-500">{r.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
