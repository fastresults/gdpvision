import { useMemo, useState } from "react";
import { Plus, Minus } from "lucide-react";

import { CARICOM_OECS_REGISTRY } from "@/lib/caricom-registry";

const COUNTRY_NAME_BY_CODE: Record<string, string> = CARICOM_OECS_REGISTRY.reduce(
  (acc, n) => {
    acc[n.code] = n.name;
    return acc;
  },
  {} as Record<string, string>,
);

function countryName(code: string): string {
  return COUNTRY_NAME_BY_CODE[code] ?? code;
}

function sectorLabel(code: string): string {
  if (!code || code === "—") return "Unclassified";
  return code
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

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
  centerLabel: string;
  filter: BrainFilter;
  onFilter: (f: BrainFilter) => void;
  onSelectCountry?: (code: string) => void;
};

/**
 * Fluid, organic constellation of second-brain memory.
 * - Curved bezier connections (no rigid spokes)
 * - Weighted, jittered sector positions (no perfect star)
 * - Soft gradient halos under each cluster
 * - Memory dots cluster inside their sector's halo, not around fixed diamonds
 */
export function BrainConstellation({
  rows,
  mode,
  centerLabel,
  filter,
  onFilter,
  onSelectCountry,
}: Props) {
  const [hover, setHover] = useState<{ label: string; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  const size = 900;
  const cx = size / 2;
  const cy = size / 2;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.25;

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100));

  const viewBox = useMemo(() => {
    if (zoom === 1) return `0 0 ${size} ${size}`;
    const w = size / zoom;
    const h = size / zoom;
    const x = (size - w) / 2;
    const y = (size - h) / 2;
    return `${x} ${y} ${w} ${h}`;
  }, [zoom]);

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
    () => Array.from(grouped.keys()).sort((a, b) => grouped.get(b)!.length - grouped.get(a)!.length),
    [grouped],
  );

  const activeRows = useMemo(() => {
    if (mode === "system" && filter.country) return grouped.get(filter.country) ?? [];
    return rows;
  }, [rows, mode, filter.country, grouped]);

  const sectorsMap = useMemo(() => {
    const s = new Map<string, BrainRow[]>();
    for (const r of activeRows) {
      const key = r.sector_code || "—";
      if (!s.has(key)) s.set(key, []);
      s.get(key)!.push(r);
    }
    return s;
  }, [activeRows]);

  // Sort by size so larger clusters get outer weight
  const sectorList = useMemo(
    () => Array.from(sectorsMap.keys()).sort((a, b) => sectorsMap.get(b)!.length - sectorsMap.get(a)!.length),
    [sectorsMap],
  );

  const now = Date.now();
  const isRecent = (r: BrainRow) => now - new Date(r.updated_at).getTime() < 24 * 60 * 60 * 1000;
  const recentCount = activeRows.filter(isRecent).length;
  const pulseAmp = Math.min(1, recentCount / 20);

  const coreR = 54;
  const showCountries = mode === "system" && !filter.country;

  // ---------- Non-uniform sector layout (weighted angular slots + radial jitter) ----------
  const sectorPositions = useMemo(() => {
    const totalWeight = sectorList.reduce((a, code) => a + Math.sqrt(sectorsMap.get(code)!.length), 0);
    let acc = 0;
    return sectorList.map((code) => {
      const w = Math.sqrt(sectorsMap.get(code)!.length);
      const frac = w / (totalWeight || 1);
      const angle = (acc + frac / 2) * Math.PI * 2 - Math.PI / 2 + (hash01(code + "a") - 0.5) * 0.35;
      acc += frac;
      // Radius varies per-sector (organic drift instead of a rigid ring)
      const baseR = showCountries ? 210 : 250;
      const r = baseR + (hash01(code + "r") - 0.5) * 90;
      return {
        code,
        angle,
        r,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      };
    });
  }, [sectorList, sectorsMap, showCountries, cx, cy]);

  const countryPositions = useMemo(() => {
    if (!showCountries) return [];
    const maxN = Math.max(1, ...countries.map((c) => grouped.get(c)!.length));
    return countries.map((code, i) => {
      const angle = (i / countries.length) * Math.PI * 2 - Math.PI / 2 + (hash01(code) - 0.5) * 0.2;
      const r = 360 + (hash01(code + "R") - 0.5) * 40;
      const rows = grouped.get(code)!;
      const recent = rows.filter(isRecent).length;
      return {
        code,
        angle,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        count: rows.length,
        recent,
        maxN,
      };
    });
  }, [showCountries, countries, cx, cy, grouped]);

  // Ambient starfield — deterministic twinkling dots behind everything
  const starfield = useMemo(() => {
    const stars: { x: number; y: number; r: number; dur: number; delay: number; base: number }[] = [];
    for (let i = 0; i < 46; i++) {
      const seed = `star-${i}`;
      const h1 = hash01(seed);
      const h2 = hash01(seed + "y");
      const h3 = hash01(seed + "r");
      const h4 = hash01(seed + "d");
      // Push toward edges to avoid overlap with core
      const px = h1 * size;
      const py = h2 * size;
      const dxc = px - cx;
      const dyc = py - cy;
      if (Math.hypot(dxc, dyc) < 160) continue;
      stars.push({
        x: px,
        y: py,
        r: 0.6 + h3 * 1.2,
        dur: 3 + h4 * 5,
        delay: h1 * 6,
        base: 0.08 + h3 * 0.15,
      });
    }
    return stars;
  }, [cx, cy, size]);


  const passes = (r: BrainRow) => {
    if (filter.sector && (r.sector_code || "—") !== filter.sector) return false;
    if (filter.kind && r.kind !== filter.kind) return false;
    if (filter.verified !== undefined && Boolean(r.verified) !== filter.verified) return false;
    return true;
  };
  const dimmed = (r: BrainRow) => !passes(r);

  // Curved path from core to a point (quadratic bezier with perpendicular offset)
  function curvePath(x1: number, y1: number, x2: number, y2: number, curvature = 0.28, seed = "") {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    // perpendicular
    const nx = -dy / len;
    const ny = dx / len;
    const off = (hash01(seed) - 0.5) * 2 * curvature * len;
    const px = mx + nx * off;
    const py = my + ny * off;
    return `M${x1},${y1} Q${px},${py} ${x2},${y2}`;
  }

  return (
    <div className="relative w-full">
      {/* Legend chip strip */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-ink-500">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => onFilter({ ...filter, kind: filter.kind === k ? undefined : k })}
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 border transition ${
              filter.kind === k ? "border-ink-950 text-ink-950 bg-paper-100" : "border-line-200 hover:text-ink-950"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND_COLOR[k] }} />
            {k}
          </button>
        ))}
        <span className="mx-1 text-line-300">|</span>
        <button
          onClick={() => onFilter({ ...filter, verified: filter.verified === true ? undefined : true })}
          className={`rounded-full px-2 py-0.5 border ${
            filter.verified === true ? "border-emerald-600 text-emerald-700" : "border-line-200 hover:text-ink-950"
          }`}
        >
          verified
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line-200 px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> active 24h
        </span>
        {(filter.country || filter.sector || filter.kind || filter.verified !== undefined) && (
          <button
            onClick={() => onFilter({})}
            className="rounded-full border border-ink-950 px-2 py-0.5 text-ink-950"
          >
            clear ✕
          </button>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-line-200 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        {/* Ambient background blobs */}
        <div className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[560px] w-[560px] rounded-full bg-fuchsia-200/25 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 right-1/4 h-[380px] w-[380px] rounded-full bg-emerald-200/20 blur-3xl" />

        <svg viewBox={viewBox} className="relative block w-full h-auto" style={{ maxHeight: "82vh" }}>
          <defs>
            <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="1" />
              <stop offset="70%" stopColor="#0f172a" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.85" />
            </radialGradient>
            <radialGradient id="coreHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="threadGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0f172a" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.15" />
            </linearGradient>
            <filter id="softBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="18" />
            </filter>
            {KINDS.map((k) => (
              <radialGradient key={k} id={`halo-${k}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={KIND_COLOR[k]} stopOpacity="0.35" />
                <stop offset="100%" stopColor={KIND_COLOR[k]} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          {/* Ambient starfield — deep background twinkle */}
          <g pointerEvents="none">
            {starfield.map((st, i) => (
              <circle key={`star-${i}`} cx={st.x} cy={st.y} r={st.r} fill="#0f172a" opacity={st.base}>
                <animate
                  attributeName="opacity"
                  values={`${st.base};${st.base + 0.35};${st.base}`}
                  dur={`${st.dur}s`}
                  begin={`${st.delay}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
          </g>

          {/* Core halo glow — slow breath */}
          <circle cx={cx} cy={cy} r={coreR + 180} fill="url(#coreHalo)">
            <animate attributeName="r" values={`${coreR + 170};${coreR + 200};${coreR + 170}`} dur="7s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.85;1;0.85" dur="7s" repeatCount="indefinite" />
          </circle>


          {/* Country threads (curved) with flowing dots */}
          {countryPositions.map((c) => {
            const w = 0.6 + (c.count / c.maxN) * 2.5;
            const path = curvePath(cx, cy, c.x, c.y, 0.18, c.code + "co");
            const dur = 4 + hash01(c.code + "dur") * 3; // 4-7s
            const dotCount = 2 + Math.round((c.count / c.maxN) * 2); // 2-4 dots
            return (
              <g key={`ct-${c.code}`}>
                <path
                  d={path}
                  fill="none"
                  stroke="#0f172a"
                  strokeOpacity="0.28"
                  strokeWidth={w}
                  strokeLinecap="round"
                >
                  <animate
                    attributeName="stroke-opacity"
                    values="0.18;0.4;0.18"
                    dur={`${5 + hash01(c.code + "so") * 3}s`}
                    repeatCount="indefinite"
                  />
                </path>

                {Array.from({ length: dotCount }).map((_, i) => (
                  <circle key={i} r={1.6} fill="#6366f1" opacity={0.85}>
                    <animateMotion
                      dur={`${dur}s`}
                      repeatCount="indefinite"
                      path={path}
                      begin={`${(i * dur) / dotCount}s`}
                    />
                  </circle>
                ))}
              </g>
            );
          })}

          {/* Country orbs */}
          {countryPositions.map((c) => {
            const r = 14 + (c.count / c.maxN) * 14;
            const name = countryName(c.code);
            return (
              <g
                key={`cn-${c.code}`}
                onClick={() => (onSelectCountry ? onSelectCountry(c.code) : onFilter({ ...filter, country: c.code }))}
                onMouseEnter={() => setHover({ label: `${name} · ${c.count} memories`, x: c.x, y: c.y })}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer"
              >
                <title>{`${name} (${c.code})`}</title>
                {/* Breathing halo */}
                <circle cx={c.x} cy={c.y} r={r + 12} fill="#6366f1" opacity="0.12">
                  <animate
                    attributeName="r"
                    values={`${r + 10};${r + 20};${r + 10}`}
                    dur={`${3.4 + hash01(c.code + "br") * 1.8}s`}
                    begin={`${hash01(c.code + "bd") * 2}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.05;0.22;0.05"
                    dur={`${3.4 + hash01(c.code + "br") * 1.8}s`}
                    begin={`${hash01(c.code + "bd") * 2}s`}
                    repeatCount="indefinite"
                  />
                </circle>
                {c.recent > 0 && (
                  <circle cx={c.x} cy={c.y} r={r + 6} fill="none" stroke="#f59e0b" strokeWidth="1.2" strokeOpacity="0.6">
                    <animate attributeName="r" values={`${r + 4};${r + 18};${r + 4}`} dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={c.x} cy={c.y} r={r + 8} fill="#0f172a" opacity="0.08" />
                <circle cx={c.x} cy={c.y} r={r} fill="#0f172a" />

                <text x={c.x} y={c.y + 3} textAnchor="middle" fontSize="10" fill="#fafafa" fontFamily="ui-monospace, monospace">
                  {c.code}
                </text>
                <text
                  x={c.x}
                  y={c.y + r + 14}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#0f172a"
                  fontFamily="ui-sans-serif, system-ui"
                  fontWeight="500"
                >
                  {name}
                </text>
              </g>
            );
          })}

          {/* Sector clusters */}
          {sectorPositions.map((s) => {
            const sectorRows = sectorsMap.get(s.code)!;
            const kindCounts = new Map<string, number>();
            let verified = 0;
            let recent = 0;
            for (const r of sectorRows) {
              kindCounts.set(r.kind, (kindCounts.get(r.kind) ?? 0) + 1);
              if (r.verified) verified += 1;
              if (isRecent(r)) recent += 1;
            }
            const dominantKind = [...kindCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "fact";
            const totalWeight = sectorRows.reduce((a, b) => a + (b.weight || 0), 0);
            const orbR = 10 + Math.min(28, Math.sqrt(sectorRows.length) * 3.5);
            const haloR = orbR + 46 + Math.min(30, sectorRows.length * 1.2);
            const isFiltered = filter.sector && filter.sector !== s.code;
            const seed = s.code;

            return (
              <g key={s.code} opacity={isFiltered ? 0.18 : 1}>
                {/* Soft halo behind the cluster, colored by dominant kind — breathes */}
                <circle cx={s.x} cy={s.y} r={haloR} fill={`url(#halo-${dominantKind})`}>
                  <animate
                    attributeName="r"
                    values={`${haloR - 6};${haloR + 10};${haloR - 6}`}
                    dur={`${5 + hash01(seed + "hb") * 3}s`}
                    begin={`${hash01(seed + "hd") * 3}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.7;1;0.7"
                    dur={`${5 + hash01(seed + "hb") * 3}s`}
                    begin={`${hash01(seed + "hd") * 3}s`}
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Curved thread from core to sector — living pulse */}
                <path
                  d={curvePath(cx, cy, s.x, s.y, 0.22, seed)}
                  fill="none"
                  stroke="url(#threadGrad)"
                  strokeWidth={0.9 + Math.min(2.6, totalWeight / 26)}
                  strokeLinecap="round"
                  strokeOpacity={0.55 + Math.min(0.35, totalWeight / 60)}
                >
                  <animate
                    attributeName="stroke-opacity"
                    values="0.3;0.7;0.3"
                    dur={`${4 + hash01(seed + "ts") * 3}s`}
                    begin={`${hash01(seed + "td") * 2}s`}
                    repeatCount="indefinite"
                  />
                </path>


                {/* Continuous flowing dots along the sector thread */}
                {(() => {
                  const path = curvePath(cx, cy, s.x, s.y, 0.22, seed);
                  const dur = 3.5 + hash01(seed + "d") * 3;
                  const dotCount = recent > 0 ? 3 : 2;
                  const color = recent > 0 ? "#f59e0b" : KIND_COLOR[dominantKind] ?? "#6366f1";
                  return Array.from({ length: dotCount }).map((_, i) => (
                    <circle key={`flow-${i}`} r={recent > 0 ? 2.6 : 1.8} fill={color} opacity={0.9}>
                      <animateMotion
                        dur={`${dur}s`}
                        repeatCount="indefinite"
                        path={path}
                        begin={`${(i * dur) / dotCount}s`}
                      />
                    </circle>
                  ));
                })()}

                {/* Memory dots — clustered organically inside the halo, not on rigid arms */}
                {sectorRows.slice(0, 60).map((r, i) => {
                  const h1 = hash01(r.id);
                  const h2 = hash01(r.id + "b");
                  // polar within halo, biased inward
                  const angle = h1 * Math.PI * 2;
                  const rad = 8 + Math.sqrt(h2) * (haloR - 12);
                  const dx = s.x + Math.cos(angle) * rad;
                  const dy = s.y + Math.sin(angle) * rad;
                  const dur = 14 + h1 * 22;
                  const dot = isRecent(r) ? 2.4 : 1.6;
                  const op = dimmed(r) ? 0.08 : r.verified ? 0.95 : 0.55;
                  const color = r.verified ? "#10b981" : KIND_COLOR[r.kind] ?? "#64748b";
                  // subtle orbital drift
                  const driftR = 4 + (i % 4);
                  return (
                    <g
                      key={r.id}
                      opacity={op}
                      onMouseEnter={() => setHover({ label: r.title, x: dx, y: dy })}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => onFilter({ ...filter, sector: s.code, kind: r.kind })}
                      className="cursor-pointer"
                    >
                      <circle r={dot} fill={color}>
                        <animateMotion
                          dur={`${dur}s`}
                          repeatCount="indefinite"
                          path={`M ${dx - driftR} ${dy} A ${driftR} ${driftR} 0 1 1 ${dx - driftR - 0.01} ${dy} Z`}
                        />
                      </circle>
                      {isRecent(r) && (
                        <circle r={dot + 2} fill="none" stroke={color} strokeOpacity="0.5">
                          <animate attributeName="r" values={`${dot + 1};${dot + 6};${dot + 1}`} dur="3s" repeatCount="indefinite" />
                          <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite" />
                          <animateMotion
                            dur={`${dur}s`}
                            repeatCount="indefinite"
                            path={`M ${dx - driftR} ${dy} A ${driftR} ${driftR} 0 1 1 ${dx - driftR - 0.01} ${dy} Z`}
                          />
                        </circle>
                      )}
                    </g>
                  );
                })}

                {/* Sector orb */}
                <g
                  onClick={() => onFilter({ ...filter, sector: filter.sector === s.code ? undefined : s.code })}
                  onMouseEnter={() => setHover({ label: `${s.code} · ${sectorRows.length} memories · ${verified} verified`, x: s.x, y: s.y })}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer"
                >
                  {verified > 0 && (
                    <circle
                      cx={s.x}
                      cy={s.y}
                      r={orbR + 5}
                      fill="none"
                      stroke="#10b981"
                      strokeOpacity={Math.min(0.85, verified / sectorRows.length)}
                      strokeWidth="1.25"
                    />
                  )}
                  <circle cx={s.x} cy={s.y} r={orbR + 2} fill="#ffffff" />
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={orbR}
                    fill="#ffffff"
                    stroke="#0f172a"
                    strokeWidth={filter.sector === s.code ? 2.25 : 1}
                  />
                  <text
                    x={s.x}
                    y={s.y + 3}
                    textAnchor="middle"
                    fontSize={Math.min(11, orbR / 2 + 4)}
                    fill="#0f172a"
                    fontFamily="ui-monospace, monospace"
                  >
                    {s.code.slice(0, 4)}
                  </text>
                  <text
                    x={s.x}
                    y={s.y + orbR + 14}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#0f172a"
                    fontFamily="ui-sans-serif, system-ui"
                    fontWeight="500"
                  >
                    {sectorLabel(s.code)}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Core */}
          <g>
            <circle cx={cx} cy={cy} r={coreR + 22} fill="none" stroke="#6366f1" strokeOpacity={0.25 + pulseAmp * 0.35} strokeWidth="1">
              <animate attributeName="r" values={`${coreR + 16};${coreR + 30};${coreR + 16}`} dur="4.5s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values={`${0.1 + pulseAmp * 0.2};${0.3 + pulseAmp * 0.4};${0.1 + pulseAmp * 0.2}`} dur="4.5s" repeatCount="indefinite" />
            </circle>
            <circle cx={cx} cy={cy} r={coreR + 8} fill="#0f172a" opacity="0.12" />
            <circle cx={cx} cy={cy} r={coreR} fill="url(#coreGrad)" />
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize="15" fill="#fafafa" fontFamily="ui-monospace, monospace" fontWeight="600">
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
                x={Math.min(hover.x + 10, size - 240)}
                y={Math.max(hover.y - 26, 4)}
                rx="6"
                ry="6"
                width={Math.min(230, Math.max(120, hover.label.length * 6.2))}
                height="22"
                fill="#0f172a"
                opacity="0.92"
              />
              <text
                x={Math.min(hover.x + 20, size - 230)}
                y={Math.max(hover.y - 11, 19)}
                fontSize="11"
                fill="#fafafa"
                fontFamily="ui-sans-serif, system-ui"
              >
                {hover.label.length > 34 ? hover.label.slice(0, 33) + "…" : hover.label}
              </text>
            </g>
          )}
        </svg>

        {/* Footer stat pills */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          <Pill label="rows" value={activeRows.length} />
          <Pill label="sectors" value={sectorList.length} />
          <Pill label="verified" value={activeRows.filter((r) => r.verified).length} tone="emerald" />
          <Pill label="24h" value={recentCount} tone="amber" />
          {mode === "system" && !filter.country && <Pill label="countries" value={countries.length} />}
        </div>
        {mode === "system" && filter.country && (
          <button
            onClick={() => onFilter({ ...filter, country: undefined, sector: undefined })}
            className="absolute top-3 right-3 rounded-full border border-ink-950 bg-white/90 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-950 backdrop-blur"
          >
            ← All countries
          </button>
        )}

        {/* Zoom controls */}
        <div className="pointer-events-auto absolute bottom-3 right-3 flex items-center gap-1 rounded-full border border-line-200 bg-white/80 px-1 py-0.5 backdrop-blur">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink-500 hover:bg-line-100 hover:text-ink-950 disabled:opacity-40"
            aria-label="Zoom out"
          >
            <Minus size={14} />
          </button>
          <span className="w-8 text-center font-mono text-[10px] uppercase tracking-widest text-ink-500">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink-500 hover:bg-line-100 hover:text-ink-950 disabled:opacity-40"
            aria-label="Zoom in"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Pill({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" }) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-600" : "text-ink-950";
  return (
    <span className="rounded-full border border-line-200 bg-white/80 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-500 backdrop-blur">
      {label} <span className={`ml-1 tabular-nums ${color}`}>{value}</span>
    </span>
  );
}
