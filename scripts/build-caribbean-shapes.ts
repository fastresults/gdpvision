// One-off: extract the 22 Caribbean nation outlines from world-atlas 10m into a
// small JSON file (rings of [lon,lat], 3-decimal precision).
import { feature } from "topojson-client";
import topo from "world-atlas/countries-10m.json";
import { writeFileSync } from "fs";

const NAMES: Record<string, string> = {
  BHS: "Bahamas", BLZ: "Belize", JAM: "Jamaica", HTI: "Haiti", KNA: "St. Kitts and Nevis", AIA: "Anguilla",
  ATG: "Antigua and Barb.", DMA: "Dominica", LCA: "Saint Lucia", VCT: "St. Vin. and Gren.", GRD: "Grenada",
  BRB: "Barbados", TTO: "Trinidad and Tobago", GUY: "Guyana", SUR: "Suriname", BMU: "Bermuda",
  CYM: "Cayman Is.", TCA: "Turks and Caicos Is.", VGB: "British Virgin Is.", MSR: "Montserrat",
};
const FRANCE_SPLIT: Record<string, [number, number, number, number]> = { GLP: [-61.9, 15.8, -60.9, 16.6], MTQ: [-61.3, 14.3, -60.8, 14.95] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fc = feature(topo as any, (topo as any).objects.countries) as any;
const polysOf = (g: any): number[][][][] => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
const simplify = (ring: number[][]) => {
  const out: number[][] = [];
  for (const [x, y] of ring) {
    const p = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
    const l = out[out.length - 1];
    if (!l || Math.abs(l[0] - p[0]) + Math.abs(l[1] - p[1]) >= 0.004) out.push(p);
  }
  return out.length >= 4 ? out : ring.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
};
const result: Record<string, number[][][]> = {};
for (const [code, name] of Object.entries(NAMES)) {
  const f = fc.features.find((x: any) => x.properties.name === name);
  if (!f) throw new Error(`missing ${name}`);
  result[code] = polysOf(f.geometry).map((poly) => simplify(poly[0]));
}
const france = fc.features.find((x: any) => x.properties.name === "France");
for (const [code, [x0, y0, x1, y1]] of Object.entries(FRANCE_SPLIT)) {
  result[code] = polysOf(france.geometry).map((p) => p[0]).filter((r) => r.every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)).map(simplify);
  if (!result[code].length) throw new Error(`no polygons for ${code}`);
}
writeFileSync("src/lib/sovereign-eye/caribbean-shapes.json", JSON.stringify(result));
console.log(Object.entries(result).map(([k, v]) => `${k}:${v.length}`).join(" "));
