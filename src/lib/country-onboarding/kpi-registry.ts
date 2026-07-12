// Canonical KPI registry — the code-owned "what must be filled" list.
// The agentic KPI research loop scores coverage against this registry and
// keeps working (Perplexity → World Bank → IMF → targeted Perplexity →
// Gemini escalation) until every required KPI has a value + period +
// source, or an explicit "not found" reason.

export type KpiCategory = "macro" | "fiscal" | "social" | "external" | "climate";
export type KpiDirection = "up" | "down" | "flat";

export type KpiRegistryEntry = {
  kpi_code: string;
  label: string;
  unit: string;
  direction: KpiDirection;
  category: KpiCategory;
  /** Human hint for the expected period shape, e.g. "2024", "2024/25". */
  expected_period_shape: string;
  /** Authoritative orgs prompt the LLM prefers when searching. */
  authoritative_orgs: string[];
  /** World Bank WDI indicator code — enables deterministic backfill. */
  wb_indicator?: string;
  /** IMF WEO subject code — deterministic backfill via IMF DataMapper. */
  imf_indicator?: string;
  /** Sanity bounds — values outside get dropped and re-researched. */
  value_bounds: { min: number; max: number };
  /** Required KPIs count against coverage; optional ones are best-effort. */
  required: boolean;
  /** Country tiers this KPI applies to. `all` covers everything. */
  tiers: Array<"all" | "sids" | "cbi">;
};

/**
 * Canonical registry. If you add a KPI here, the loop will start researching
 * it on the next `runKpiSeedAgent` invocation.
 */
