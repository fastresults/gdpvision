import { ChevronDown, CloudSun, Database, GripVertical, Landmark, ListTree, Radio, Waves } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { SovereignEyeEvidence, SovereignEyeFlow, SovereignEyeKpi, SovereignEyeLayer, SovereignEyeLiveFeed, SovereignEyeSector } from "@/lib/sovereign-eye.functions";

type GeoPoint = { code: string; name: string; lat: number; lon: number };
export type MapFeature = { id: string; kind: SovereignEyeLayer["kind"] | "place"; title: string; value: string; meta: string; visibility?: "public" | "private"; evidenceCount?: number };

const POINTS: GeoPoint[] = [
  { code: "BHS", name: "The Bahamas", lat: 25.0343, lon: -77.3963 }, { code: "BLZ", name: "Belize", lat: 17.1899, lon: -88.4976 },
  { code: "JAM", name: "Jamaica", lat: 18.1096, lon: -77.2975 }, { code: "HTI", name: "Haiti", lat: 18.9712, lon: -72.2852 },
  { code: "KNA", name: "St. Kitts & Nevis", lat: 17.3578, lon: -62.783 }, { code: "AIA", name: "Anguilla", lat: 18.2206, lon: -63.0686 },
  { code: "ATG", name: "Antigua & Barbuda", lat: 17.0608, lon: -61.7964 }, { code: "DMA", name: "Dominica", lat: 15.415, lon: -61.371 },
  { code: "LCA", name: "Saint Lucia", lat: 13.9094, lon: -60.9789 }, { code: "VCT", name: "St. Vincent", lat: 13.2528, lon: -61.1971 },
  { code: "GRD", name: "Grenada", lat: 12.1165, lon: -61.679 }, { code: "BRB", name: "Barbados", lat: 13.1939, lon: -59.5432 },
  { code: "TTO", name: "Trinidad & Tobago", lat: 10.6918, lon: -61.2225 }, { code: "GUY", name: "Guyana", lat: 6.8013, lon: -58.1551 },
  { code: "SUR", name: "Suriname", lat: 5.852, lon: -55.2038 }, { code: "BMU", name: "Bermuda", lat: 32.3078, lon: -64.7505 },
];
const BOUNDS = { minLon: -90, maxLon: -54, minLat: 4, maxLat: 34 };
const project = (lon: number, lat: number) => ({ x: ((lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * 100, y: 100 - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100 });
const anchors = [{ x: 8, y: 18 }, { x: 18, y: 72 }, { x: 82, y: 16 }, { x: 92, y: 78 }, { x: 46, y: 8 }, { x: 58, y: 92 }];
const ringPoint = (origin: { x: number; y: number }, index: number, total: number, radius: number) => { const angle = (Math.PI * 2 * index) / Math.max(total, 1) - Math.PI / 2; return { x: origin.x + Math.cos(angle) * radius, y: origin.y + Math.sin(angle) * radius }; };
const fmt = (n: number | null, unit = "") => n == null ? "Not available" : `${n.toFixed(2)}${unit ? ` ${unit}` : ""}`;
const LEGEND_POSITION_KEY = "sovereign-eye-legend-position";
const LEGEND_OPEN_KEY = "sovereign-eye-legend-open";
const LEGEND_MARGIN = 16;
type LegendPosition = { x: number; y: number };
type ElementSize = { width: number; height: number };

export function RegionMap({ code, countryName, layers, flows = [], kpis = [], sectors = [], evidence = { sources: [], memory: [] }, live, focusedLayerId, pinnedFeature, onPin, onEvidence }: {
  code: string; countryName: string; layers: SovereignEyeLayer[]; flows?: SovereignEyeFlow[]; kpis?: SovereignEyeKpi[]; sectors?: SovereignEyeSector[];
  evidence?: SovereignEyeEvidence; live?: SovereignEyeLiveFeed; focusedLayerId: string; pinnedFeature?: MapFeature | null; onPin?: (feature: MapFeature | null) => void; onEvidence?: () => void;
}) {
  const [hovered, setHovered] = useState<MapFeature | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [legendPosition, setLegendPosition] = useState<LegendPosition>({ x: 1, y: 0 });
  const [legendPreferencesLoaded, setLegendPreferencesLoaded] = useState(false);
  const [mapSize, setMapSize] = useState<ElementSize>({ width: 0, height: 0 });
  const [legendSize, setLegendSize] = useState<ElementSize>({ width: 0, height: 0 });
  const mapRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const legendToggleRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originLeft: number; originTop: number } | null>(null);
  const selected = POINTS.find((p) => p.code === code.toUpperCase()) ?? POINTS.find((p) => p.code === "KNA");
  const origin = selected ? project(selected.lon, selected.lat) : { x: 72, y: 54 };
  const active = layers.find((l) => l.id === focusedLayerId) ?? layers.find((l) => l.visible) ?? layers[0];
  const visibleKinds = new Set(layers.filter((l) => l.visible).map((l) => l.kind));
  const inspected = pinnedFeature ?? hovered;
  const legend = useMemo(() => [
    { show: true, symbol: "selected", label: "Selected country" },
    { show: visibleKinds.has("macro"), symbol: "macro", label: "Macro indicator" },
    { show: visibleKinds.has("sector"), symbol: "sector", label: "Sector · size = GDP share" },
    { show: visibleKinds.has("capital"), symbol: "input", label: "Inbound capital" },
    { show: visibleKinds.has("capital"), symbol: "output", label: "Outbound capital" },
    { show: visibleKinds.has("capital"), symbol: "width", label: "Line width = relative value" },
    { show: visibleKinds.has("capital") && flows.some((flow) => flow.confidence !== "A"), symbol: "confidence", label: "Dashed = confidence B–D" },
    { show: visibleKinds.has("ministry"), symbol: "ministry", label: "Ministry coverage" },
    { show: visibleKinds.has("corpus"), symbol: "public", label: "Public evidence" },
    { show: visibleKinds.has("corpus") && layers.some((l) => l.kind === "corpus" && l.visibility.private > 0), symbol: "private", label: "Private evidence" },
    { show: visibleKinds.has("live"), symbol: "live", label: "Live public feed" },
  ].filter((item) => item.show), [layers, visibleKinds]);

  useEffect(() => {
    try {
      const savedPosition = window.localStorage.getItem(LEGEND_POSITION_KEY);
      const savedOpen = window.localStorage.getItem(LEGEND_OPEN_KEY);
      if (savedPosition) {
        const parsed = JSON.parse(savedPosition) as Partial<LegendPosition>;
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setLegendPosition({ x: Math.max(0, Math.min(1, parsed.x)), y: Math.max(0, Math.min(1, parsed.y)) });
        }
      }
      if (savedOpen === "true" || savedOpen === "false") setLegendOpen(savedOpen === "true");
    } catch {
      setLegendPosition({ x: 1, y: 0 });
    } finally {
      setLegendPreferencesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!legendPreferencesLoaded) return;
    window.localStorage.setItem(LEGEND_POSITION_KEY, JSON.stringify(legendPosition));
    window.localStorage.setItem(LEGEND_OPEN_KEY, String(legendOpen));
  }, [legendOpen, legendPosition, legendPreferencesLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    const legendNode = legendRef.current;
    if (!map || !legendNode) return;
    const measure = () => {
      setMapSize({ width: map.clientWidth, height: map.clientHeight });
      setLegendSize({ width: legendNode.offsetWidth, height: legendNode.offsetHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(map);
    observer.observe(legendNode);
    return () => observer.disconnect();
  }, [legendOpen]);

  useEffect(() => {
    if (!legendOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setLegendOpen(false);
      window.requestAnimationFrame(() => legendToggleRef.current?.focus());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [legendOpen]);

  const availableX = Math.max(0, mapSize.width - legendSize.width - LEGEND_MARGIN * 2);
  const availableY = Math.max(0, mapSize.height - legendSize.height - LEGEND_MARGIN * 2);
  const legendLeft = LEGEND_MARGIN + legendPosition.x * availableX;
  const legendTop = LEGEND_MARGIN + legendPosition.y * availableY;

  function beginLegendDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (legendOpen) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originLeft: legendLeft, originTop: legendTop };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveLegend(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextLeft = Math.max(LEGEND_MARGIN, Math.min(LEGEND_MARGIN + availableX, drag.originLeft + event.clientX - drag.startX));
    const nextTop = Math.max(LEGEND_MARGIN, Math.min(LEGEND_MARGIN + availableY, drag.originTop + event.clientY - drag.startY));
    setLegendPosition({ x: availableX > 0 ? (nextLeft - LEGEND_MARGIN) / availableX : 0, y: availableY > 0 ? (nextTop - LEGEND_MARGIN) / availableY : 0 });
  }

  function endLegendDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function interaction(feature: MapFeature) {
    return {
      tabIndex: 0,
      role: "button" as const,
      "aria-label": `${feature.title}: ${feature.value}. ${feature.meta}`,
      onMouseEnter: () => setHovered(feature),
      onMouseLeave: () => setHovered(null),
      onFocus: () => setHovered(feature),
      onBlur: () => setHovered(null),
      onClick: () => onPin?.(pinnedFeature?.id === feature.id ? null : feature),
      onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPin?.(pinnedFeature?.id === feature.id ? null : feature); } },
      className: "cursor-pointer outline-none",
    };
  }

  return (
    <section className="relative overflow-hidden border border-ink-950 bg-paper-0">
      <div className="absolute inset-x-0 top-0 z-20 h-[3px] bg-gold-500" />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <div ref={mapRef} className="relative min-h-[620px] overflow-hidden border-b border-line-200 bg-paper-50 lg:border-b-0 lg:border-r">
          <svg viewBox="0 0 100 100" role="img" aria-label={`${countryName} sovereign intelligence map`} className="absolute inset-0 h-full w-full">
            <defs><pattern id="eye-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" className="stroke-line-200" fill="none" strokeWidth="0.16" /></pattern></defs>
            <rect width="100" height="100" fill="url(#eye-grid)" />
            {layers.filter((layer) => layer.visible && (
              (layer.kind === "macro" && kpis.length === 0) ||
              (layer.kind === "sector" && sectors.length === 0) ||
              (layer.kind === "capital" && flows.length === 0) ||
              (layer.kind === "ministry" && sectors.length === 0) ||
              (layer.kind === "corpus" && evidence.sources.length + evidence.memory.length === 0) ||
              (layer.kind === "live" && !live)
            )).map((layer, index, all) => {
              const p = ringPoint(origin, index, all.length, 14);
              const feature: MapFeature = { id: `summary-${layer.id}`, kind: layer.kind, title: layer.label, value: layer.evidenceCount ? `${layer.evidenceCount} evidence records` : "No mapped records", meta: `${layer.status} · layer strength ${layer.strength?.toFixed(2) ?? "not available"}`, evidenceCount: layer.evidenceCount };
              return <g key={feature.id} {...interaction(feature)}><circle cx={p.x} cy={p.y} r="2.2" className="fill-paper-0 stroke-ink-950" strokeWidth="0.6" /><text x={p.x + 3} y={p.y + 0.7} className="fill-ink-800 font-mono text-[1.7px]">{layer.label}</text></g>;
            })}

            {visibleKinds.has("capital") && flows.slice(0, 6).map((flow, index) => {
              const end = anchors[index % anchors.length]; const weight = Math.max(0.45, Math.min(1.8, flow.valueUsdM / 250));
              const feature: MapFeature = { id: `flow-${flow.nodeKey}-${index}`, kind: "capital", title: flow.label, value: `US$${flow.valueUsdM.toFixed(2)}m`, meta: `${flow.side === "input" ? "Inbound" : "Outbound"} · ${flow.period} · confidence ${flow.confidence}`, visibility: flow.visibility, evidenceCount: 1 };
              return <g key={feature.id} {...interaction(feature)}>
                <path d={`M ${origin.x} ${origin.y} C ${(origin.x + end.x) / 2} ${origin.y - 18 + index * 5}, ${(origin.x + end.x) / 2} ${end.y + 14 - index * 2}, ${end.x} ${end.y}`} className={flow.side === "input" ? "fill-none stroke-signal-positive" : "fill-none stroke-signal-caution"} strokeWidth={weight} strokeLinecap="round" strokeDasharray={flow.confidence === "A" ? undefined : "1.4 1"} opacity={hovered?.id === feature.id || pinnedFeature?.id === feature.id ? 1 : 0.72} />
                <path d={`M ${origin.x} ${origin.y} C ${(origin.x + end.x) / 2} ${origin.y - 18 + index * 5}, ${(origin.x + end.x) / 2} ${end.y + 14 - index * 2}, ${end.x} ${end.y}`} className="fill-none stroke-transparent" strokeWidth="4" />
                <circle cx={end.x} cy={end.y} r="1.4" className={flow.side === "input" ? "fill-signal-positive" : "fill-signal-caution"} />
                <text x={end.x + 2} y={end.y - 1} className="fill-ink-700 font-mono text-[1.8px]">{flow.label.slice(0, 18)}</text>
              </g>;
            })}

            {visibleKinds.has("sector") && sectors.slice(0, 6).map((sector, index) => { const p = ringPoint(origin, index, Math.min(sectors.length, 6), 13); const feature: MapFeature = { id: `sector-${sector.code}`, kind: "sector", title: sector.label, value: `${sector.share.toFixed(2)}% of GDP`, meta: `Confidence grade ${sector.grade} · ${sector.ministers.length} ministry links`, evidenceCount: 1 }; return <g key={feature.id} {...interaction(feature)}><line x1={origin.x} y1={origin.y} x2={p.x} y2={p.y} className="stroke-gold-300" strokeWidth="0.35" /><circle cx={p.x} cy={p.y} r="4" className="fill-transparent" /><circle cx={p.x} cy={p.y} r={Math.max(1.4, Math.min(3.5, sector.share / 5))} className="fill-gold-500 stroke-paper-0" strokeWidth="0.5" /><text x={p.x + 2} y={p.y - 1.8} className="fill-ink-700 font-mono text-[1.65px]">{sector.label.slice(0, 16)}</text></g>; })}

            {visibleKinds.has("macro") && kpis.slice(0, 4).map((kpi, index) => { const p = ringPoint(origin, index, 4, 7.5); const feature: MapFeature = { id: `kpi-${kpi.code}`, kind: "macro", title: kpi.label, value: fmt(kpi.value, kpi.unit), meta: `${kpi.period ?? "No period"} · ${kpi.visibility} evidence · ${kpi.provenance}`, visibility: kpi.visibility, evidenceCount: 1 }; return <g key={feature.id} {...interaction(feature)}><circle cx={p.x} cy={p.y} r="4" className="fill-transparent" /><circle cx={p.x} cy={p.y} r="1.5" className="fill-ink-950 stroke-paper-0" strokeWidth="0.45" /><text x={p.x + 2} y={p.y + 0.7} className="fill-ink-800 font-mono text-[1.55px]">{kpi.label.slice(0, 14)}</text></g>; })}

            {visibleKinds.has("ministry") && sectors.flatMap((sector) => sector.ministers).filter((m, i, all) => all.findIndex((x) => x.name === m.name) === i).slice(0, 5).map((ministry, index, all) => { const p = ringPoint(origin, index, all.length, 20); const feature: MapFeature = { id: `ministry-${index}`, kind: "ministry", title: ministry.name, value: ministry.minister ?? "Minister not resolved", meta: ministry.minister ? "Named minister profile available" : "Coverage gap", evidenceCount: 1 }; return <g key={feature.id} {...interaction(feature)}><rect x={p.x - 1.4} y={p.y - 1.4} width="2.8" height="2.8" className={ministry.minister ? "fill-ink-700" : "fill-paper-0 stroke-ink-500"} strokeWidth="0.4" /><text x={p.x + 2} y={p.y + 0.6} className="fill-ink-700 font-mono text-[1.55px]">{ministry.name.slice(0, 16)}</text></g>; })}

            {visibleKinds.has("corpus") && [...evidence.sources.map((x) => ({ title: x.title, visibility: x.visibility, kind: x.kind })), ...evidence.memory.map((x) => ({ title: x.title, visibility: x.visibility, kind: x.kind }))].slice(0, 7).map((item, index, all) => { const p = ringPoint(origin, index, all.length, 27); const feature: MapFeature = { id: `evidence-${index}-${item.title}`, kind: "corpus", title: item.title, value: item.visibility === "private" ? "Private evidence" : "Public evidence", meta: item.kind, visibility: item.visibility, evidenceCount: 1 }; const points = `${p.x},${p.y - 1.8} ${p.x + 1.8},${p.y} ${p.x},${p.y + 1.8} ${p.x - 1.8},${p.y}`; return <g key={feature.id} {...interaction(feature)}><polygon points={points} className={item.visibility === "private" ? "fill-narrative-500" : "fill-paper-0 stroke-ink-700"} strokeWidth="0.45" /></g>; })}

            {visibleKinds.has("live") && live ? <>
              <g {...interaction({ id: "live-weather", kind: "live", title: "Current weather", value: live.weather.summary, meta: `Wind ${fmt(live.weather.windKph, "km/h")} · precipitation ${fmt(live.weather.precipitationMm, "mm")}`, evidenceCount: 1 })}><circle cx={origin.x - 5} cy={origin.y - 5} r="2.1" className="fill-paper-0 stroke-signal-positive" strokeWidth="0.6" /><path d={`M ${origin.x - 6.4} ${origin.y - 5} h 2.8 M ${origin.x - 5} ${origin.y - 6.4} v 2.8`} className="stroke-signal-positive" strokeWidth="0.45" /></g>
              <g {...interaction({ id: "live-seismic", kind: "live", title: "Regional seismic activity", value: `${live.earthquakes.count7d} events`, meta: `Strongest magnitude ${live.earthquakes.strongestMagnitude?.toFixed(2) ?? "—"} · past 7 days`, evidenceCount: 1 })}><circle cx={origin.x + 5} cy={origin.y - 5} r="2.1" className="fill-paper-0 stroke-signal-caution" strokeWidth="0.6" /><circle cx={origin.x + 5} cy={origin.y - 5} r="0.7" className="fill-signal-caution" /></g>
            </> : null}

            {POINTS.map((point) => { const p = project(point.lon, point.lat); const isSelected = point.code === code.toUpperCase(); const feature: MapFeature = { id: `place-${point.code}`, kind: "place", title: point.name, value: isSelected ? "Selected country" : "Regional comparator", meta: `${point.lat.toFixed(2)}°, ${point.lon.toFixed(2)}°` }; return <g key={point.code} {...interaction(feature)}><circle cx={p.x} cy={p.y} r="3.8" className="fill-transparent" /><circle cx={p.x} cy={p.y} r={isSelected ? 2.3 : 0.9} className={isSelected ? "fill-gold-500 stroke-ink-950" : "fill-paper-0 stroke-ink-500"} strokeWidth={isSelected ? 0.55 : 0.3} /><text x={p.x + 1.8} y={p.y - 1.4} className={isSelected ? "fill-ink-950 font-mono text-[2px]" : "fill-ink-600 font-mono text-[1.7px]"}>{isSelected ? point.name : point.code}</text></g>; })}
          </svg>

          <div className="pointer-events-none absolute left-5 top-5 max-w-[min(25rem,70%)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Sovereign theatre</p>
            <h2 className="mt-2 font-serif text-3xl leading-tight text-ink-950 sm:text-4xl">{countryName}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{active?.narrative ?? "Turn on a layer to begin."}</p>
          </div>

          {inspected ? <div className="absolute bottom-5 left-5 z-10 w-[min(25rem,calc(100%-2.5rem))] border border-ink-950 bg-paper-0 p-4" aria-live="polite">
            <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">{pinnedFeature?.id === inspected.id ? "Pinned inspection" : "Map preview"}</p><h3 className="mt-1 font-serif text-xl text-ink-950">{inspected.title}</h3></div>{pinnedFeature?.id === inspected.id ? <button type="button" className="btn-ghost h-8 px-2 text-[10px]" onClick={() => onPin?.(null)}>Close</button> : null}</div>
            <p className="mt-2 text-sm font-medium text-ink-950">{inspected.value}</p><p className="mt-1 text-xs leading-relaxed text-ink-600">{inspected.meta}</p>
            {onEvidence && inspected.kind !== "place" && <button type="button" className="btn-secondary mt-3 min-h-8 px-3 text-[10px]" onClick={onEvidence}>View supporting evidence</button>}
          </div> : null}

          <div
            ref={legendRef}
            className={`absolute z-20 max-w-[calc(100%-2rem)] border border-line-200 bg-paper-0/95 shadow-sm backdrop-blur ${legendOpen ? "w-64" : "w-36"}`}
            style={{ left: legendLeft, top: legendTop }}
          >
            <div className="flex min-h-10 items-stretch">
              {!legendOpen ? (
                <button
                  type="button"
                  className="btn-ghost w-9 shrink-0 touch-none cursor-move border-y-0 border-l-0 px-0"
                  aria-label="Move legend"
                  onPointerDown={beginLegendDrag}
                  onPointerMove={moveLegend}
                  onPointerUp={endLegendDrag}
                  onPointerCancel={endLegendDrag}
                >
                  <GripVertical size={15} aria-hidden />
                </button>
              ) : null}
              <button
                ref={legendToggleRef}
                type="button"
                className="btn-ghost flex min-h-10 min-w-0 flex-1 justify-between border-0 px-3 text-[10px]"
                onClick={() => setLegendOpen((value) => !value)}
                aria-expanded={legendOpen}
                aria-controls="sovereign-eye-map-legend"
              >
                <span className="flex items-center gap-2"><ListTree size={14} aria-hidden /> Legend</span>
                <ChevronDown size={14} aria-hidden className={legendOpen ? "rotate-180" : ""} />
              </button>
            </div>
            {legendOpen ? (
              <div id="sovereign-eye-map-legend" className="border-t border-line-200 p-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">Visible layers</p>
                <ul className="mt-3 space-y-2">{legend.map((item) => <li key={item.label} className="flex items-center gap-2 text-[11px] text-ink-700"><LegendMark symbol={item.symbol} /><span>{item.label}</span></li>)}</ul>
              </div>
            ) : null}
          </div>
          <div className="absolute bottom-3 right-4 font-mono text-[8px] uppercase tracking-[0.14em] text-ink-500">Caribbean orientation · schematic projection</div>
        </div>

        <aside className="bg-paper-0 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Focused layer</p>
          <h3 className="mt-2 font-serif text-2xl text-ink-950">{active?.label ?? "No layer focused"}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">{active?.narrative ?? "Choose a visible layer in the controls."}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Display" value={active?.visible ? "On" : "Off"} /><Stat label="Status" value={active?.status ?? "—"} /><Stat label="Evidence" value={String(active?.evidenceCount ?? 0)} /><Stat label="Last update" value={active?.updatedAt ? new Date(active.updatedAt).toLocaleDateString() : "—"} />
          </dl>
          <div className="mt-5 border-t border-line-200 pt-4"><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">Evidence access</p><div className="mt-3 flex gap-4 text-xs text-ink-700"><span className="flex items-center gap-2"><span className="h-2 w-2 border border-ink-700 bg-paper-0" /> Public {active?.visibility.public ?? 0}</span><span className="flex items-center gap-2"><span className="h-2 w-2 bg-narrative-500" /> Private {active?.visibility.private ?? 0}</span></div></div>
          <div className="mt-5 border-t border-line-200 pt-4 text-xs leading-relaxed text-ink-500"><p className="flex items-center gap-2 text-ink-700"><Radio size={13} /> Hover or focus to preview</p><p className="mt-2">Click or tap any mark to pin its details.</p></div>
        </aside>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="border border-line-200 p-3"><dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">{label}</dt><dd className="mt-1 capitalize text-ink-950" data-numeric>{value}</dd></div>; }
function LegendMark({ symbol }: { symbol: string }) { if (symbol === "input" || symbol === "output") return <span className={`h-0 w-7 border-t-2 ${symbol === "input" ? "border-signal-positive" : "border-signal-caution"}`} />; if (symbol === "width") return <span className="flex w-7 flex-col gap-1"><span className="border-t border-ink-700" /><span className="border-t-[3px] border-ink-700" /></span>; if (symbol === "confidence") return <span className="w-7 border-t-2 border-dashed border-ink-700" />; if (symbol === "selected") return <span className="h-3 w-3 rounded-full border border-ink-950 bg-gold-500" />; if (symbol === "macro") return <span className="h-3 w-3 rounded-full bg-ink-950" />; if (symbol === "sector") return <span className="h-4 w-4 rounded-full bg-gold-500" />; if (symbol === "ministry") return <Landmark size={15} className="text-ink-700" />; if (symbol === "live") return <CloudSun size={15} className="text-signal-positive" />; if (symbol === "public") return <Database size={14} className="text-ink-700" />; if (symbol === "private") return <Database size={14} className="text-narrative-500" />; return <Waves size={15} />; }
