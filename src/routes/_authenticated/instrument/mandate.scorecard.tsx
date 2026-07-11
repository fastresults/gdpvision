import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listKpis } from "@/lib/mandate.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function kpisQuery(code: string) {
  return queryOptions({
    queryKey: ["kpis", code],
    queryFn: () => listKpis({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/instrument/mandate/scorecard")({
  head: () => ({ meta: [{ title: "National Scorecard — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: Scorecard,
});

function Scorecard() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: kpis } = useSuspenseQuery(kpisQuery(code));

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <div className="flex items-baseline justify-between">
        <SectionHeader eyebrow={`${code} · Mandate`} title="National Scorecard" />
        <Link to="/instrument/mandate/studio" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
          KPI studio →
        </Link>
      </div>

      {kpis.length === 0 ? (
        <p className="mt-16 max-w-xl text-sm text-ink-500">
          No KPIs ratified yet. Define the first metrics in the Mandate Studio to seed this scorecard.
        </p>
      ) : (
        <table className="mt-12 w-full text-sm" data-numeric>
          <thead>
            <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
              <th className="py-2 font-normal">Metric</th>
              <th className="py-2 font-normal">Sector</th>
              <th className="py-2 font-normal">Baseline</th>
              <th className="py-2 font-normal">Target</th>
              <th className="py-2 font-normal">Latest</th>
              <th className="py-2 font-normal">Status</th>
              <th className="py-2 font-normal">Cadence</th>
            </tr>
          </thead>
          <tbody>
            {kpis.map((k) => (
              <tr key={k.id} className="border-b border-line-200/60">
                <td className="py-3 font-sans">{k.metric}</td>
                <td className="py-3 font-mono text-ink-500">{k.sector_code}</td>
                <td className="py-3 font-mono">{k.baseline ?? "—"} {k.unit}</td>
                <td className="py-3 font-mono">{k.target} {k.unit}</td>
                <td className="py-3 font-mono">{k.latest?.value ?? "—"}</td>
                <td className="py-3">
                  <StatusPill status={k.latest?.status ?? "pending"} />
                </td>
                <td className="py-3 font-mono text-ink-500">{k.cadence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
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
