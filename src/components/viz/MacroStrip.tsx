import type { MacroKpi } from "@/lib/country-viz/viz.functions";

function fmt(v: number | null, unit: string): string {
  if (v == null) return "—";
  if (unit === "USD" || unit === "usd") {
    if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  if (unit === "%" || unit === "pct" || unit === "percent") return `${v.toFixed(2)}%`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function statusColor(k: MacroKpi): string {
  // Only rough: compare to target if present.
  if (k.latest_value == null || k.target == null) return "text-ink-500";
  const better = k.direction === "lower_is_better" ? k.latest_value <= k.target : k.latest_value >= k.target;
  return better ? "text-signal-positive" : "text-signal-negative";
}

export function MacroStrip({ kpis }: { kpis: MacroKpi[] }) {
  if (!kpis.length) {
    return (
      <div className="border border-line-200 p-4 text-xs text-ink-500">
        No headline KPIs committed yet — run the KPI seed stage in onboarding.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-px bg-line-200 border border-line-200 md:grid-cols-3 lg:grid-cols-6">
      {kpis.map((k) => (
        <div key={k.kpi_code} className="bg-paper-0 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 truncate" title={k.label}>
            {k.label}
          </div>
          <div className={`mt-2 font-serif text-2xl tabular-nums ${statusColor(k)}`}>
            {fmt(k.latest_value, k.unit)}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-ink-500">
            <span className="tabular-nums">{k.latest_period ?? "—"}</span>
            {k.target != null && (
              <span className="tabular-nums">Target {fmt(k.target, k.unit)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
