import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, RefreshCw, Radar } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  heatStrip24h,
  lastHarvestRun,
  runManualTick,
  coverageFor,
  discoverSources,
} from "@/lib/press-monitor.functions";

export function RadarHeatStrip({ code, countryName }: { code: string; countryName?: string }) {
  const qc = useQueryClient();
  const heat = useServerFn(heatStrip24h);
  const last = useServerFn(lastHarvestRun);
  const run = useServerFn(runManualTick);
  const cov = useServerFn(coverageFor);
  const discover = useServerFn(discoverSources);

  const cells = useQuery({
    queryKey: ["radar-heat", code],
    queryFn: () => heat({ data: { countryCode: code } }),
    refetchInterval: 60_000,
  });
  const lastRun = useQuery({ queryKey: ["radar-last-run"], queryFn: () => last(), refetchInterval: 60_000 });
  const coverage = useQuery({
    queryKey: ["radar-coverage", code],
    queryFn: () => cov({ data: { countryCode: code } }),
    refetchInterval: 60_000,
  });

  const m = useMutation({
    mutationFn: async () => run({ data: { countryCode: code } }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["radar-heat", code] }),
        qc.invalidateQueries({ queryKey: ["radar-last-run"] }),
        qc.invalidateQueries({ queryKey: ["radar-coverage", code] }),
        qc.invalidateQueries({ queryKey: ["narrative-signals", code] }),
      ]);
    },
  });

  const d = useMutation({
    mutationFn: async () =>
      discover({ data: { countryCode: code, countryName: countryName ?? code } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["narrative-feeds", code] });
    },
  });

  const rows = (cells.data ?? []) as { hour: string; local: number; regional: number; international: number }[];
  const max = rows.reduce((n, c) => Math.max(n, c.local, c.regional, c.international), 1);

  const totals = rows.reduce(
    (acc, c) => ({ local: acc.local + c.local, regional: acc.regional + c.regional, international: acc.international + c.international }),
    { local: 0, regional: 0, international: 0 },
  );

  return (
    <section className="border border-line-200 bg-paper-0 p-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Press radar · last 24h</p>
          <h3 className="mt-1 font-serif text-xl text-ink-950">
            {totals.local + totals.regional + totals.international} signals ·{" "}
            <span className="text-ink-500">L {totals.local}</span> ·{" "}
            <span className="text-ink-500">R {totals.regional}</span> ·{" "}
            <span className="text-ink-500">I {totals.international}</span>
          </h3>
          {lastRun.data && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              Last harvest {lastRun.data.finished_at ? new Date(lastRun.data.finished_at).toLocaleString() : "running…"} ·
              {" "}{lastRun.data.feeds_polled} feeds · {lastRun.data.items_promoted} promoted
              {Array.isArray(lastRun.data.errors) && (lastRun.data.errors as unknown[]).length > 0 && (
                <span className="ml-2 text-rose-600">· {(lastRun.data.errors as unknown[]).length} errors</span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-0 hover:bg-ink-800 disabled:opacity-50"
            title="Run press harvester now for this country"
          >
            {m.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
            {m.isPending ? "Harvesting…" : "Run now"}
          </button>
          {coverage.data && (coverage.data.local === 0 || coverage.data.total < 3) && (
            <button
              onClick={() => d.mutate()}
              disabled={d.isPending}
              className="inline-flex items-center gap-2 border border-amber-600 bg-paper-0 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-amber-800 hover:bg-amber-50 disabled:opacity-50"
              title="Ask AI to find more press sources for this country"
            >
              {d.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Radar size={12} />}
              {d.isPending ? "Discovering…" : "Discover sources"}
            </button>
          )}
        </div>
      </header>

      {coverage.data && (
        <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
          <span className="border border-line-200 px-2 py-1 text-ink-600">
            Coverage (last run) · L {coverage.data.local} · R {coverage.data.regional} · I {coverage.data.international}
          </span>
          {coverage.data.local === 0 && (
            <span className="border border-amber-400 bg-amber-50 px-2 py-1 text-amber-900">
              No local signals — discovery recommended
            </span>
          )}
          {d.data && (
            <span className="border border-emerald-400 bg-emerald-50 px-2 py-1 text-emerald-900">
              {d.data.inserted} new · {d.data.suggested} suggested
            </span>
          )}
        </div>
      )}

      <div className="mt-4 space-y-1.5">
        {(["local", "regional", "international"] as const).map((scope) => (
          <div key={scope} className="flex items-center gap-2">
            <span className="w-24 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{scope}</span>
            <div className="grid flex-1 grid-cols-24 gap-[2px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
              {rows.map((c, i) => {
                const v = c[scope];
                const intensity = v === 0 ? 0 : Math.min(1, v / max);
                return (
                  <div
                    key={i}
                    title={`${new Date(c.hour).toLocaleTimeString([], { hour: "2-digit" })} · ${scope}: ${v}`}
                    className={cn("h-4 border border-line-200")}
                    style={{
                      background: v === 0 ? "transparent" : `rgba(15,23,42,${0.15 + intensity * 0.75})`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-widest text-ink-500">
          <span>-24h</span><span>-12h</span><span>now</span>
        </div>
      </div>
      {m.error && <p className="mt-3 text-sm text-rose-600">{(m.error as Error).message}</p>}
    </section>
  );
}
