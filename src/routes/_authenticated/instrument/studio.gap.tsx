import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { getGap } from "@/lib/mandate.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function gapQuery(code: string) {
  return queryOptions({
    queryKey: ["studio-gap", code],
    queryFn: () => getGap({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/instrument/studio/gap")({
  head: () => ({ meta: [{ title: "The Gap — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: GapPage,
});

function GapPage() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: gap } = useSuspenseQuery(gapQuery(code));

  const barMax = Math.max(gap.currentCbiSharePct, gap.targetCbiSharePct, 30);
  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <div className="flex items-baseline justify-between">
        <SectionHeader eyebrow={`${code} · Studio`} title="The Gap" />
        <Link to="/instrument/studio/packages" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
          Packages →
        </Link>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_auto]">
        <div className="rounded-sm border border-line-200 p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">CBI dependency vs anchor</p>
          <div className="mt-8 space-y-6">
            <GapBar label="Current" value={gap.currentCbiSharePct} max={barMax} tone="ink-950" />
            <GapBar label="Anchor target" value={gap.targetCbiSharePct} max={barMax} tone="ink-500" />
          </div>
          <p className="mt-8 font-serif text-4xl text-ink-950" data-numeric>
            {gap.gapPct.toFixed(1)}<span className="ml-2 font-mono text-sm text-ink-500">pp gap</span>
          </p>
        </div>

        <div className="rounded-sm border border-line-200 p-8 lg:w-72">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Active packages</p>
          <p className="mt-3 font-serif text-4xl text-ink-950" data-numeric>{gap.packages.length}</p>
          <ul className="mt-6 space-y-2 text-sm">
            {gap.packages.slice(0, 6).map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span className="truncate">{p.name}</span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">{p.status}</span>
              </li>
            ))}
            {gap.packages.length === 0 && (
              <li className="text-ink-500">No packages drafted yet.</li>
            )}
          </ul>
        </div>
      </div>
    </main>
  );
}

function GapBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex justify-between font-mono text-[11px] uppercase tracking-widest text-ink-500">
        <span>{label}</span>
        <span data-numeric>{value.toFixed(1)}%</span>
      </div>
      <div className="mt-2 h-3 w-full rounded-sm bg-paper-100">
        <div className={`h-full bg-${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
