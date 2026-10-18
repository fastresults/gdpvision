// Chamber 05 · Super Admin source profiles: reach, frequency, hit rate,
// influence, accuracy, strength tier and health, with quality checks.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Explain } from "@/components/explain/Explain";
import { listSources, recomputeSources, updateSource } from "@/lib/media-scan.functions";
import { SOURCE_TIER_LABEL } from "@/lib/narrative-source-strength";

type SortKey = "strength" | "per_day" | "hit_rate" | "influence_rate" | "accuracy";
const pct = (v: unknown) => (v == null ? "—" : `${Math.round(Number(v) * 100)}%`);
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

export function MediaSourcesPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listSources);
  const upd = useServerFn(updateSource);
  const recompute = useServerFn(recomputeSources);
  const q = useQuery({ queryKey: ["admin", "media-sources"], queryFn: () => list() });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin", "media-sources"] });
  const [country, setCountry] = useState("");
  const [tier, setTier] = useState("");
  const [sort, setSort] = useState<SortKey>("strength");
  const [msg, setMsg] = useState<string | null>(null);
  const save = useMutation({ mutationFn: (p: { id: string; reach_tier?: number | null; admin_weight?: number; active?: boolean }) => upd({ data: p }), onSuccess: refresh });
  const rerun = useMutation({
    mutationFn: () => recompute(),
    onSuccess: (r) => { setMsg(`Refreshed ${r.sources} source profiles.`); refresh(); },
    onError: (e) => setMsg((e as Error).message),
  });

  const rows = q.data ?? [];
  const countries = useMemo(() => [...new Set(rows.map((r) => r.country_code as string))].sort(), [rows]);
  const shown = useMemo(
    () =>
      rows
        .filter((r) => (!country || r.country_code === country) && (!tier || String(r.stats?.tier ?? "") === tier))
        .sort((a, b) => Number(b.stats?.[sort] ?? -1) - Number(a.stats?.[sort] ?? -1)),
    [rows, country, tier, sort],
  );

  const checks = useMemo(() => {
    const noisy = rows.filter((r) => r.active && (r.stats?.per_day ?? 0) >= 5 && (r.stats?.relevance_rate ?? 1) < 0.05);
    const silent = rows.filter((r) => r.active && (r.stats?.tier ?? 9) <= 2 && r.stats?.last_item_at && Date.now() - new Date(r.stats.last_item_at).getTime() > 3 * 86_400_000);
    const broken = rows.filter((r) => (r.stats?.accuracy ?? 1) < 0.7 && (r.stats?.items_30d ?? 0) >= 10);
    const strongBy = new Map<string, number>();
    for (const r of rows) if (r.active && (r.stats?.tier ?? 9) <= 2) strongBy.set(r.country_code, (strongBy.get(r.country_code) ?? 0) + 1);
    const noStrong = countries.filter((c) => c !== "CAR" && !strongBy.get(c));
    return { noisy, silent, broken, noStrong };
  }, [rows, countries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <select aria-label="Country" className="border border-line-200 bg-paper-0 px-2 py-1 text-sm" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">All countries</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Tier" className="border border-line-200 bg-paper-0 px-2 py-1 text-sm" value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="">All tiers</option>
          {[1, 2, 3, 4, 5].map((t) => <option key={t} value={t}>{SOURCE_TIER_LABEL[t]}</option>)}
        </select>
        <select aria-label="Sort" className="border border-line-200 bg-paper-0 px-2 py-1 text-sm" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="strength">Sort by strength</option>
          <option value="per_day">Sort by frequency</option>
          <option value="hit_rate">Sort by hit rate</option>
          <option value="influence_rate">Sort by influence</option>
          <option value="accuracy">Sort by accuracy</option>
        </select>
        <button className="btn-secondary" disabled={rerun.isPending} onClick={() => rerun.mutate()}>
          {rerun.isPending ? "Refreshing…" : "Refresh source profiles"}
        </button>
        {msg && <span className="text-sm text-ink-700">{msg}</span>}
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["Noisy sources", checks.noisy.length, "5+ articles a day, under 5% relevant. Consider pausing."],
          ["Strong sources gone quiet", checks.silent.length, "S1–S2 sources with nothing in 3 days."],
          ["Unreliable links", checks.broken.length, "Under 70% accuracy over 10+ articles."],
          ["Countries without S1–S2", checks.noStrong.length, checks.noStrong.join(", ") || "None"],
        ].map(([t, n, d]) => (
          <div key={t as string} className="border border-line-200 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{t}</p>
            <p className="mt-1 text-2xl tabular-nums text-ink-950">{n}</p>
            <p className="mt-1 text-xs text-ink-600">{d}</p>
          </div>
        ))}
      </section>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-500">
            <tr>
              <th className="py-2">Source</th><th>Country</th>
              <th><Explain id="narrative.source-strength">Strength</Explain></th>
              <th>Reach</th><th>Per day</th><th>Relevant</th><th>Hit rate</th><th>Influence</th><th>First</th><th>Accuracy</th><th>Health</th><th>Weight</th><th />
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 300).map((r) => (
              <tr key={r.id} className="border-t border-line-100 tabular-nums">
                <td className="max-w-[16rem] truncate py-2 text-ink-900" title={r.endpoint}>{r.label ?? host(r.endpoint)}</td>
                <td>{r.country_code}</td>
                <td>{r.stats ? `${Math.round(Number(r.stats.strength))} · S${r.stats.tier}` : "—"}</td>
                <td>
                  <select aria-label="Reach" className="border border-line-200 bg-paper-0 px-1" value={r.reach_tier ?? ""} onChange={(e) => save.mutate({ id: r.id, reach_tier: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Auto{r.stats ? ` (${r.stats.reach_tier})` : ""}</option>
                    {[1, 2, 3, 4, 5].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td>{r.stats?.per_day ?? "—"}</td>
                <td>{pct(r.stats?.relevance_rate)}</td>
                <td>{pct(r.stats?.hit_rate)}</td>
                <td>{pct(r.stats?.influence_rate)}</td>
                <td>{pct(r.stats?.first_rate)}</td>
                <td>{pct(r.stats?.accuracy)}</td>
                <td>{r.stats?.health ?? (r.active ? "working" : "off")}</td>
                <td>
                  <select aria-label="Weight" className="border border-line-200 bg-paper-0 px-1" value={String(r.admin_weight)} onChange={(e) => save.mutate({ id: r.id, admin_weight: Number(e.target.value) })}>
                    <option value="0.5">Demote</option>
                    <option value="1">Normal</option>
                    <option value="1.25">Boost</option>
                    <option value="1.5">Strong boost</option>
                  </select>
                </td>
                <td className="text-right">
                  <button className="btn-ghost" onClick={() => save.mutate({ id: r.id, active: !r.active })}>{r.active ? "Pause" : "Resume"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-500">{shown.length.toLocaleString()} sources{shown.length > 300 ? " · first 300 shown" : ""}. Changes apply at the next profile refresh (daily at 04:15 UTC, or press Refresh).</p>
      </div>
    </div>
  );
}
