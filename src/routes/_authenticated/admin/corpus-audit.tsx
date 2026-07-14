import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getCorpusAuditSummary } from "@/lib/corpus/audit.functions";
import { PrettyJson } from "@/components/data/PrettyJson";

const summaryQuery = (hours: number, countryCode?: string) =>
  queryOptions({
    queryKey: ["corpus-audit", hours, countryCode ?? "all"],
    queryFn: () =>
      getCorpusAuditSummary({ data: { hours, ...(countryCode ? { countryCode } : {}) } }),
  });

export const Route = createFileRoute("/_authenticated/admin/corpus-audit")({
  head: () => ({
    meta: [
      { title: "Corpus Audit — GDPVision" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Every corpus read, every external fallback, every silent miss — audited so the second brain never runs blind.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(summaryQuery(24));
  },
  component: CorpusAuditPage,
});

function CorpusAuditPage() {
  const [hours, setHours] = useState(24);
  const [country, setCountry] = useState("");
  const { data } = useSuspenseQuery(summaryQuery(hours, country.trim() || undefined));

  const missPct =
    (data.totals.empty ?? 0) +
    (data.totals.throttled ?? 0) +
    (data.totals.error ?? 0);
  const total = Object.values(data.totals).reduce((s, n) => s + n, 0);
  const missRate = total === 0 ? 0 : Math.round((missPct / total) * 1000) / 10;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Second brain</p>
        <h1 className="text-3xl font-semibold">Corpus fetch audit</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Every read routed through <code>corpusRead()</code>. Hits come from the corpus; external
          fallbacks were fetched from Perplexity / World Bank / IMF / Gemini and written back;
          empties and throttles indicate misses the second brain still needs to fill.
        </p>
        <p className="text-xs text-muted-foreground">
          <Link to="/admin" className="underline">← Admin home</Link>
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-4 border-b pb-6">
        <label className="flex flex-col text-xs uppercase tracking-widest text-muted-foreground">
          Window
          <select
            className="mt-1 rounded border bg-background px-3 py-2 text-sm"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            <option value={1}>Last hour</option>
            <option value={24}>Last 24h</option>
            <option value={168}>Last 7d</option>
            <option value={720}>Last 30d</option>
          </select>
        </label>
        <label className="flex flex-col text-xs uppercase tracking-widest text-muted-foreground">
          Country (ISO3, optional)
          <input
            className="mt-1 rounded border bg-background px-3 py-2 text-sm uppercase"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="LCA"
            maxLength={4}
          />
        </label>
        <div className="ml-auto rounded bg-muted px-4 py-3 text-sm">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Miss rate (empty + throttled + error / total)
          </div>
          <div className="text-2xl font-mono tabular-nums">{missRate}%</div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Outcome totals</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(["hit", "external", "empty", "throttled", "error"] as const).map((o) => (
            <div key={o} className="rounded border p-3">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{o}</div>
              <div className="text-2xl font-mono tabular-nums">{data.totals[o] ?? 0}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">By domain</h2>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-widest">
              <tr>
                <th className="p-2 text-left">Domain</th>
                <th className="p-2 text-right">Hit</th>
                <th className="p-2 text-right">External</th>
                <th className="p-2 text-right">Empty</th>
                <th className="p-2 text-right">Throttled</th>
                <th className="p-2 text-right">Error</th>
                <th className="p-2 text-right">Miss %</th>
              </tr>
            </thead>
            <tbody>
              {data.by_domain.map((r) => (
                <tr key={r.domain} className="border-t">
                  <td className="p-2 font-medium">{r.domain}</td>
                  <td className="p-2 text-right font-mono tabular-nums">{r.hit}</td>
                  <td className="p-2 text-right font-mono tabular-nums">{r.external}</td>
                  <td className="p-2 text-right font-mono tabular-nums">{r.empty}</td>
                  <td className="p-2 text-right font-mono tabular-nums">{r.throttled}</td>
                  <td className="p-2 text-right font-mono tabular-nums">{r.error}</td>
                  <td className="p-2 text-right font-mono tabular-nums">{r.miss_rate}%</td>
                </tr>
              ))}
              {data.by_domain.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    No corpus reads recorded in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Top 20 empty keys (candidates for backfill)</h2>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-widest">
              <tr>
                <th className="p-2 text-left">Country</th>
                <th className="p-2 text-left">Domain</th>
                <th className="p-2 text-left">Key</th>
                <th className="p-2 text-right">Empty count</th>
                <th className="p-2 text-left">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.top_empty_keys.map((k) => (
                <tr key={`${k.country_code}:${k.domain}:${k.key}`} className="border-t">
                  <td className="p-2">{k.country_code}</td>
                  <td className="p-2">{k.domain}</td>
                  <td className="p-2 font-mono text-xs">{k.key}</td>
                  <td className="p-2 text-right font-mono tabular-nums">{k.empty_count}</td>
                  <td className="p-2 text-xs text-muted-foreground">{k.last_seen}</td>
                </tr>
              ))}
              {data.top_empty_keys.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    No empty fetches — nothing to backfill.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">External tier breakdown</h2>
        <div className="flex flex-wrap gap-2">
          {data.tier_breakdown.map((t) => (
            <span key={t.tier} className="rounded-full border px-3 py-1 text-xs">
              <span className="font-mono">{t.tier}</span>
              <span className="ml-2 text-muted-foreground">×{t.count}</span>
            </span>
          ))}
          {data.tier_breakdown.length === 0 && (
            <span className="text-sm text-muted-foreground">No external fetches recorded.</span>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent attempts (50)</h2>
        <PrettyJson value={data.recent} />
      </section>
    </div>
  );
}
