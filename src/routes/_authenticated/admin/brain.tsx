import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { BrainConstellation, type BrainFilter } from "@/components/country-data/BrainConstellation";
import { listAllMemory } from "@/lib/country-data/manage.functions";
import { CARICOM_OECS_REGISTRY } from "@/lib/caricom-registry";

const COUNTRY_NAMES: Record<string, string> = CARICOM_OECS_REGISTRY.reduce(
  (acc, n) => {
    acc[n.code] = n.name;
    return acc;
  },
  {} as Record<string, string>,
);

const allMemoryQuery = queryOptions({
  queryKey: ["admin", "all-memory"],
  queryFn: () => listAllMemory(),
});

export const Route = createFileRoute("/_authenticated/admin/brain")({
  head: () => ({
    meta: [
      { title: "Second brain — System — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(allMemoryQuery),
  component: BrainSystemPage,
});

function BrainSystemPage() {
  const { data: rows } = useSuspenseQuery(allMemoryQuery);
  const [filter, setFilter] = useState<BrainFilter>({});

  const total = rows.length;
  const verified = rows.filter((r) => r.verified).length;
  const now = Date.now();
  const last24h = rows.filter((r) => now - new Date(r.updated_at).getTime() < 86400_000).length;
  const countryCount = new Set(rows.map((r) => r.scope_key)).size;
  const sectorCount = new Set(rows.map((r) => r.sector_code || "—")).size;

  const filtered = filter.country ? rows.filter((r) => r.scope_key === filter.country) : rows;
  const focusedName = filter.country ? COUNTRY_NAMES[filter.country] ?? filter.country : null;

  return (
    <SuperAdminShell
      crumbs={[
        { label: "Admin", to: "/admin/countries" },
        { label: focusedName ? `Second brain · ${focusedName}` : "Second brain · System" },
      ]}
    >
      <div className="space-y-4">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-medium">Second brain — living constellation</h1>
            <p className="mt-1 text-sm text-ink-500">
              Every memory object across every country as a single organism. Click a country orb to zoom in;
              click a sector, kind, or memory to filter the list.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Countries" value={countryCount} />
          <Stat label="Sectors" value={sectorCount} />
          <Stat label="Memories" value={total} />
          <Stat label="Verified" value={`${total ? Math.round((verified / total) * 100) : 0}%`} />
          <Stat label="Active 24h" value={last24h} accent="amber" />
        </div>

        <BrainConstellation
          rows={filtered as any}
          mode="system"
          centerLabel={focusedName ?? "SYSTEM"}
          filter={filter}
          onFilter={setFilter}
          onSelectCountry={(code) => setFilter({ country: code })}
        />
      </div>
    </SuperAdminShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: "amber" }) {
  return (
    <div className="border border-line-200 p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{label}</div>
      <div className={`mt-1 text-xl font-medium tabular-nums ${accent === "amber" ? "text-amber-600" : "text-ink-950"}`}>
        {value}
      </div>
    </div>
  );
}
