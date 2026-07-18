import type { ResilienceAction } from "@/lib/fdi-resilience.functions";
import { sectorColor } from "@/components/viz/sector-color";
import { GripVertical } from "lucide-react";
import { ExplainHover } from "./ExplainHover";
import { EXPLAIN } from "./explain-copy";

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
  const unstaged = actions.filter((a) => !a.staging_year || a.staging_year < 1);
  const hasAnyAction = actions.length > 0;

  return (
    <div className="border border-line-200 bg-paper-0 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <ExplainHover copy={EXPLAIN.staging} side="bottom">
          <p className="cursor-help font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 underline decoration-dotted decoration-line-200 underline-offset-4">
            <span className="mr-1 text-ink-950">3</span>· Stage the actions ·
            years 1–{horizon}
          </p>
        </ExplainHover>
        <p className="text-[10px] text-ink-500">
          {hasAnyAction
            ? "Drag a tile into the year it lands."
            : "Add actions in Resilience Actions →, then drag them into a year."}
        </p>
      </div>

      {/* Unstaged tray — visible drag source lives in the same widget as the drop target */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const id = e.dataTransfer.getData("text/action-id");
          if (id) onMove(id, 0);
        }}
        className="mt-3 border border-dashed border-line-200 bg-paper-100/40 p-2"
      >
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Unstaged · drag into a year below
          </p>
          <span className="font-mono text-[10px] tabular-nums text-ink-500">
            {unstaged.length}
          </span>
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {unstaged.map((a) => {
            const meta = bySector.get(a.sector_code);
            const color = sectorColor(meta?.s.hue_token, meta?.i ?? 0);
            return (
              <li
                key={a.id}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("text/action-id", a.id)
                }
                className="group inline-flex max-w-[220px] cursor-grab items-center gap-1.5 border border-line-200 bg-paper-0 px-2 py-1 text-xs active:cursor-grabbing"
                title={a.label}
              >
                <GripVertical
                  size={11}
                  className="shrink-0 text-ink-500 group-hover:text-ink-950"
                />
                <span
                  className="inline-block h-2 w-2 shrink-0"
                  style={{ background: color }}
                />
                <span className="min-w-0 flex-1 truncate text-ink-950">
                  {a.label}
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-500">
                  {a.target_pp.toFixed(1)}pp
                </span>
              </li>
            );
          })}
          {unstaged.length === 0 && (
            <li className="py-1 font-mono text-[10px] text-ink-500/70">
              {hasAnyAction
                ? "All actions are staged. Drop one back here to unstage."
                : "No actions yet."}
            </li>
          )}
        </ul>
      </div>

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
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/action-id", a.id)
                        }
                        className="cursor-grab border border-line-200 bg-paper-100/60 p-2 text-xs active:cursor-grabbing"
                        title={a.label}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical
                            size={11}
                            className="mt-0.5 shrink-0 text-ink-500"
                          />
                          <span
                            className="mt-1 inline-block h-2 w-2 flex-none"
                            style={{ background: color }}
                          />
                          <span className="min-w-0 flex-1 break-words text-ink-950 line-clamp-2">
                            {a.label}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-ink-500">
                          <span className="uppercase tracking-[0.15em]">
                            {a.action_type.replace(/_/g, " ")}
                          </span>
                          <span className="tabular-nums">
                            {a.target_pp.toFixed(1)} pp
                          </span>
                        </div>
                      </li>
                    );
                  })}
                  {inYear.length === 0 && (
                    <li className="mt-2 border border-dashed border-line-200/70 py-3 text-center font-mono text-[10px] text-ink-500/60">
                      {hasAnyAction
                        ? `drop into Year ${y}`
                        : "add an action first"}
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
