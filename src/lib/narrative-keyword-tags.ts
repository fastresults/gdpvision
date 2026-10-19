// Chamber 05 — multilingual keyword tagger (EN/FR/NL/ES). Pure fallback used
// when the AI tagger is unavailable, so no story is left untagged.

const POLITICAL = [
  "prime minister", "premier", "parliament", "election", "elections", "minister", "opposition", "cabinet",
  "senate", "senator", "governor", "president", "political", "party", "ballot", "referendum", "legislat",
  "government", "diplomat", "ministry", "mp ", "upp", "ablp", "pnm", "jlp", "pnp", "dlp", "blp",
  "premier ministre", "parlement", "élection", "ministre", "gouvernement", "préfet", "député",
  "minister-president", "verkiezing", "regering", "staten", "eleccion", "elección", "gobierno", "ministro", "parlamento", "senado",
];
const ECONOMIC = [
  "gdp", "economy", "economic", "budget", "inflation", "imf", "debt", "investment", "investor", "tourism arrivals",
  "central bank", "eccb", "growth", "recession", "fiscal", "revenue", "tax", "trade", "export", "import", "jobs",
  "unemployment", "prices", "cost of living", "citizenship by investment", "cbi", "bond", "deficit", "world bank", "cdb",
  "pib", "économie", "économique", "dette", "croissance", "chômage",
  "bbp", "economie", "begroting", "schuld",
  "economía", "economia", "presupuesto", "deuda", "inversión", "crecimiento", "desempleo",
];
const GOVERNMENT = ["prime minister", "minister", "ministry", "government", "premier", "cabinet", "ministre", "gouvernement", "regering", "gobierno", "ministro"];

const hit = (text: string, words: string[]) => words.filter((w) => text.includes(w));

export function keywordTags(text: string): {
  is_political: boolean;
  is_economic: boolean;
  mentions_government: boolean;
  tags: string[];
} {
  const t = ` ${text.toLowerCase()} `;
  const p = hit(t, POLITICAL);
  const e = hit(t, ECONOMIC);
  const g = hit(t, GOVERNMENT);
  const tags = Array.from(new Set([...(p.length ? ["politics"] : []), ...(e.length ? ["economy"] : []), ...e.slice(0, 2), ...p.slice(0, 2)].map((x) => x.trim()))).slice(0, 6);
  return { is_political: p.length > 0, is_economic: e.length > 0, mentions_government: g.length > 0, tags };
}
