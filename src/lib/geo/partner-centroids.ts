// ISO3 → geographic centroid for capital-flow partner geography.
// Client-safe reference data; no geocoding dependency. Covers the partners
// most commonly reported for CARICOM/OECS capital flows. Unknown partners
// simply render without a coordinate (listed, not mapped) — never guessed.

export type PartnerCentroid = { iso3: string; name: string; lat: number; lon: number };

const CENTROIDS: PartnerCentroid[] = [
  { iso3: "USA", name: "United States", lat: 39.8, lon: -98.6 },
  { iso3: "CAN", name: "Canada", lat: 56.1, lon: -106.3 },
  { iso3: "GBR", name: "United Kingdom", lat: 54.0, lon: -2.5 },
  { iso3: "IRL", name: "Ireland", lat: 53.2, lon: -8.2 },
  { iso3: "FRA", name: "France", lat: 46.6, lon: 2.4 },
  { iso3: "DEU", name: "Germany", lat: 51.1, lon: 10.4 },
  { iso3: "NLD", name: "Netherlands", lat: 52.2, lon: 5.3 },
  { iso3: "ESP", name: "Spain", lat: 40.2, lon: -3.6 },
  { iso3: "ITA", name: "Italy", lat: 42.8, lon: 12.8 },
  { iso3: "CHE", name: "Switzerland", lat: 46.8, lon: 8.2 },
  { iso3: "LUX", name: "Luxembourg", lat: 49.8, lon: 6.1 },
  { iso3: "BEL", name: "Belgium", lat: 50.6, lon: 4.7 },
  { iso3: "SWE", name: "Sweden", lat: 62.0, lon: 15.0 },
  { iso3: "NOR", name: "Norway", lat: 64.5, lon: 11.5 },
  { iso3: "DNK", name: "Denmark", lat: 56.0, lon: 10.0 },
  { iso3: "PRT", name: "Portugal", lat: 39.6, lon: -8.0 },
  { iso3: "AUT", name: "Austria", lat: 47.6, lon: 14.1 },
  { iso3: "CHN", name: "China", lat: 35.9, lon: 104.2 },
  { iso3: "HKG", name: "Hong Kong", lat: 22.3, lon: 114.2 },
  { iso3: "JPN", name: "Japan", lat: 36.2, lon: 138.3 },
  { iso3: "KOR", name: "South Korea", lat: 36.5, lon: 127.9 },
  { iso3: "SGP", name: "Singapore", lat: 1.35, lon: 103.8 },
  { iso3: "IND", name: "India", lat: 21.0, lon: 78.0 },
  { iso3: "TWN", name: "Taiwan", lat: 23.7, lon: 121.0 },
  { iso3: "ARE", name: "United Arab Emirates", lat: 24.4, lon: 54.4 },
  { iso3: "SAU", name: "Saudi Arabia", lat: 24.0, lon: 45.0 },
  { iso3: "QAT", name: "Qatar", lat: 25.3, lon: 51.2 },
  { iso3: "KWT", name: "Kuwait", lat: 29.3, lon: 47.5 },
  { iso3: "TUR", name: "Türkiye", lat: 39.0, lon: 35.2 },
  { iso3: "RUS", name: "Russia", lat: 61.5, lon: 96.0 },
  { iso3: "MEX", name: "Mexico", lat: 23.6, lon: -102.6 },
  { iso3: "PAN", name: "Panama", lat: 8.5, lon: -80.8 },
  { iso3: "COL", name: "Colombia", lat: 4.6, lon: -74.1 },
  { iso3: "VEN", name: "Venezuela", lat: 6.4, lon: -66.6 },
  { iso3: "BRA", name: "Brazil", lat: -10.8, lon: -52.9 },
  { iso3: "ARG", name: "Argentina", lat: -35.4, lon: -65.2 },
  { iso3: "CHL", name: "Chile", lat: -31.8, lon: -71.0 },
  { iso3: "PER", name: "Peru", lat: -9.2, lon: -75.0 },
  { iso3: "TTO", name: "Trinidad & Tobago", lat: 10.7, lon: -61.2 },
  { iso3: "BRB", name: "Barbados", lat: 13.2, lon: -59.5 },
  { iso3: "JAM", name: "Jamaica", lat: 18.1, lon: -77.3 },
  { iso3: "GUY", name: "Guyana", lat: 6.8, lon: -58.2 },
  { iso3: "SUR", name: "Suriname", lat: 5.9, lon: -55.2 },
  { iso3: "DOM", name: "Dominican Republic", lat: 18.7, lon: -70.2 },
  { iso3: "CUB", name: "Cuba", lat: 21.5, lon: -79.5 },
  { iso3: "BHS", name: "The Bahamas", lat: 25.0, lon: -77.4 },
  { iso3: "CYM", name: "Cayman Islands", lat: 19.3, lon: -81.3 },
  { iso3: "BMU", name: "Bermuda", lat: 32.3, lon: -64.8 },
  { iso3: "VGB", name: "British Virgin Islands", lat: 18.4, lon: -64.6 },
  { iso3: "CUW", name: "Curaçao", lat: 12.2, lon: -69.0 },
  { iso3: "ABW", name: "Aruba", lat: 12.5, lon: -70.0 },
  { iso3: "AUS", name: "Australia", lat: -25.3, lon: 133.8 },
  { iso3: "NZL", name: "New Zealand", lat: -41.8, lon: 172.8 },
  { iso3: "ZAF", name: "South Africa", lat: -29.0, lon: 25.1 },
  { iso3: "NGA", name: "Nigeria", lat: 9.1, lon: 8.7 },
  { iso3: "GHA", name: "Ghana", lat: 7.9, lon: -1.0 },
  { iso3: "MAR", name: "Morocco", lat: 31.8, lon: -6.0 },
  { iso3: "EGY", name: "Egypt", lat: 26.8, lon: 30.8 },
  { iso3: "ISR", name: "Israel", lat: 31.0, lon: 34.9 },
  { iso3: "CYP", name: "Cyprus", lat: 35.1, lon: 33.4 },
  { iso3: "MLT", name: "Malta", lat: 35.9, lon: 14.4 },
  { iso3: "ISL", name: "Iceland", lat: 64.9, lon: -18.6 },
];

const BY_ISO3 = new Map(CENTROIDS.map((c) => [c.iso3, c]));

/** Resolve a partner to its centroid by ISO3 code. Returns null when unknown — never guesses. */
export function partnerCentroid(iso3: string | null | undefined): PartnerCentroid | null {
  if (!iso3) return null;
  return BY_ISO3.get(iso3.trim().toUpperCase()) ?? null;
}

/** Best-effort ISO3 lookup by partner name (exact, case-insensitive). */
export function partnerCentroidByName(name: string | null | undefined): PartnerCentroid | null {
  if (!name) return null;
  const needle = name.trim().toLowerCase();
  return CENTROIDS.find((c) => c.name.toLowerCase() === needle) ?? null;
}
