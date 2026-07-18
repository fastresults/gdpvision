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

const THREAT_HUE: Partial<Record<ThreatType, string>> = {
  tariff: "#c2410c",
  climate: "#0369a1",
  cbi_wind_down: "#7c3aed",
  tourism_collapse: "#be185d",
  anchor_exit: "#b91c1c",
  commodity_shock: "#a16207",
  sanctions: "#991b1b",
  treaty_change: "#4338ca",
  custom: "#4b5563",
};

export function threatTypeChip(t: string): { label: string; dot: string } {
  return { label: threatLabel(t), dot: THREAT_HUE[t as ThreatType] ?? "#4b5563" };
}

export function onsetLabel(o: string): string {
  const map: Record<string, string> = {
    immediate: "Immediate onset",
    "1y": "Onset within 1 year",
    "2y": "Onset within 2 years",
    phased: "Phased onset",
    latent: "Latent risk",
  };
  return map[o] ?? o.charAt(0).toUpperCase() + o.slice(1);
}
