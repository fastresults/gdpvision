import type { ThreatType } from "@/lib/fdi-resilience.functions";

export const THREAT_PRESETS: Array<{
  key: ThreatType;
  label: string;
  hint: string;
}> = [
  { key: "tariff", label: "Tariff", hint: "New import duties on a key export corridor" },
  { key: "climate", label: "Hurricane / climate", hint: "Physical shock to coastal/agricultural assets" },
  { key: "cbi_wind_down", label: "CBI wind-down", hint: "Loss of citizenship-by-investment revenue" },
  { key: "tourism_collapse", label: "Tourism demand collapse", hint: "Sudden drop in visitor arrivals" },
  { key: "anchor_exit", label: "Anchor employer exit", hint: "Major FDI investor departs the country" },
  { key: "commodity_shock", label: "Commodity shock", hint: "Price collapse on a primary export" },
  { key: "sanctions", label: "Sanctions", hint: "Restricted access to correspondent banking or markets" },
  { key: "treaty_change", label: "Treaty / rules-of-origin", hint: "Trade agreement or preference erosion" },
  { key: "custom", label: "Custom threat", hint: "Describe your own shock" },
];

export function threatLabel(k: string): string {
  return THREAT_PRESETS.find((p) => p.key === k)?.label ?? k;
}
