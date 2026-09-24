import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { geoDistance, geoGraticule10, geoOrthographic, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { Crosshair, Minus, Plus } from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { feature } from "topojson-client";
import landTopo from "world-atlas/land-110m.json";

import { getGlobalHazards } from "@/lib/sovereign-eye/global-feeds.functions";
import type { SovereignEyeFlowPartner } from "@/lib/sovereign-eye.functions";

import type { MapFeature } from "./RegionMap";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LAND = feature(landTopo as any, (landTopo as any).objects.land) as unknown as GeoPermissibleObjects;
const GRATICULE = geoGraticule10();
const CARIBBEAN: GeoPermissibleObjects = { type: "Polygon", coordinates: [[[-90, 8], [-58, 8], [-58, 28], [-90, 28], [-90, 8]]] } as GeoPermissibleObjects;

export type GlobeLayers = { flows: boolean; storms: boolean; quakes: boolean };

type Props = {
  code: string;
  countryName: string;
  center: { lat: number; lon: number };
  partners: SovereignEyeFlowPartner[];
  sideOf: (nodeKey: string) => "input" | "output";
  flowLabel: (nodeKey: string) => string;
  interaction: (f: MapFeature) => Record<string, unknown>;
  makeFeature: (f: Omit<MapFeature, "signal" | "trend" | "impact" | "forecast"> & Partial<Pick<MapFeature, "signal" | "trend" | "impact" | "forecast">>) => MapFeature;
  highlightId?: string | null;
};

export function GlobeView({ code, countryName, center, partners, sideOf, flowLabel, interaction, makeFeature, highlightId }: Props) {
  const [rotate, setRotate] = useState<[number, number]>([-center.lon, -center.lat]);
  const [zoom, setZoom] = useState(1);
  const [layers, setLayers] = useState<GlobeLayers>({ flows: true, storms: true, quakes: true });
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchHazards = useServerFn(getGlobalHazards);
  const hazards = useQuery({
    queryKey: ["sovereign-eye", "global-hazards", code],
    queryFn: () => fetchHazards({ data: { countryCode: code, lat: center.lat, lon: center.lon } }),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const projection = useMemo(() => geoOrthographic().scale(46 * zoom).translate([50, 50]).rotate(rotate).clipAngle(90).precision(0.3), [rotate, zoom]);
  const path = useMemo(() => geoPath(projection), [projection]);
  const facing = (lon: number, lat: number) => geoDistance([lon, lat], [-rotate[0], -rotate[1]]) < Math.PI / 2 - 0.02;
  const pt = (lon: number, lat: number) => projection([lon, lat]) ?? [50, 50];

  const begin = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!(e.target as Element).hasAttribute("data-globe-surface")) return;
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current; if (!d || d.id !== e.pointerId) return;
    const w = svgRef.current?.clientWidth || 600;
    const k = 180 / (w * zoom * 0.9);
    const dx = (e.clientX - d.x) * k; const dy = (e.clientY - d.y) * k;
    d.x = e.clientX; d.y = e.clientY;
    setRotate(([lam, phi]) => [lam + dx, Math.max(-85, Math.min(85, phi - dy))]);
  };
  const end = (e: ReactPointerEvent<SVGSVGElement>) => { if (dragRef.current?.id === e.pointerId) dragRef.current = null; };

  const home = pt(center.lon, center.lat);
  const data = hazards.data;
  const toggles: Array<{ key: keyof GlobeLayers; label: string; note: string }> = [
    { key: "flows", label: "Capital partners", note: `${partners.length} cited` },
    { key: "storms", label: "Hurricanes · NOAA", note: data ? (data.status.storms.ok ? `${data.storms.length} active` : "Feed unavailable") : hazards.isError ? "Feed unavailable" : "Loading…" },
    { key: "quakes", label: "Earthquakes · USGS", note: data ? (data.status.quakes.ok ? `${data.quakes.length} M4.5+ · 7d` : "Feed unavailable") : hazards.isError ? "Feed unavailable" : "Loading…" },
  ];

  return (
    <>
      <svg ref={svgRef} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Globe centred on ${countryName}`} className="absolute inset-0 h-full w-full touch-none cursor-grab" onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
        onWheel={(e) => setZoom((z) => Math.max(0.8, Math.min(6, z * (e.deltaY > 0 ? 0.9 : 1.1))))}>
        <circle data-globe-surface="" cx="50" cy="50" r={46 * zoom} className="fill-paper-0 stroke-ink-950" strokeWidth="0.35" />
        <path data-globe-surface="" d={path(GRATICULE) ?? ""} className="fill-none stroke-line-200" strokeWidth="0.12" />
        <path data-globe-surface="" d={path(LAND) ?? ""} className="fill-paper-100 stroke-ink-700" strokeWidth="0.18" />
        <path d={path(CARIBBEAN) ?? ""} className="pointer-events-none fill-gold-300/10 stroke-gold-500" strokeWidth="0.25" strokeDasharray="0.8 0.6" />

        {layers.quakes && data?.quakes.filter((q) => facing(q.lon, q.lat)).map((q) => {
          const [x, y] = pt(q.lon, q.lat);
          const f = makeFeature({ id: `quake-${q.id}`, kind: "live", title: `M${q.magnitude.toFixed(1)} earthquake`, value: q.place, meta: `${new Date(q.time).toLocaleString()}${q.distanceKm != null ? ` · ${q.distanceKm.toLocaleString()} km from ${countryName}` : ""}`, evidenceCount: 1, provenance: "USGS Earthquake Hazards Program · U.S. public domain · live context, not corpus evidence", signal: "A recorded earthquake of magnitude 4.5 or greater in the past seven days.", trend: "A single event is not a trend; the ring size shows magnitude only.", impact: q.distanceKm != null && q.distanceKm < 800 ? "Close enough to matter for infrastructure, insurance and tourism confidence; check official damage reports." : "Distant from the selected country; relevant mainly to regional trade and insurance markets." });
          return <g key={f.id} {...interaction(f)}><circle cx={x} cy={y} r="2" className="fill-transparent" /><circle cx={x} cy={y} r={Math.max(0.4, (q.magnitude - 4) * 0.55)} className="fill-signal-caution/30 stroke-signal-caution" strokeWidth={highlightId === f.id ? 0.4 : 0.18} /></g>;
        })}

        {layers.flows && partners.map((p, i) => {
          if (p.lat == null || p.lon == null) return null;
          const side = sideOf(p.nodeKey);
          const line = { type: "LineString", coordinates: side === "input" ? [[p.lon, p.lat], [center.lon, center.lat]] : [[center.lon, center.lat], [p.lon, p.lat]] } as GeoPermissibleObjects;
          const d = path(line); if (!d) return null;
          const label = flowLabel(p.nodeKey);
          const f = makeFeature({ id: `globe-partner-${p.nodeKey}-${p.partnerIso3 ?? p.partnerName}-${i}`, kind: "capital", title: `${p.partnerName} · ${label}`, value: [p.valueUsdM != null ? `US$${p.valueUsdM.toFixed(2)}m` : null, p.sharePct != null ? `${p.sharePct.toFixed(1)}% of ${label}` : null].filter(Boolean).join(" · ") || "Share not estimated", meta: `${side === "input" ? "Inbound origin" : "Outbound destination"} · ${p.period}`, visibility: p.visibility, evidenceCount: 1, provenance: `Partner share estimate · confidence grade ${p.confidence} · ${p.visibility} evidence`, trend: "Partner geography is a snapshot for the stated period, not a time series.", impact: "Shows where external receipts or payments concentrate; inspect the confidence grade and citation before use." });
          const w = Math.max(0.3, Math.min(1.4, (p.valueUsdM ?? (p.sharePct ?? 8) * 8) / 250));
          const vis = facing(p.lon, p.lat); const [x, y] = pt(p.lon, p.lat);
          return <g key={f.id} {...interaction(f)}>
            <path d={d} className={`fill-none ${side === "input" ? "stroke-signal-positive" : "stroke-signal-caution"}`} strokeWidth={w} strokeLinecap="round" strokeDasharray={p.confidence === "A" ? undefined : "1.2 0.8"} opacity={highlightId === f.id ? 1 : 0.75} />
            <path d={d} className="fill-none stroke-transparent" strokeWidth="3" />
            {vis ? <><circle cx={x} cy={y} r="0.9" className={side === "input" ? "fill-signal-positive" : "fill-signal-caution"} /><text x={x + 1.4} y={y - 0.8} className="fill-ink-700 font-mono text-[1.5px]">{p.partnerIso3 ?? p.partnerName.slice(0, 10)}</text></> : null}
          </g>;
        })}

        {layers.storms && data?.storms.filter((s) => facing(s.lon, s.lat)).map((s) => {
          const [x, y] = pt(s.lon, s.lat);
          const f = makeFeature({ id: `storm-${s.id}`, kind: "live", title: `${s.classification} ${s.name}`, value: s.intensityKt != null ? `${s.intensityKt} kt sustained winds` : "Intensity not reported", meta: `${s.movement ?? "Movement not reported"}${s.distanceKm != null ? ` · ${s.distanceKm.toLocaleString()} km from ${countryName}` : ""}`, evidenceCount: 1, provenance: `NOAA National Hurricane Center · U.S. public domain${s.advisoryAt ? ` · advisory ${new Date(s.advisoryAt).toLocaleString()}` : ""} · live context`, signal: "The current centre of an active tropical system from the latest official advisory.", trend: s.movement ? `Moving ${s.movement}. Use the official NHC cone for forecast track; this marker is the current position only.` : "Current position only; consult the official NHC forecast cone.", forecast: "Official forecast tracks and cones are published by NOAA NHC; GDPVision does not generate storm forecasts.", impact: s.distanceKm != null && s.distanceKm < 1000 ? "Within 1,000 km — tourism, ports, insurance and fiscal contingency exposure should be reviewed now." : "Outside the immediate vicinity; monitor for track changes." });
          return <g key={f.id} {...interaction(f)}><circle cx={x} cy={y} r="2.4" className="fill-transparent" /><circle cx={x} cy={y} r="1.6" className="fill-paper-0 stroke-signal-negative" strokeWidth="0.35" /><path d={`M ${x - 1} ${y} a 1 1 0 0 1 2 0 M ${x + 1} ${y} a 1 1 0 0 1 -2 0`} className="fill-none stroke-signal-negative" strokeWidth="0.3" transform={`rotate(35 ${x} ${y})`} /><text x={x + 2} y={y + 0.5} className="fill-ink-950 font-mono text-[1.6px]">{s.name}</text></g>;
        })}

        {facing(center.lon, center.lat) ? <g {...interaction(makeFeature({ id: "globe-country", kind: "place", title: countryName, value: "Selected country", meta: `${center.lat.toFixed(2)}°, ${center.lon.toFixed(2)}° · dotted box marks the Caribbean basin` }))}>
          <circle cx={home[0]} cy={home[1]} r="2.6" className="fill-none stroke-gold-500" strokeWidth="0.35" />
          <circle cx={home[0]} cy={home[1]} r="1" className="fill-gold-500 stroke-ink-950" strokeWidth="0.3" />
          <text x={home[0] + 3} y={home[1] + 0.6} className="fill-ink-950 font-mono text-[1.9px]">{countryName}</text>
        </g> : null}
      </svg>

      <div className="absolute right-4 top-4 z-20 flex flex-col border border-line-200 bg-paper-0/95 shadow-sm" role="group" aria-label="Globe controls">
        <button type="button" className="btn-ghost h-9 w-9 justify-center p-0" aria-label="Zoom in" title="Zoom in" onClick={() => setZoom((z) => Math.min(6, z * 1.3))}><Plus className="h-4 w-4" /></button>
        <button type="button" className="btn-ghost h-9 w-9 justify-center border-t border-line-200 p-0" aria-label="Zoom out" title="Zoom out" onClick={() => setZoom((z) => Math.max(0.8, z / 1.3))}><Minus className="h-4 w-4" /></button>
        <button type="button" className="btn-ghost h-9 w-9 justify-center border-t border-line-200 p-0" aria-label="Return to island" title="Return to island" onClick={() => { setRotate([-center.lon, -center.lat]); setZoom(1); }}><Crosshair className="h-4 w-4" /></button>
        <span className="border-t border-line-200 py-1 text-center font-mono text-[10px] tabular-nums text-ink-500">{Math.round(zoom * 100)}%</span>
      </div>

      <div className="absolute left-5 top-40 z-20 w-56 border border-line-200 bg-paper-0/95 p-3 shadow-sm" role="group" aria-label="Globe layers">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">Globe layers</p>
        <ul className="mt-2 space-y-1">
          {toggles.map((t) => (
            <li key={t.key}>
              <button type="button" role="switch" aria-checked={layers[t.key]} onClick={() => setLayers((l) => ({ ...l, [t.key]: !l[t.key] }))} className="btn-ghost min-h-8 w-full justify-between border-0 px-1 text-left text-[11px] text-ink-700">
                <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full border border-ink-700 ${layers[t.key] ? "bg-ink-950" : "bg-paper-0"}`} />{t.label}</span>
                <span className="font-mono text-[9px] text-ink-500">{t.note}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] leading-snug text-ink-500">Live public-domain feeds (NOAA, USGS). Reference context only — not saved as evidence.</p>
      </div>
    </>
  );
}
