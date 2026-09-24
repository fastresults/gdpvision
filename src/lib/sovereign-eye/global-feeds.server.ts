// Public-domain global hazard feeds for the Sovereign Eye globe.
// NOAA NHC (active cyclones) and USGS (earthquakes). Live context only —
// never written to the corpus.
import { assertPublicHttpUrl } from "@/lib/net/safe-url";

export type GlobalStorm = { id: string; name: string; classification: string; intensityKt: number | null; pressureMb: number | null; lat: number; lon: number; movement: string | null; advisoryAt: string | null; distanceKm: number | null };
export type GlobalQuake = { id: string; place: string; magnitude: number; lat: number; lon: number; time: string; distanceKm: number | null };
export type FeedStatus = { ok: boolean; source: string; licence: string; checkedAt: string; error?: string };
export type GlobalHazards = { storms: GlobalStorm[]; quakes: GlobalQuake[]; status: { storms: FeedStatus; quakes: FeedStatus } };

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();

async function fetchJson(url: string, ttlMs: number): Promise<unknown> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const safe = assertPublicHttpUrl(url);
  const res = await fetch(safe.toString(), { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json", "User-Agent": "GDPVision Sovereign Eye" } });
  if (!res.ok) throw new Error(`Feed returned ${res.status}`);
  const value = await res.json();
  cache.set(url, { at: Date.now(), value });
  return value;
}

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export async function loadGlobalHazards(center: { lat: number; lon: number } | null): Promise<GlobalHazards> {
  const checkedAt = new Date().toISOString();
  const dist = (lat: number, lon: number) => (center ? Math.round(distanceKm(center.lat, center.lon, lat, lon)) : null);
  const [stormRes, quakeRes] = await Promise.allSettled([
    fetchJson("https://www.nhc.noaa.gov/CurrentStorms.json", 5 * 60_000),
    fetchJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson", 15 * 60_000),
  ]);

  const storms: GlobalStorm[] = [];
  if (stormRes.status === "fulfilled") {
    const list = (stormRes.value as { activeStorms?: any[] })?.activeStorms ?? [];
    for (const s of list) {
      const lat = Number(s.latitudeNumeric); const lon = Number(s.longitudeNumeric);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      storms.push({
        id: String(s.id ?? s.binNumber ?? s.name), name: String(s.name ?? "Unnamed system"), classification: String(s.classification ?? "Tropical system"),
        intensityKt: Number.isFinite(Number(s.intensity)) ? Number(s.intensity) : null, pressureMb: Number.isFinite(Number(s.pressure)) ? Number(s.pressure) : null,
        lat, lon, movement: s.movementDir != null && s.movementSpeed != null ? `${s.movementDir}° at ${s.movementSpeed} mph` : null,
        advisoryAt: s.lastUpdate ? String(s.lastUpdate) : null, distanceKm: dist(lat, lon),
      });
    }
  }

  const quakes: GlobalQuake[] = [];
  if (quakeRes.status === "fulfilled") {
    const features = (quakeRes.value as { features?: any[] })?.features ?? [];
    for (const f of features.slice(0, 250)) {
      const [lon, lat] = f?.geometry?.coordinates ?? [];
      const mag = Number(f?.properties?.mag);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(mag)) continue;
      quakes.push({ id: String(f.id), place: String(f.properties.place ?? "Unlocated"), magnitude: mag, lat, lon, time: new Date(Number(f.properties.time)).toISOString(), distanceKm: dist(lat, lon) });
    }
  }

  const status = (r: PromiseSettledResult<unknown>, source: string, licence: string): FeedStatus =>
    r.status === "fulfilled" ? { ok: true, source, licence, checkedAt } : { ok: false, source, licence, checkedAt, error: String((r.reason as Error)?.message ?? r.reason) };
  return {
    storms, quakes,
    status: {
      storms: status(stormRes, "NOAA National Hurricane Center", "U.S. public domain"),
      quakes: status(quakeRes, "USGS Earthquake Hazards Program (M4.5+, 7 days)", "U.S. public domain"),
    },
  };
}
