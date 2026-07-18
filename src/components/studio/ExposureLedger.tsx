import type { Allocation } from "@/lib/fdi-resilience.functions";
import { sectorColor } from "@/components/viz/sector-color";
import { cn } from "@/lib/utils";
import { ReadMore } from "./ReadMore";

type Sector = { code: string; label: string; hue_token?: string | null };

export function ExposureLedger({
  allocation,
  sectors,
  targets,
}: {
  allocation: Allocation;
  sectors: Sector[];
  targets: string[];
}) {
  const byCode = new Map(sectors.map((s, i) => [s.code, { s, i }]));
  const rows = [...allocation.entries].sort((a, b) => b.exposure_delta_pp - a.exposure_delta_pp);
  return (
    <div className="border border-line-200">
      <div className="flex items-baseline justify-between border-b border-line-200 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Exposure ledger
        </p>
        <p className="font-mono text-[10px] text-ink-500">what breaks</p>
      </div>
      <ul className="divide-y divide-line-200">
        {rows.map((r) => {
          const s = byCode.get(r.sector_code);
          const color = sectorColor(s?.s.hue_token, s?.i ?? 0);
          const isTarget = targets.includes(r.sector_code);
          const delta = r.resilient_pct - r.current_pct;
          return (
            <li key={r.sector_code} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 flex-none" style={{ background: color }} />
                <ReadMore
                  title={s?.s.label ?? r.sector_code}
                  text={s?.s.label ?? r.sector_code}
                  clamp={1}
                  className={cn("min-w-0 flex-1 text-sm", isTarget ? "text-ink-950" : "text-ink-700")}
                  markdown={false}
                />
                {isTarget && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-rose-600">
                    target
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px] text-ink-500">
                <span>
                  now <span className="text-ink-950 tabular-nums">{r.current_pct.toFixed(1)}%</span>
                </span>
                <span>
                  new <span className="text-ink-950 tabular-nums">{r.resilient_pct.toFixed(1)}%</span>
                </span>
                <span>
                  Δ{" "}
                  <span
                    className={cn(
                      "tabular-nums",
                      delta > 0.05 ? "text-emerald-700" : delta < -0.05 ? "text-rose-600" : "text-ink-500",
                    )}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)} pp
                  </span>
                </span>
              </div>
              {r.exposure_delta_pp > 0 && (
                <div className="mt-2 h-1.5 w-full bg-line-200">
                  <div
                    className="h-full bg-rose-500"
                    style={{
                      width: `${Math.min(100, (r.exposure_delta_pp / Math.max(1, r.current_pct)) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
