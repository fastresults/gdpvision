import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listScenarios } from "@/lib/scenarios.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { useChamberCountry } from "@/hooks/useChamberCountry";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function scenariosQuery(code: string) {
  return queryOptions({
    queryKey: ["scenarios", code],
    queryFn: () => listScenarios({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/instrument/scenarios/")({
  head: () => ({
    meta: [
      { title: "Scenarios — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: ScenariosIndex,
});

function ScenariosIndex() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = useChamberCountry(bindings);
  const { data } = useSuspenseQuery(scenariosQuery(code));

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <div className="flex items-baseline justify-between">
        <SectionHeader eyebrow={`${code} · Scenarios`} title="Scenario workspace" />
        <Link
          to="/instrument/scenarios/new"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:underline underline-offset-4"
        >
          New scenario →
        </Link>
      </div>

      {data.length === 0 ? (
        <p className="mt-12 max-w-xl text-sm text-ink-500">
          No scenarios yet. Open the builder to draft the first ripple projection for {code}.
        </p>
      ) : (
        <table className="mt-12 w-full text-sm" data-numeric>
          <thead>
            <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
              <th className="py-2 font-normal">Title</th>
              <th className="py-2 font-normal">Status</th>
              <th className="py-2 font-normal">Horizon</th>
              <th className="py-2 font-normal">Model</th>
              <th className="py-2 font-normal">Updated</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className="border-b border-line-200/60">
                <td className="py-3">
                  <Link
                    to="/instrument/scenarios/$id"
                    params={{ id: s.id }}
                    className="hover:underline underline-offset-4"
                  >
                    {s.title}
                  </Link>
                </td>
                <td className="py-3 font-mono text-ink-500">{s.status}</td>
                <td className="py-3 font-mono">{s.horizon_years}y</td>
                <td className="py-3 font-mono text-ink-500">{s.model_version}</td>
                <td className="py-3 font-mono text-ink-500">
                  {new Date(s.updated_at).toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data.length >= 2 ? (
        <div className="mt-8 text-right">
          <Link
            to="/instrument/scenarios/compare"
            search={{ ids: data.slice(0, 2).map((s) => s.id).join(",") }}
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
          >
            Compare latest two →
          </Link>
        </div>
      ) : null}
    </main>
  );
}
