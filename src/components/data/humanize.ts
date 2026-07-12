const OVERRIDES: Record<string, string> = {
  oecs: "OECS",
  kpi: "KPI",
  kpis: "KPIs",
  gdp: "GDP",
  gni: "GNI",
  fdi: "FDI",
  ai: "AI",
  api: "API",
  mcp: "MCP",
  imf: "IMF",
  un: "UN",
  eu: "EU",
  us: "US",
  ngo: "NGO",
  ceo: "CEO",
  id: "ID",
  ids: "IDs",
  url: "URL",
  urls: "URLs",
};

export function humanizeKey(key: string): string {
  if (!key) return "";
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLowerCase();
      if (OVERRIDES[lower]) return OVERRIDES[lower];
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function formatNumber(n: number): string {
  if (!isFinite(n)) return String(n);
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

// Splits trailing citation markers like "text[4][7]" or "text[4,7,10]" into
// { text, refs }. Handles single, consecutive, and comma-separated forms.
export function splitCitations(s: string): { text: string; refs: number[] } {
  const refs: number[] = [];
  const cleaned = s.replace(/\[([\d,\s]+)\]/g, (_, inner: string) => {
    for (const part of inner.split(",")) {
      const n = Number(part.trim());
      if (Number.isFinite(n) && n > 0) refs.push(n);
    }
    return "";
  });
  return { text: cleaned.replace(/\s+([.,;:])/g, "$1").trim(), refs };
}

const URL_RE = /(https?:\/\/[^\s)]+)/g;

export function linkifyParts(s: string): Array<{ kind: "text" | "url"; value: string }> {
  const parts: Array<{ kind: "text" | "url"; value: string }> = [];
  let last = 0;
  for (const m of s.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ kind: "text", value: s.slice(last, i) });
    parts.push({ kind: "url", value: m[0] });
    last = i + m[0].length;
  }
  if (last < s.length) parts.push({ kind: "text", value: s.slice(last) });
  return parts;
}
