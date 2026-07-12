import { useMemo, useState } from "react";

export type BrainRow = {
  id: string;
  title: string;
  kind: string;
  sector_code: string | null;
  scope_key: string;
  weight: number;
  verified: boolean;
  updated_at: string;
};

export type BrainFilter = {
  country?: string;
  sector?: string;
  kind?: string;
  verified?: boolean;
};

const KINDS = ["audience", "position", "statement", "outlet", "precedent", "fact", "risk"] as const;

const KIND_COLOR: Record<string, string> = {
  audience: "#38bdf8",
  position: "#f472b6",
  statement: "#a78bfa",
  outlet: "#fb923c",
  precedent: "#facc15",
  fact: "#34d399",
  risk: "#f87171",
};

// Deterministic hash → [0, 1)
function hash01(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

type Mode = "single" | "system";

type Props = {
  rows: BrainRow[];
  mode: Mode;
  centerLabel: string;         // country code or "SYSTEM"
  filter: BrainFilter;
  onFilter: (f: BrainFilter) => void;
  onSelectCountry?: (code: string) => void;
};

/**
 * State-of-the-art visual second brain: a living constellation.
 *
 * Layers from center → out:
 *   • Core          — country (or system) with slow pulse
 *   • Country ring  — one orb per country (system mode only)
 *   • Sector ring   — one orb per sector; angle deterministic by code
 *   • Kind ring     — 7 diamonds per sector, one per memory kind
 *   • Memory dust   — one dot per memory object, drifting on a slow orbit
 *   • Threads       — thin line from core → sector → kind, brighter on activity
 */
export function BrainConstellation({
  rows,
  mode,
  centerLabel,
  filter,
  onFilter,
  onSelectCountry,
}: Props) {
  const [hover, setHover] = useState<{ kind: "sector" | "kind" | "country" | "memory"; label: string; x: number; y: number } | null>(null);

  const size = 820;
  const cx = size / 2;
  const cy = size / 2;

  // Group rows by country / sector / kind
  const grouped = useMemo(() => {
    const byCountry = new Map<string, BrainRow[]>();
    for (const r of rows) {
      const c = r.scope_key || "—";
      if (!byCountry.has(c)) byCountry.set(c, []);
      byCountry.get(c)!.push(r);
    }
    return byCountry;
  }, [rows]);

  const countries = useMemo(
    () => Array.from(grouped.keys()).sort((a, b) => (grouped.get(b)!.length - grouped.get(a)!.length)),
    [grouped],
  );

  // For single-country mode, we act on all rows; for system, use filtered subset if a country is selected
  const activeRows = useMemo(() => {
    if (mode === "system" && filter.country) {
      return grouped.get(filter.country) ?? [];
    }
    return rows;
  }, [rows, mode, filter.country, grouped]);

  const sectors = useMemo(() => {
    const s = new Map<string, BrainRow[]>();
    for (const r of activeRows) {
      const key = r.sector_code || "—";
      if (!s.has(key)) s.set(key, []);
      s.get(key)!.push(r);
    }
    return s;
  }, [activeRows]);

  const sectorList = useMemo(
    () => Array.from(sectors.keys()).sort((a, b) => sectors.get(b)!.length - sectors.get(a)!.length),
    [sectors],
  );

  // Recency: is a row updated in the last 24h?
  const now = Date.now();
  const isRecent = (r: BrainRow) => now - new Date(r.updated_at).getTime() < 24 * 60 * 60 * 1000;
  const recentCount = activeRows.filter(isRecent).length;
  const pulseAmp = Math.min(1, recentCount / 20); // 0..1

  const coreR = 46;

  // System-mode country ring
  const countryRingR = 340;
  const showCountries = mode === "system" && !filter.country;

  // Sector ring radius adapts to whether country ring is showing
  const sectorRingR = showCountries ? 220 : 260;
  const kindRingR = 60; // radius of kind diamonds around each sector

  const sectorPositions = useMemo(() => {
    return sectorList.map((code, i) => {
      // Even angular distribution + deterministic offset so identical brains render identically
      const jitter = (hash01(code) - 0.5) * 0.1;
      const angle = (i / Math.max(1, sectorList.length)) * Math.PI * 2 + jitter - Math.PI / 2;
      return {
        code,
        angle,
        x: cx + Math.cos(angle) * sectorRingR,
        y: cy + Math.sin(angle) * sectorRingR,
      };
    });
  }, [sectorList, sectorRingR, cx, cy]);

  const countryPositions = useMemo(() => {
    if (!showCountries) return [];
    return countries.map((code, i) => {
      const angle = (i / Math.max(1, countries.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        code,
        angle,
        x: cx + Math.cos(angle) * countryRingR,
        y: cy + Math.sin(angle) * countryRingR,
        count: grouped.get(code)!.length,
      };
    });
  }, [showCountries, countries, countryRingR, cx, cy, grouped]);

  const maxCountryCount = Math.max(1, ...countryPositions.map((c) => c.count));

  // ---- Passes filter?
  const passes = (r: BrainRow) => {
    if (filter.sector && (r.sector_code || "—") !== filter.sector) return false;
    if (filter.kind && r.kind !== filter.kind) return false;
    if (filter.verified !== undefined && Boolean(r.verified) !== filter.verified) return false;
    return true;
  };

  const dimmed = (r: BrainRow) => !passes(r);

  return (
    <div className="relative w-full">
      {/* Legend + controls chip strip */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-ink-500">
        <span>Legend:</span>
        <LegendDot label="core" render={<circle cx="7" cy="7" r="5" fill="#0a0a0a" />} />
        <LegendDot label="sector" render={<circle cx="7" cy="7" r="4" fill="none" stroke="#0a0a0a" strokeWidth="1.5" />} />
        <LegendDot label="kind" render={<rect x="3" y="3" width="8" height="8" transform="rotate(45 7 7)" fill="#0a0a0a" />} />
        <LegendDot label="memory" render={<circle cx="7" cy="7" r="1.5" fill="#0a0a0a" />} />
        <LegendDot label="verified" render={<circle cx="7" cy="7" r="3" fill="none" stroke="#10b981" strokeWidth="1.5" />} />
        <LegendDot label="active 24h" render={<circle cx="7" cy="7" r="3" fill="#f59e0b" className="animate-pulse" />} />
        <span className="ml-2">·</span>
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => onFilter({ ...filter, kind: filter.kind === k ? undefined : k })}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 border ${filter.kind === k ? "border-ink-950 text-ink-950" : "border-line-200 hover:text-ink-950"}`}
          >
            <span className="h-2 w-2 rounded-sm" style={{ background: KIND_COLOR[k] }} />
            {k}
          </button>
        ))}
        <button
          onClick={() => onFilter({ ...filter, verified: filter.verified === true ? undefined : true })}
          className={`px-1.5 py-0.5 border ${filter.verified === true ? "border-emerald-600 text-emerald-700" : "border-line-200 hover:text-ink-950"}`}
        >
          verified only
        </button>
        {(filter.country || filter.sector || filter.kind || filter.verified !== undefined) && (
          <button
            onClick={() => onFilter({})}
            className="px-1.5 py-0.5 border border-ink-950 text-ink-950"
          >
            clear ✕
          </button>
        )}
      </div>

      <div className="relative border border-line-200 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.04),rgba(15,23,42,0))]">
        <svg viewBox={`0 0 ${size} ${size}`} className="block w-full h-auto" style={{ maxHeight: "78vh" }}>
          <defs>
            <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0a0a0a" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0.6" />
            </radialGradient>
            <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.2" />
            </filter>
          </defs>

          {/* Concentric guide rings */}
          <g opacity="0.35">
            {[100, 160, 220, 280, 340].filter((r) => r <= (showCountries ? countryRingR : sectorRingR) + 20).map((r) => (
              <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#94a3b8" strokeDasharray="2 6" strokeWidth="0.5" />
            ))}
          </g>

          {/* Country ring threads */}
          {countryPositions.map((c) => {
            const w = 0.5 + (c.count / maxCountryCount) * 2.5;
            return (
              <line
                key={`ct-${c.code}`}
                x1={cx}
                y1={cy}
                x2={c.x}
                y2={c.y}
                stroke="#0f172a"
                strokeOpacity="0.35"
                strokeWidth={w}
              />
            );
          })}

          {/* Country orbs */}
          {countryPositions.map((c) => {
            const r = 12 + (c.count / maxCountryCount) * 14;
            return (
              <g
                key={`cn-${c.code}`}
                onClick={() => (onSelectCountry ? onSelectCountry(c.code) : onFilter({ ...filter, country: c.code }))}
                onMouseEnter={() => setHover({ kind: "country", label: `${c.code} · ${c.count} memories`, x: c.x, y: c.y })}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer"
              >
                <circle cx={c.x} cy={c.y} r={r + 6} fill="#0a0a0a" opacity="0.06" />
                <circle cx={c.x} cy={c.y} r={r} fill="#0a0a0a" />
                <text x={c.x} y={c.y + 3} textAnchor="middle" fontSize="10" fill="#fafafa" fontFamily="ui-monospace, monospace">
                  {c.code}
                </text>
              </g>
            );
          })}

          {/* Sector arms */}
          {sectorPositions.map((s) => {
            const sectorRows = sectors.get(s.code)!;
            const kindCounts = new Map<string, number>();
            let verified = 0;
            let recent = 0;
            for (const r of sectorRows) {
              kindCounts.set(r.kind, (kindCounts.get(r.kind) ?? 0) + 1);
              if (r.verified) verified += 1;
              if (isRecent(r)) recent += 1;
            }
            const totalWeight = sectorRows.reduce((a, b) => a + (b.weight || 0), 0);
            const orbR = 8 + Math.min(24, Math.sqrt(sectorRows.length) * 3);
            const isFiltered = filter.sector && filter.sector !== s.code;

            return (
              <g key={s.code} opacity={isFiltered ? 0.2 : 1}>
                {/* Thread from core to sector */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={s.x}
                  y2={s.y}
                  stroke="#0f172a"
                  strokeOpacity={0.15 + Math.min(0.4, totalWeight / 40)}
                  strokeWidth={0.75 + Math.min(2, totalWeight / 30)}
                />

                {/* Travelling dot on the thread if sector had recent activity */}
                {recent > 0 && (
                  <circle r="2.5" fill="#f59e0b">
                    <animateMotion
                      dur={`${3 + hash01(s.code) * 2}s`}
                      repeatCount="indefinite"
                      path={`M${cx},${cy} L${s.x},${s.y}`}
                    />
                    <animate attributeName="opacity" values="0;1;1;0" dur={`${3 + hash01(s.code) * 2}s`} repeatCount="indefinite" />
                  </circle>
                )}

                {/* Sector orb */}
                <g
                  onClick={() => onFilter({ ...filter, sector: filter.sector === s.code ? undefined : s.code })}
                  onMouseEnter={() => setHover({ kind: "sector", label: `${s.code} · ${sectorRows.length} · ${verified} verified`, x: s.x, y: s.y })}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer"
                >
                  <circle cx={s.x} cy={s.y} r={orbR + 4} fill="none" stroke="#10b981" strokeOpacity={verified > 0 ? Math.min(0.9, verified / sectorRows.length) : 0} strokeWidth="1" />
                  <circle cx={s.x} cy={s.y} r={orbR} fill="#fafafa" stroke="#0a0a0a" strokeWidth={filter.sector === s.code ? 2.5 : 1.25} />
                  <text
                    x={s.x}
                    y={s.y + 3}
                    textAnchor="middle"
                    fontSize={Math.min(10, orbR / 2 + 4)}
                    fill="#0a0a0a"
                    fontFamily="ui-monospace, monospace"
                  >
                    {s.code.slice(0, 4)}
                  </text>
                </g>

                {/* Kind ring around the sector */}
                {KINDS.map((k, ki) => {
                  const count = kindCounts.get(k) ?? 0;
                  const angle = (ki / KINDS.length) * Math.PI * 2 + s.angle;
                  const kx = s.x + Math.cos(angle) * kindRingR;
                  const ky = s.y + Math.sin(angle) * kindRingR;
                  const filled = count > 0;
                  const dim = filter.kind && filter.kind !== k;
                  return (
                    <g
                      key={`${s.code}-${k}`}
                      opacity={dim ? 0.2 : 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onFilter({ ...filter, sector: s.code, kind: filter.kind === k && filter.sector === s.code ? undefined : k });
                      }}
                      onMouseEnter={() => setHover({ kind: "kind", label: `${s.code} · ${k} · ${count}`, x: kx, y: ky })}
                      onMouseLeave={() => setHover(null)}
                      className={filled ? "cursor-pointer" : ""}
                    >
                      {/* Line sector→kind */}
                      <line x1={s.x} y1={s.y} x2={kx} y2={ky} stroke={KIND_COLOR[k]} strokeOpacity={filled ? 0.35 : 0.08} strokeWidth={filled ? 0.75 : 0.4} />
                      {/* Diamond */}
                      <rect
                        x={kx - 4}
                        y={ky - 4}
                        width="8"
                        height="8"
                        transform={`rotate(45 ${kx} ${ky})`}
                        fill={filled ? KIND_COLOR[k] : "transparent"}
                        stroke={KIND_COLOR[k]}
                        strokeWidth="1"
                      />
                      {filled && count > 1 && (
                        <text x={kx} y={ky - 8} textAnchor="middle" fontSize="8" fill="#334155" fontFamily="ui-monospace, monospace">
                          {count}
                        </text>
                      )}

                      {/* Memory dust: dots on a tiny orbit around the kind diamond */}
                      {filled && sectorRows
                        .filter((r) => r.kind === k)
                        .slice(0, 10)
                        .map((r, i, arr) => {
                          const dustAngle = (i / arr.length) * Math.PI * 2 + hash01(r.id) * Math.PI * 2;
                          const dustR = 8 + (i % 3) * 2;
                          const dx = kx + Math.cos(dustAngle) * dustR;
                          const dy = ky + Math.sin(dustAngle) * dustR;
                          const dur = 12 + hash01(r.id) * 20;
                          const recent = isRecent(r);
                          const opacity = dimmed(r) ? 0.1 : r.verified ? 0.95 : 0.55;
                          return (
                            <g key={r.id} opacity={opacity}>
                              <circle
                                r={recent ? 2 : 1.4}
                                fill={r.verified ? "#10b981" : KIND_COLOR[k]}
                              >
                                <animateMotion
                                  dur={`${dur}s`}
                                  repeatCount="indefinite"
                                  path={`M ${dx - kx} ${dy - ky} A ${dustR} ${dustR} 0 1 1 ${dx - kx - 0.01} ${dy - ky} Z`}
                                />
                                <animateTransform
                                  attributeName="transform"
                                  type="translate"
                                  from={`${kx} ${ky}`}
                                  to={`${kx} ${ky}`}
                                  dur="1s"
                                  repeatCount="1"
                                />
                              </circle>
                            </g>
                          );
                        })}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Core */}
          <g>
            <circle
              cx={cx}
              cy={cy}
              r={coreR + 20}
              fill="none"
              stroke="#0a0a0a"
              strokeOpacity={0.15 + pulseAmp * 0.35}
              strokeWidth="1"
            >
              <animate attributeName="r" values={`${coreR + 14};${coreR + 26};${coreR + 14}`} dur="4s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values={`${0.05 + pulseAmp * 0.2};${0.25 + pulseAmp * 0.4};${0.05 + pulseAmp * 0.2}`} dur="4s" repeatCount="indefinite" />
            </circle>
            <circle cx={cx} cy={cy} r={coreR} fill="url(#coreGrad)" />
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize="14" fill="#fafafa" fontFamily="ui-monospace, monospace" fontWeight="600">
              {centerLabel}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="ui-monospace, monospace">
              {activeRows.length} memories
            </text>
          </g>

          {/* Tooltip */}
          {hover && (
            <g pointerEvents="none">
              <rect
                x={Math.min(hover.x + 10, size - 180)}
                y={Math.max(hover.y - 24, 4)}
                width="170"
                height="20"
                fill="#0a0a0a"
                opacity="0.9"
              />
              <text
                x={Math.min(hover.x + 18, size - 172)}
                y={Math.max(hover.y - 10, 18)}
                fontSize="10"
                fill="#fafafa"
                fontFamily="ui-monospace, monospace"
              >
                {hover.label}
              </text>
            </g>
          )}
        </svg>

        {/* Corner stats */}
        <div className="absolute bottom-3 left-3 flex gap-4 font-mono text-[10px] uppercase tracking-widest text-ink-500">
          <span>rows <span className="text-ink-950">{activeRows.length}</span></span>
          <span>sectors <span className="text-ink-950">{sectorList.length}</span></span>
          <span>verified <span className="text-emerald-600">{activeRows.filter((r) => r.verified).length}</span></span>
          <span>24h <span className="text-amber-600">{recentCount}</span></span>
          {mode === "system" && !filter.country && (
            <span>countries <span className="text-ink-950">{countries.length}</span></span>
          )}
        </div>
        {mode === "system" && filter.country && (
          <button
            onClick={() => onFilter({ ...filter, country: undefined, sector: undefined })}
            className="absolute top-3 right-3 border border-ink-950 bg-paper-0 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-950"
          >
            ← All countries
          </button>
        )}
      </div>
    </div>
  );
}

function LegendDot({ label, render }: { label: string; render: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg width="14" height="14">{render}</svg>
      {label}
    </span>
  );
}
