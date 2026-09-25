// Pure, deterministic rules that link a live hazard to the Caribbean nations
// it could affect. Exposure is proximity only — never a damage estimate.
import { CARIBBEAN_POINTS } from "./caribbean-geo";

export type ExposureGrade = "Direct" | "Near" | "Watch";
export type Exposure = { iso3: string; name: string; distanceKm: number; grade: ExposureGrade };

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Storm radii (km) scale with sustained wind (kt). Unknown intensity uses tropical-storm values. */
export function stormRadii(intensityKt: number | null) {
  const kt = intensityKt ?? 40;
  if (kt >= 96) return { direct: 250, near: 600, watch: 1200 }; // major hurricane
  if (kt >= 64) return { direct: 180, near: 450, watch: 1000 }; // hurricane
  return { direct: 120, near: 300, watch: 800 }; // tropical storm / depression
}

/** Quake radii (km) scale with magnitude; deep quakes (>70 km) are halved. */
export function quakeRadii(magnitude: number, depthKm: number | null) {
  const base = magnitude >= 7 ? 400 : magnitude >= 6 ? 200 : 100;
  const k = depthKm != null && depthKm > 70 ? 0.5 : 1;
  return { direct: base * 0.5 * k, near: base * k, watch: base * 2.5 * k };
}

export function exposureFor(lat: number, lon: number, radii: { direct: number; near: number; watch: number }): Exposure[] {
  const out: Exposure[] = [];
  for (const p of CARIBBEAN_POINTS) {
    const d = Math.round(distanceKm(lat, lon, p.lat, p.lon));
    const grade: ExposureGrade | null = d <= radii.direct ? "Direct" : d <= radii.near ? "Near" : d <= radii.watch ? "Watch" : null;
    if (grade) out.push({ iso3: p.code, name: p.name, distanceKm: d, grade });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm);
}
