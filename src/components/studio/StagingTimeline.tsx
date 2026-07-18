import type { ResilienceAction } from "@/lib/fdi-resilience.functions";
import { sectorColor } from "@/components/viz/sector-color";
import { cn } from "@/lib/utils";

type Sector = { code: string; label: string; hue_token?: string | null };

export function StagingTimeline({
  actions,
  horizon,
  sectors,
  onMove,
}: {
  actions: ResilienceAction[];
  horizon: number;
  sectors: Sector[];
  onMove: (id: string, year: number) => void;
}) {
  const bySector = new Map(sectors.map((s, i) => [s.code, { s, i }]));
  const years = Array.from({ length: horizon }, (_, i) => i + 1);
  return (
    <div className="border border-line-200 bg-paper-0 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        Staging timeline · years 1–{horizon}
      </p>
      <div className="mt-3 overflow-x-auto">
        <div
          className="grid gap-px bg-line-200 min-w-[600px]"
          style={{ gridTemplateColumns: `repeat(${horizon}, minmax(0,1fr))` }}
        >
          {years.map((y) => {
            const inYear = actions.filter((a) => a.staging_year === y);
            return (
              <div
                key={y}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/action-id");
                  if (id) onMove(id, y);
                }}
                className="min-h-[120px] bg-paper-0 p-2"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  Year {y}
                </p>
                <ul className="mt-2 space-y-1">
                  {inYear.map((a) => {
                    const meta = bySector.get(a.sector_code);
                    const color = sectorColor(meta?.s.hue_token, meta?.i ?? 0);
                    return (
                      <li
                        key={a.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/action-id", a.id)}
                        className="cursor-move border border-line-200 bg-paper-100/60 p-2 text-xs"
                        title={a.label}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 flex-none"
                            style={{ background: color }}
                          />
                          <span className="truncate text-ink-950">{a.label}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-ink-500">
                          <span className="uppercase tracking-[0.15em]">
                            {a.action_type.replace(/_/g, " ")}
                          </span>
                          <span className="tabular-nums">{a.target_pp.toFixed(1)} pp</span>
                        </div>
                      </li>
                    );
                  })}
                  {inYear.length === 0 && (
                    <li className={cn("text-center font-mono text-[10px] text-ink-500/60")}>
                      drop actions here
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
