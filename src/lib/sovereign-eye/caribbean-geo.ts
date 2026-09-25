// Capital-city coordinates for every Caribbean country in the GDPVision
// country list. Shared by the regional map, globe and hazard-exposure rules.
export type GeoPoint = { code: string; name: string; lat: number; lon: number };

export const CARIBBEAN_POINTS: GeoPoint[] = [
  { code: "BHS", name: "The Bahamas", lat: 25.0343, lon: -77.3963 }, { code: "BLZ", name: "Belize", lat: 17.1899, lon: -88.4976 },
  { code: "JAM", name: "Jamaica", lat: 18.1096, lon: -77.2975 }, { code: "HTI", name: "Haiti", lat: 18.9712, lon: -72.2852 },
  { code: "KNA", name: "St. Kitts & Nevis", lat: 17.3578, lon: -62.783 }, { code: "AIA", name: "Anguilla", lat: 18.2206, lon: -63.0686 },
  { code: "ATG", name: "Antigua & Barbuda", lat: 17.0608, lon: -61.7964 }, { code: "DMA", name: "Dominica", lat: 15.415, lon: -61.371 },
  { code: "LCA", name: "Saint Lucia", lat: 13.9094, lon: -60.9789 }, { code: "VCT", name: "St. Vincent", lat: 13.2528, lon: -61.1971 },
  { code: "GRD", name: "Grenada", lat: 12.1165, lon: -61.679 }, { code: "BRB", name: "Barbados", lat: 13.1939, lon: -59.5432 },
  { code: "TTO", name: "Trinidad & Tobago", lat: 10.6918, lon: -61.2225 }, { code: "GUY", name: "Guyana", lat: 6.8013, lon: -58.1551 },
  { code: "SUR", name: "Suriname", lat: 5.852, lon: -55.2038 }, { code: "BMU", name: "Bermuda", lat: 32.3078, lon: -64.7505 },
  { code: "CYM", name: "Cayman Islands", lat: 19.2866, lon: -81.3744 }, { code: "TCA", name: "Turks & Caicos", lat: 21.4612, lon: -71.1419 },
  { code: "VGB", name: "British Virgin Islands", lat: 18.4286, lon: -64.6185 }, { code: "MSR", name: "Montserrat", lat: 16.7425, lon: -62.1874 },
  { code: "GLP", name: "Guadeloupe", lat: 16.265, lon: -61.551 }, { code: "MTQ", name: "Martinique", lat: 14.6415, lon: -61.0242 },
];

export const pointFor = (code: string) => CARIBBEAN_POINTS.find((p) => p.code === code.toUpperCase()) ?? null;
