import type { SovereignEyeFlow, SovereignEyeLayer } from "@/lib/sovereign-eye.functions";

type GeoPoint = { code: string; name: string; lat: number; lon: number };

const POINTS: GeoPoint[] = [
  { code: "BHS", name: "The Bahamas", lat: 25.0343, lon: -77.3963 },
  { code: "BLZ", name: "Belize", lat: 17.1899, lon: -88.4976 },
  { code: "JAM", name: "Jamaica", lat: 18.1096, lon: -77.2975 },
  { code: "HTI", name: "Haiti", lat: 18.9712, lon: -72.2852 },
  { code: "KNA", name: "St. Kitts & Nevis", lat: 17.3578, lon: -62.783 },
  { code: "AIA", name: "Anguilla", lat: 18.2206, lon: -63.0686 },
  { code: "DMA", name: "Dominica", lat: 15.415, lon: -61.371 },
  { code: "LCA", name: "Saint Lucia", lat: 13.9094, lon: -60.9789 },
  { code: "VCT", name: "St. Vincent", lat: 13.2528, lon: -61.1971 },
  { code: "GRD", name: "Grenada", lat: 12.1165, lon: -61.679 },
  { code: "BRB", name: "Barbados", lat: 13.1939, lon: -59.5432 },
  { code: "TTO", name: "Trinidad & Tobago", lat: 10.6918, lon: -61.2225 },
  { code: "GUY", name: "Guyana", lat: 6.8013, lon: -58.1551 },
  { code: "SUR", name: "Suriname", lat: 5.852, lon: -55.2038 },
  { code: "BMU", name: "Bermuda", lat: 32.3078, lon: -64.7505 },
];

const BOUNDS = { minLon: -90, maxLon: -54, minLat: 4, maxLat: 34 };

function project(lon: number, lat: number) {
  const x = ((lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * 100;
  const y = 100 - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return { x, y };
}

function flowEndpoint(index: number) {
  const anchors = [
    { x: 8, y: 18 },
    { x: 18, y: 72 },
    { x: 82, y: 16 },
    { x: 92, y: 78 },
    { x: 46, y: 8 },
    { x: 58, y: 92 },
  ];
  return anchors[index % anchors.length];
}

export function RegionMap({
  code,
  countryName,
  layers,
  flows,
  activeLayerId,
}: {
  code: string;
  countryName: string;
  layers: SovereignEyeLayer[];
  flows: SovereignEyeFlow[];
  activeLayerId: string;
}) {
  const selected = POINTS.find((p) => p.code === code.toUpperCase()) ?? POINTS.find((p) => p.code === "KNA");
  const origin = selected ? project(selected.lon, selected.lat) : { x: 72, y: 54 };
  const active = layers.find((l) => l.id === activeLayerId) ?? layers[0];
  const showFlows = active?.kind === "capital" || layers.some((l) => l.id === "capital-currents" && l.visible);
  const topFlows = flows.slice(0, 6);

  return (
    <section className="relative overflow-hidden border border-ink-950 bg-paper-0">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gold-500" />
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-h-[520px] border-b border-line-200 bg-paper-50 lg:border-b-0 lg:border-r">
          <svg viewBox="0 0 100 100" role="img" aria-label={`${countryName} sovereign intelligence map`} className="absolute inset-0 h-full w-full">
            <defs>
              <pattern id="eye-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" className="stroke-line-200" fill="none" strokeWidth="0.16" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#eye-grid)" className="text-line-200" />
            <path d="M 8 62 C 28 44, 38 40, 58 43 S 86 41, 94 26" className="fill-none stroke-ink-300" strokeWidth="0.45" strokeDasharray="1.2 1.4" />
            <path d="M 4 74 C 21 69, 33 63, 49 69 S 72 81, 95 69" className="fill-none stroke-ink-300" strokeWidth="0.35" strokeDasharray="0.8 1.2" />
            {showFlows &&
              topFlows.map((flow, index) => {
                const end = flowEndpoint(index);
                const weight = Math.max(0.35, Math.min(1.8, flow.valueUsdM / 250));
                return (
                  <g key={flow.nodeKey}>
                    <path
                      d={`M ${origin.x} ${origin.y} C ${(origin.x + end.x) / 2} ${origin.y - 18 + index * 5}, ${(origin.x + end.x) / 2} ${end.y + 14 - index * 2}, ${end.x} ${end.y}`}
                      className={flow.side === "input" ? "fill-none stroke-signal-positive" : "fill-none stroke-signal-caution"}
                      strokeWidth={weight}
                      strokeLinecap="round"
                      opacity="0.7"
                    />
                    <circle cx={end.x} cy={end.y} r="1.2" className={flow.side === "input" ? "fill-signal-positive" : "fill-signal-caution"} />
                  </g>
                );
              })}
            {POINTS.map((point) => {
              const p = project(point.lon, point.lat);
              const isSelected = point.code === code.toUpperCase();
              return (
                <g key={point.code}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? 2.2 : 0.85}
                    className={isSelected ? "fill-gold-500 stroke-ink-950" : "fill-paper-0 stroke-ink-500"}
                    strokeWidth={isSelected ? 0.5 : 0.3}
                  />
                  {isSelected && <circle cx={p.x} cy={p.y} r="5.2" className="fill-none stroke-gold-500 animate-pulse" strokeWidth="0.45" />}
                  {isSelected || ["BHS", "JAM", "TTO", "GUY", "BRB"].includes(point.code) ? (
                    <text x={p.x + 1.6} y={p.y - 1.5} className="fill-ink-700 font-mono text-[2.2px] uppercase">
                      {point.code}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          <div className="absolute left-5 top-5 max-w-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Sovereign theatre</p>
            <h2 className="mt-2 font-serif text-4xl leading-tight text-ink-950">{countryName}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{active?.narrative ?? "Choose a layer to inspect the map."}</p>
          </div>
          <div className="absolute bottom-5 left-5 right-5 grid gap-2 sm:grid-cols-3">
            {layers.slice(0, 3).map((layer) => (
              <div key={layer.id} className="border border-line-200 bg-paper-0/90 p-3 backdrop-blur">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">{layer.label}</p>
                <p className="mt-1 font-serif text-2xl text-ink-950" data-numeric>{layer.strength == null ? "—" : `${layer.strength.toFixed(2)}`}</p>
              </div>
            ))}
          </div>
        </div>
        <aside className="bg-paper-0 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Active layer</p>
          <h3 className="mt-2 font-serif text-2xl text-ink-950">{active?.label ?? "Map"}</h3>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="border border-line-200 p-3">
              <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">Status</dt>
              <dd className="mt-1 capitalize text-ink-950">{active?.status ?? "—"}</dd>
            </div>
            <div className="border border-line-200 p-3">
              <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">Evidence</dt>
              <dd className="mt-1 text-ink-950" data-numeric>{active?.evidenceCount ?? 0}</dd>
            </div>
            <div className="border border-line-200 p-3">
              <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">Public</dt>
              <dd className="mt-1 text-ink-950" data-numeric>{active?.visibility.public ?? 0}</dd>
            </div>
            <div className="border border-line-200 p-3">
              <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">Private</dt>
              <dd className="mt-1 text-ink-950" data-numeric>{active?.visibility.private ?? 0}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}