export const KPI_REGISTRY: KpiRegistryEntry[] = [
  // --- Macro ---
  {
    kpi_code: "real_gdp_growth",
    label: "Real GDP growth",
    unit: "% YoY",
    direction: "up",
    category: "macro",
    expected_period_shape: "2024",
    authoritative_orgs: ["IMF WEO", "World Bank WDI", "ECCB"],
    wb_indicator: "NY.GDP.MKTP.KD.ZG",
    imf_indicator: "NGDP_RPCH",
    value_bounds: { min: -30, max: 30 },
    required: true,
    tiers: ["all"],
  },
  {
    kpi_code: "gdp_per_capita_current_usd",
    label: "GDP per capita, current USD",
    unit: "USD",
    direction: "up",
    category: "macro",
    expected_period_shape: "2024",
    authoritative_orgs: ["World Bank WDI", "IMF WEO"],
    wb_indicator: "NY.GDP.PCAP.CD",
    imf_indicator: "NGDPDPC",
    value_bounds: { min: 100, max: 250000 },
    required: true,
    tiers: ["all"],
  },
  {
    kpi_code: "gdp_per_capita_ppp",
    label: "GDP per capita, PPP",
    unit: "int$",
    direction: "up",
    category: "macro",
    expected_period_shape: "2024",
    authoritative_orgs: ["World Bank WDI", "IMF WEO"],
    wb_indicator: "NY.GDP.PCAP.PP.CD",
    imf_indicator: "PPPPC",
    value_bounds: { min: 100, max: 300000 },
    required: true,
    tiers: ["all"],
  },
  {
    kpi_code: "cpi_yoy",
    label: "CPI inflation, annual average",
    unit: "% YoY",
    direction: "flat",
    category: "macro",
    expected_period_shape: "2024",
    authoritative_orgs: ["IMF WEO", "World Bank WDI", "National CSO"],
    wb_indicator: "FP.CPI.TOTL.ZG",
    imf_indicator: "PCPIPCH",
    value_bounds: { min: -20, max: 200 },
    required: true,
    tiers: ["all"],
  },

  // --- Fiscal ---
  {
    kpi_code: "debt_gdp",
    label: "Gross public debt",
    unit: "% of GDP",
    direction: "down",
    category: "fiscal",
    expected_period_shape: "2024",
    authoritative_orgs: ["IMF WEO", "IMF Article IV", "Ministry of Finance"],
    imf_indicator: "GGXWDG_NGDP",
    value_bounds: { min: 0, max: 400 },
    required: true,
    tiers: ["all"],
  },
  {
    kpi_code: "primary_balance_gdp",
    label: "Primary balance",
    unit: "% of GDP",
    direction: "up",
    category: "fiscal",
    expected_period_shape: "2024",
    authoritative_orgs: ["IMF WEO", "IMF Article IV", "Ministry of Finance"],
    imf_indicator: "GGXONLB_NGDP",
    value_bounds: { min: -30, max: 30 },
    required: true,
    tiers: ["all"],
  },
  {
    kpi_code: "govt_revenue_gdp",
    label: "Government revenue",
    unit: "% of GDP",
    direction: "up",
    category: "fiscal",
    expected_period_shape: "2024",
    authoritative_orgs: ["IMF WEO", "Ministry of Finance"],
    imf_indicator: "GGR_NGDP",
    value_bounds: { min: 0, max: 100 },
    required: false,
    tiers: ["all"],
  },

  // --- External ---
  {
    kpi_code: "current_account_gdp",
    label: "Current account balance",
    unit: "% of GDP",
    direction: "up",
    category: "external",
    expected_period_shape: "2024",
    authoritative_orgs: ["IMF WEO", "World Bank WDI", "ECCB"],
    wb_indicator: "BN.CAB.XOKA.GD.ZS",
    imf_indicator: "BCA_NGDPD",
    value_bounds: { min: -60, max: 60 },
    required: true,
    tiers: ["all"],
  },
  {
    kpi_code: "exports_of_goods_and_services",
    label: "Exports of goods and services",
    unit: "% of GDP",
    direction: "up",
    category: "external",
    expected_period_shape: "2024",
    authoritative_orgs: ["World Bank WDI", "IMF"],
    wb_indicator: "NE.EXP.GNFS.ZS",
    value_bounds: { min: 0, max: 300 },
    required: true,
    tiers: ["all"],
  },
  {
    kpi_code: "tourism_arrivals",
    label: "International tourist arrivals",
    unit: "arrivals",
    direction: "up",
    category: "external",
    expected_period_shape: "2024",
    authoritative_orgs: ["World Bank WDI", "UNWTO", "Caribbean Tourism Organization"],
    wb_indicator: "ST.INT.ARVL",
    value_bounds: { min: 0, max: 200_000_000 },
    required: true,
    tiers: ["all"],
  },
  {
    kpi_code: "fdi_net_inflows_gdp",
    label: "FDI net inflows",
    unit: "% of GDP",
    direction: "up",
    category: "external",
    expected_period_shape: "2024",
    authoritative_orgs: ["World Bank WDI", "IMF BOP"],
    wb_indicator: "BX.KLT.DINV.WD.GD.ZS",
    value_bounds: { min: -50, max: 100 },
    required: false,
    tiers: ["all"],
  },

  // --- Social ---
  {
    kpi_code: "population",
    label: "Total population",
    unit: "people",
    direction: "flat",
    category: "social",
    expected_period_shape: "2024",
    authoritative_orgs: ["World Bank WDI", "UN DESA", "National CSO"],
    wb_indicator: "SP.POP.TOTL",
    value_bounds: { min: 1_000, max: 2_000_000_000 },
    required: true,
    tiers: ["all"],
  },
  {
    kpi_code: "unemployment_rate",
    label: "Unemployment rate",
    unit: "%",
    direction: "down",
    category: "social",
    expected_period_shape: "2024",
    authoritative_orgs: ["ILO", "World Bank WDI", "National CSO"],
    wb_indicator: "SL.UEM.TOTL.ZS",
    imf_indicator: "LUR",
    value_bounds: { min: 0, max: 60 },
    required: true,
    tiers: ["all"],
  },
  {
    kpi_code: "hdi",
    label: "Human Development Index",
    unit: "index (0-1)",
    direction: "up",
    category: "social",
    expected_period_shape: "2023",
    authoritative_orgs: ["UNDP HDR"],
    // No WB/IMF equivalent — UNDP HDR only. Perplexity handles it.
    value_bounds: { min: 0, max: 1 },
    required: true,
    tiers: ["all"],
  },
  {
    kpi_code: "life_expectancy",
    label: "Life expectancy at birth",
    unit: "years",
    direction: "up",
    category: "social",
    expected_period_shape: "2022",
    authoritative_orgs: ["World Bank WDI", "WHO"],
    wb_indicator: "SP.DYN.LE00.IN",
    value_bounds: { min: 30, max: 100 },
    required: false,
    tiers: ["all"],
  },
  {
    kpi_code: "poverty_headcount",
    label: "Poverty headcount ratio (national line)",
    unit: "% of population",
    direction: "down",
    category: "social",
    expected_period_shape: "2020",
    authoritative_orgs: ["World Bank WDI", "National CSO"],
    wb_indicator: "SI.POV.NAHC",
    value_bounds: { min: 0, max: 100 },
    required: false,
    tiers: ["all"],
  },

  // --- Climate ---
  {
    kpi_code: "co2_emissions_per_capita",
    label: "CO2 emissions per capita",
    unit: "metric tons per capita",
    direction: "down",
    category: "climate",
    expected_period_shape: "2022",
    authoritative_orgs: ["World Bank WDI", "IEA"],
    wb_indicator: "EN.GHG.CO2.PC.CE.AR5",
    value_bounds: { min: 0, max: 100 },
    required: true,
    tiers: ["all"],
  },
  {
    kpi_code: "renewable_energy_share",
    label: "Renewable energy in final consumption",
    unit: "% of final consumption",
    direction: "up",
    category: "climate",
    expected_period_shape: "2022",
    authoritative_orgs: ["World Bank WDI", "IRENA", "IEA"],
    wb_indicator: "EG.FEC.RNEW.ZS",
    value_bounds: { min: 0, max: 100 },
    required: false,
    tiers: ["all"],
  },
];

export function registryFor(tiers: Array<"all" | "sids" | "cbi"> = ["all"]): KpiRegistryEntry[] {
  const wanted = new Set(tiers);
  return KPI_REGISTRY.filter((k) => k.tiers.some((t) => t === "all" || wanted.has(t)));
}

export function findRegistryEntry(kpi_code: string): KpiRegistryEntry | undefined {
  return KPI_REGISTRY.find((k) => k.kpi_code === kpi_code);
}

/** Sanity check — returns true if the value is within registry bounds. */
export function isPlausible(kpi_code: string, value: number | null | undefined): boolean {
  if (value == null || !Number.isFinite(value)) return false;
  const e = findRegistryEntry(kpi_code);
  if (!e) return true;
  return value >= e.value_bounds.min && value <= e.value_bounds.max;
}
