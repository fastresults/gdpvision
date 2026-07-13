import type { VizOverview } from "@/lib/country-viz/viz.functions";
import { sectorColor } from "./sector-color";

export function MinistrySectorHeatmap({
  ministries,
  sectors,
  matrix,
  selected,
  onSelectSector,
}: {
  ministries: VizOverview["ministries"];
  sectors: VizOverview["sectors"];
  matrix: VizOverview["ministrySectorMatrix"];
  selected: string | null;
  onSelectSector: (code: string | null) => void;
}) {
  if (!ministries.length || !sectors.length) {
    return (
      <div className="rounded border border-line-200 p-8 text-center text-sm text-ink-500">
        Ministries or sectors not committed — run stages 3, 4, 5.
      </div>
    );
  }

  const byKey = new Map<string, number>();
  for (const m of matrix) byKey.set(`${m.ministry_slug}|${m.sector_code}`, m.weight);
  const maxWeight = Math.max(1, ...matrix.map((m) => m.weight));

  return (
    <div className="rounded border border-line-200 bg-paper-0 p-4">
      <div className="mb-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Chart · Portfolio Map</div>
        <h3 className="font-serif text-lg">Ministry × Sector weight</h3>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-paper-0 px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Ministry</th>
              {sectors.map((s, i) => (
                <th
                  key={s.code}
                  className={`px-1 py-2 text-center align-bottom cursor-pointer ${selected === s.code ? "text-ink-950" : "text-ink-500"}`}
                  onClick={() => onSelectSector(selected === s.code ? null : s.code)}
                  title={s.label}
                >
                  <div
                    className="mx-auto mb-1 h-2 w-2 rounded-full"
                    style={{ background: sectorColor(s.hue_token, i) }}
                  />
                  <div className="font-mono text-[9px] uppercase tracking-wide">{s.code}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ministries.map((m) => (
              <tr key={m.slug} className="border-t border-line-200">
                <td className="sticky left-0 z-10 bg-paper-0 px-2 py-1.5">
                  <div className="max-w-[220px] truncate font-medium text-ink-950" title={m.name}>{m.name}</div>
                  {m.minister && <div className="truncate text-[10px] text-ink-500">{m.minister}</div>}
                </td>
                {sectors.map((s, i) => {
                  const w = byKey.get(`${m.slug}|${s.code}`) ?? 0;
                  if (!w) return <td key={s.code} className="px-1 py-1.5" />;
                  const alpha = 0.15 + 0.75 * (w / maxWeight);
                  return (
                    <td
                      key={s.code}
                      className="px-1 py-1.5 text-center"
                      onClick={() => onSelectSector(selected === s.code ? null : s.code)}
                    >
                      <div
                        className="mx-auto flex h-6 w-6 items-center justify-center rounded text-[10px] font-medium tabular-nums text-paper-0"
                        style={{ background: sectorColor(s.hue_token, i), opacity: alpha }}
                        title={`${m.name} → ${s.label}: weight ${w.toFixed(2)}`}
                      >
                        {w >= 0.5 ? w.toFixed(1) : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
