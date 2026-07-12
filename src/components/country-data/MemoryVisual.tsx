import { useMemo } from "react";

export type MemoryRow = {
  id: string;
  title: string;
  kind: string;
  sector_code: string;
  scope_key: string;
  weight: number;
  verified: boolean;
  updated_at: string;
  payload?: any;
};

export type MemoryFilter = { sector?: string; kind?: string; verified?: boolean };

const KINDS = ["audience", "position", "statement", "outlet", "precedent", "fact", "risk"] as const;

function shade(weightSum: number, max: number) {
  if (weightSum === 0 || max === 0) return "bg-paper-100";
  const t = Math.min(1, weightSum / max);
  // step through 5 shades using ink opacity
  if (t > 0.8) return "bg-ink-950 text-paper-0";
  if (t > 0.6) return "bg-ink-950/70 text-paper-0";
  if (t > 0.4) return "bg-ink-950/50 text-paper-0";
  if (t > 0.2) return "bg-ink-950/30";
  return "bg-ink-950/15";
}

export function MemoryVisual({
  rows,
  filter,
  onSelect,
}: {
  rows: MemoryRow[];
  filter: MemoryFilter;
  onSelect: (f: MemoryFilter) => void;
}) {
  const sectors = useMemo(() => {
    const s = new Set(rows.map((r) => r.sector_code || "—"));
    return Array.from(s).sort();
  }, [rows]);

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, { count: number; weight: number; verified: number }>> = {};
    for (const s of sectors) {
      m[s] = {};
      for (const k of KINDS) m[s][k] = { count: 0, weight: 0, verified: 0 };
    }
    for (const r of rows) {
      const s = r.sector_code || "—";
      const k = (KINDS as readonly string[]).includes(r.kind) ? r.kind : null;
      if (!k || !m[s]) continue;
      m[s][k].count += 1;
      m[s][k].weight += r.weight ?? 0;
      if (r.verified) m[s][k].verified += 1;
    }
    return m;
  }, [rows, sectors]);

  const maxWeight = useMemo(() => {
    let mx = 0;
    for (const s of sectors) for (const k of KINDS) mx = Math.max(mx, matrix[s]?.[k]?.weight ?? 0);
    return mx;
  }, [matrix, sectors]);

  const byKind = useMemo(() => {
    const m: Record<string, { verified: number; unverified: number; total: number }> = {};
    for (const k of KINDS) m[k] = { verified: 0, unverified: 0, total: 0 };
    for (const r of rows) {
      const k = (KINDS as readonly string[]).includes(r.kind) ? r.kind : null;
      if (!k) continue;
      m[k].total += 1;
      if (r.verified) m[k].verified += 1;
      else m[k].unverified += 1;
    }
    return m;
  }, [rows]);
  const maxKindTotal = Math.max(1, ...Object.values(byKind).map((v) => v.total));

  const recent = useMemo(
    () => [...rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 10),
    [rows],
  );

  const isSel = (s?: string, k?: string) =>
    (s === undefined || filter.sector === s) && (k === undefined || filter.kind === k);

  return (
    <div className="space-y-6">
      {/* Filter chips row */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-widest">
        <span className="text-ink-500">Filter:</span>
        <button
          onClick={() => onSelect({})}
          className={`px-2 py-1 border ${!filter.sector && !filter.kind && filter.verified === undefined ? "border-ink-950 text-ink-950" : "border-line-200 text-ink-500 hover:text-ink-950"}`}
        >
          All
        </button>
        {filter.sector && (
          <button onClick={() => onSelect({ ...filter, sector: undefined })} className="px-2 py-1 border border-ink-950">
            sector: {filter.sector} ✕
          </button>
        )}
        {filter.kind && (
          <button onClick={() => onSelect({ ...filter, kind: undefined })} className="px-2 py-1 border border-ink-950">
            kind: {filter.kind} ✕
          </button>
        )}
        {filter.verified !== undefined && (
          <button onClick={() => onSelect({ ...filter, verified: undefined })} className="px-2 py-1 border border-ink-950">
            {filter.verified ? "verified" : "unverified"} ✕
          </button>
        )}
      </div>

      {/* Coverage matrix */}
      <section className="border border-line-200">
        <header className="flex items-baseline justify-between border-b border-line-200 px-4 py-2">
          <h4 className="font-mono text-[11px] uppercase tracking-[0.2em]">Coverage matrix</h4>
          <span className="font-mono text-[10px] text-ink-500">
            sectors × kinds · shade = summed weight · dot = verified
          </span>
        </header>
        <div className="overflow-x-auto p-4">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="w-40 border-b border-line-200 p-2 text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  Sector
                </th>
                {KINDS.map((k) => (
                  <th
                    key={k}
                    onClick={() => onSelect({ ...filter, kind: filter.kind === k ? undefined : k })}
                    className={`cursor-pointer border-b border-line-200 p-2 text-center font-mono text-[10px] uppercase tracking-widest ${filter.kind === k ? "text-ink-950" : "text-ink-500 hover:text-ink-950"}`}
                  >
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectors.length === 0 && (
                <tr>
                  <td colSpan={KINDS.length + 1} className="p-8 text-center text-ink-500">
                    No memory objects to visualise yet.
                  </td>
                </tr>
              )}
              {sectors.map((s) => (
                <tr key={s}>
                  <td
                    onClick={() => onSelect({ ...filter, sector: filter.sector === s ? undefined : s })}
                    className={`cursor-pointer border-b border-line-200 p-2 font-mono text-[11px] ${filter.sector === s ? "text-ink-950" : "text-ink-500 hover:text-ink-950"}`}
                  >
                    {s}
                  </td>
                  {KINDS.map((k) => {
                    const cell = matrix[s]?.[k] ?? { count: 0, weight: 0, verified: 0 };
                    const selected = isSel(s, k) && (filter.sector === s || filter.kind === k);
                    return (
                      <td key={k} className="border-b border-line-200 p-1">
                        <button
                          onClick={() => onSelect({ sector: s, kind: k })}
                          className={`relative flex h-10 w-full items-center justify-center font-mono text-[11px] tabular-nums ${shade(cell.weight, maxWeight)} ${selected ? "ring-2 ring-ink-950" : ""}`}
                          title={`${s} · ${k}: ${cell.count} objects, weight ${cell.weight}, ${cell.verified} verified`}
                        >
                          {cell.count > 0 ? cell.count : ""}
                          {cell.verified > 0 && (
                            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Verification bars */}
        <section className="border border-line-200">
          <header className="border-b border-line-200 px-4 py-2">
            <h4 className="font-mono text-[11px] uppercase tracking-[0.2em]">Verified vs unverified by kind</h4>
          </header>
          <div className="space-y-3 p-4">
            {KINDS.map((k) => {
              const v = byKind[k];
              const vw = (v.verified / maxKindTotal) * 100;
              const uw = (v.unverified / maxKindTotal) * 100;
              return (
                <div key={k} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-3">
                  <button
                    onClick={() => onSelect({ ...filter, kind: filter.kind === k ? undefined : k })}
                    className={`text-left font-mono text-[10px] uppercase tracking-widest ${filter.kind === k ? "text-ink-950" : "text-ink-500 hover:text-ink-950"}`}
                  >
                    {k}
                  </button>
                  <div className="flex h-3 w-full overflow-hidden bg-paper-100">
                    <div
                      className="bg-emerald-500 hover:opacity-80 cursor-pointer"
                      style={{ width: `${vw}%` }}
                      title={`${v.verified} verified`}
                      onClick={() => onSelect({ kind: k, verified: true })}
                    />
                    <div
                      className="bg-ink-950/40 hover:opacity-80 cursor-pointer"
                      style={{ width: `${uw}%` }}
                      title={`${v.unverified} unverified`}
                      onClick={() => onSelect({ kind: k, verified: false })}
                    />
                  </div>
                  <span className="text-right font-mono text-[11px] tabular-nums text-ink-500">{v.total}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-4 pt-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 bg-emerald-500" /> verified</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 bg-ink-950/40" /> unverified</span>
            </div>
          </div>
        </section>

        {/* Sector coverage rail */}
        <section className="border border-line-200">
          <header className="border-b border-line-200 px-4 py-2">
            <h4 className="font-mono text-[11px] uppercase tracking-[0.2em]">Sector coverage rail</h4>
          </header>
          <div className="space-y-2 p-4">
            {sectors.length === 0 && <p className="text-sm text-ink-500">No sectors yet.</p>}
            {sectors.map((s) => (
              <div key={s} className="grid grid-cols-[8rem_1fr] items-center gap-3">
                <button
                  onClick={() => onSelect({ ...filter, sector: filter.sector === s ? undefined : s })}
                  className={`truncate text-left font-mono text-[11px] ${filter.sector === s ? "text-ink-950" : "text-ink-500 hover:text-ink-950"}`}
                >
                  {s}
                </button>
                <div className="flex items-center gap-1.5">
                  {KINDS.map((k) => {
                    const c = matrix[s]?.[k]?.count ?? 0;
                    const size = c === 0 ? 6 : Math.min(18, 6 + c * 2);
                    return (
                      <button
                        key={k}
                        onClick={() => onSelect({ sector: s, kind: k })}
                        title={`${k}: ${c}`}
                        className={`rounded-full ${c === 0 ? "bg-paper-100 border border-line-200" : "bg-ink-950"}`}
                        style={{ width: size, height: size }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent activity */}
      <section className="border border-line-200">
        <header className="border-b border-line-200 px-4 py-2">
          <h4 className="font-mono text-[11px] uppercase tracking-[0.2em]">Recent activity</h4>
        </header>
        <ul className="divide-y divide-line-200">
          {recent.length === 0 && <li className="p-4 text-sm text-ink-500">Nothing recorded yet.</li>}
          {recent.map((r) => (
            <li key={r.id} className="grid grid-cols-[1fr_auto] items-baseline gap-3 px-4 py-2 text-sm">
              <button
                onClick={() => onSelect({ sector: r.sector_code, kind: r.kind })}
                className="truncate text-left hover:text-ink-950"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  {r.kind} · {r.sector_code} ·{" "}
                </span>
                {r.title}
              </button>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                {r.verified ? "verified" : "unverified"} · {new Date(r.updated_at).toISOString().slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
