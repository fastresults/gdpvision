// Canonical onboarding pipeline stage list. Import from any UI that needs
// to render or count pipeline progress; do not redefine locally.

export type OnboardingStage =
  | "profile"
  | "gdp"
  | "sector_composition"
  | "ministries"
  | "ministry_sector_map"
  | "source_registry"
  | "kpi_seed"
  | "sector_dossier"
  | "ministry_deep_dive"
  | "corpus_ingest"
  | "second_brain_seed"
  | "capital_flows";

export interface OnboardingStageMeta {
  key: OnboardingStage;
  label: string;
  short: string;
  desc: string;
}

export const ONBOARDING_STAGES: OnboardingStageMeta[] = [
  { key: "profile", label: "1. Profile", short: "Profile", desc: "Currency, fiscal year, population, head of government." },
  { key: "gdp", label: "2. GDP", short: "GDP", desc: "Nominal GDP USD (cross-checked between WB and IMF)." },
  { key: "sector_composition", label: "3. Sectors", short: "Sectors", desc: "Share_pct per sector; sums ≈ 100%." },
  { key: "ministries", label: "4. Ministries", short: "Ministries", desc: "Canonical cabinet ministries with mandate." },
  { key: "ministry_sector_map", label: "5. Ministry×Sector", short: "M×S", desc: "Weight matrix from portfolios to sectors." },
  { key: "source_registry", label: "6. Source registry", short: "Sources", desc: "Canonical URLs (gov, regional, multilateral, media) with toggle." },
  { key: "kpi_seed", label: "7. KPI seed", short: "KPIs", desc: "Canonical macro/fiscal/social KPIs with latest values." },
  { key: "sector_dossier", label: "8. Sector dossiers", short: "Dossiers", desc: "Policy + comms + regional benchmark per sector." },
  { key: "ministry_deep_dive", label: "9. Ministry deep-dive", short: "M-Deep", desc: "Minister, mandate, flagship programmes per ministry." },
  { key: "corpus_ingest", label: "10. Corpus ingest", short: "Corpus", desc: "Firecrawl scrape + embed every active source." },
  { key: "second_brain_seed", label: "11. Second-brain seed", short: "Brain", desc: "Cabinet positions, audiences, outlets, facts, risks." },
  { key: "capital_flows", label: "12. Capital flows", short: "Flows", desc: "Sovereign Sankey ledger (BOP + fiscal, USD $M) with citations." },
];
